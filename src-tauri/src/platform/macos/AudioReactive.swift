import AppKit
import AVFoundation
import CoreAudio

// PCM stays in the callback. Only scalar features cross into the UI.
final class AudioMeter {
    private let lock = NSLock()
    private var rms = 0.0
    private var variation = 0.0
    private var brightness = 0.0
    private var updated = -Double.infinity
    func consume(_ buffers: UnsafePointer<AudioBufferList>) {
        var sum = 0.0, difference = 0.0, count = 0
        for buffer in UnsafeMutableAudioBufferListPointer(UnsafeMutablePointer(mutating: buffers)) {
            guard let data = buffer.mData else { continue }
            let samples = data.assumingMemoryBound(to: Float.self)
            for i in 0..<Int(buffer.mDataByteSize)/MemoryLayout<Float>.size {
                let value = Double(samples[i]); if value.isFinite { sum += value * value; count += 1;let stride=max(1,Int(buffer.mNumberChannels));if i>=stride {let previous=Double(samples[i-stride]);if previous.isFinite {difference += pow(value-previous,2)}} }
            }
        }
        let value = count > 0 ? sqrt(sum / Double(count)) : 0
        lock.lock(); variation = variation * 0.9 + abs(value-rms) * 0.1; rms = value; brightness = brightness*0.65 + min(1,sqrt(difference/max(sum,1e-12))/0.3)*0.35; updated = ProcessInfo.processInfo.systemUptime; lock.unlock()
    }
    func read() -> (Double, Double, Double) {
        lock.lock(); defer { lock.unlock() }
        return ProcessInfo.processInfo.systemUptime-updated < 0.25 ? (rms,variation,brightness) : (0,0,0)
    }
    func reset() { lock.lock(); rms=0;variation=0;brightness=0;updated = -.infinity;lock.unlock() }
}


struct AudioReaction {
    private var outputUntil=0.0,inputUntil=0.0,echoUntil=0.0,lastPoll=0.0,moodUntil=0.0
    private(set) var phase="monitoring",emotion="neutral",level=0.0
    mutating func update(time:Double,mic:Double,sound:Double,variation:Double,micFloor:Double) {
        let dt=min(0.2,max(0,time-lastPoll));lastPoll=time
        // Keep short phrase pauses continuous, then reject the trailing speaker echo.
        if sound>0.002 {outputUntil=time+0.35;echoUntil=time+0.6;inputUntil=0}
        if mic>micFloor && time>echoUntil {inputUntil=time+0.8}
        phase=time<outputUntil ? "speaking" : time<inputUntil ? "listening" : "monitoring"
        if phase != "speaking" {emotion="neutral";moodUntil=0}
        else if time>=moodUntil {emotion=sound>0.035 && variation>0.003 ? "happy" : "neutral";moodUntil=time+1.5}
        let target=phase=="speaking" ? min(1,max(0,(20*log10(max(sound,0.000001))+54)/42)) : 0
        level += (target-level)*(1-exp(-dt*(target>level ? 24:16)))
    }
}

struct AudioSourceSession {
    let appPID: Int32
    let processIDs: Set<AudioObjectID>
    func interruption(appPID: Int32?, processIDs: Set<AudioObjectID>, restoresProcesses: Bool) -> String? {
        guard let appPID else {return "音频来源应用已退出，采集已停止。请重新打开来源应用，刷新来源后开始跟随。"}
        guard appPID == self.appPID else {return "音频来源应用已重新启动，原采集已停止。请刷新来源后重新开始跟随。"}
        if !restoresProcesses && self.processIDs.isDisjoint(with: processIDs) {
            return "来源的音频进程已中断，采集已停止。请让来源播放声音后重新开始跟随。"
        }
        return nil
    }
}

@available(macOS 14.2, *)
private func audioProcesses() -> [(AudioObjectID, String)] {
    var address = AudioObjectPropertyAddress(mSelector:kAudioHardwarePropertyProcessObjectList,mScope:kAudioObjectPropertyScopeGlobal,mElement:kAudioObjectPropertyElementMain)
    var size:UInt32 = 0
    guard AudioObjectGetPropertyDataSize(AudioObjectID(kAudioObjectSystemObject),&address,0,nil,&size)==noErr else { return [] }
    var ids=[AudioObjectID](repeating:0,count:Int(size)/MemoryLayout<AudioObjectID>.size)
    guard AudioObjectGetPropertyData(AudioObjectID(kAudioObjectSystemObject),&address,0,nil,&size,&ids)==noErr else { return [] }
    return ids.compactMap { id in
        var key=AudioObjectPropertyAddress(mSelector:kAudioProcessPropertyBundleID,mScope:kAudioObjectPropertyScopeGlobal,mElement:kAudioObjectPropertyElementMain)
        var raw:UnsafeRawPointer?;var bytes=UInt32(MemoryLayout<UnsafeRawPointer?>.size)
        guard AudioObjectGetPropertyData(id,&key,0,nil,&bytes,&raw)==noErr, let raw else {return nil}
        return (id,Unmanaged<CFString>.fromOpaque(raw).takeRetainedValue() as String)
    }
}

private final class AudioReactive {
    static let shared=AudioReactive()
    private let engine=AVAudioEngine()
    private let input=AudioMeter(), output=AudioMeter()
    private var tapped=false
    private var processTap:AudioObjectID=0, aggregate:AudioObjectID=0
    private var io:AudioDeviceIOProcID?
    private let queue=DispatchQueue(label:"app.wallsoul.audio-meter",qos:.userInitiated)
    private var epoch=0
    private var phase="idle",error="",source=""
    private var enabled=false
    private var micFloor=0.012
    private var reaction=AudioReaction()
    private var nextSourceCheck=0.0
    private var sourceSession: AudioSourceSession?
    private var permissionTimeout:DispatchWorkItem?
    func sources() -> [[String:String]] {
        // Application-level audio selection; no AX tree, account, chat or call-control access.
        NSWorkspace.shared.runningApplications.filter { $0.activationPolicy == .regular && $0.bundleIdentifier != Bundle.main.bundleIdentifier }.compactMap { app in
            guard let id=app.bundleIdentifier else {return nil}
            return ["id":id,"name":app.localizedName ?? id]
        }.sorted { $0["name"]! < $1["name"]! }
    }
    func stop() {
        epoch += 1;enabled=false;phase="idle";error="";permissionTimeout?.cancel();permissionTimeout=nil
        if tapped {engine.inputNode.removeTap(onBus:0);tapped=false};engine.stop()
        if #available(macOS 14.2, *) {
            if aggregate != 0 { if let io { AudioDeviceStop(aggregate,io);AudioDeviceDestroyIOProcID(aggregate,io) };AudioHardwareDestroyAggregateDevice(aggregate) }
            if processTap != 0 {AudioHardwareDestroyProcessTap(processTap)}
        }
        io=nil;aggregate=0;processTap=0;sourceSession=nil;input.reset();output.reset();reaction=AudioReaction()
    }
    private func fail(_ text:String) {stop();phase="error";error=text}
    func start(_ data:[String:Any]) {
        stop()
        guard #available(macOS 14.2, *) else {fail("应用音频采集需要 macOS 14.2 或更高版本。");return}
        guard let id=data["source"] as? String,sources().contains(where:{$0["id"]==id}) else {fail("请选择正在运行的音频来源应用。");return}
        source=id
        let db=data["micThresholdDb"] as? Double ?? -38
        guard db.isFinite,(-60 ... -25).contains(db) else {fail("麦克风灵敏度超出范围。");return}
        micFloor=pow(10,db/20);phase="permission";let token=epoch
        let timeout=DispatchWorkItem { [weak self] in guard let self,self.epoch==token,self.phase=="permission" else{return};self.fail("授权尚未完成，请在系统设置允许麦克风和系统音频录制后重试。") }
        permissionTimeout=timeout;DispatchQueue.main.asyncAfter(deadline:.now()+60,execute:timeout)
        AVCaptureDevice.requestAccess(for:.audio) { allowed in DispatchQueue.main.async {
            guard self.epoch==token else{return}
            guard allowed else {self.fail("请在系统设置中允许幕灵使用麦克风。");return}
            do {try self.startOutput(id);try self.startInput();self.enabled=true;self.phase="monitoring";self.permissionTimeout?.cancel();self.permissionTimeout=nil;self.nextSourceCheck=0}
            catch {self.fail(error.localizedDescription)}
        }}
    }
    private func startInput() throws {
        let node=engine.inputNode,format=engine.inputNode.outputFormat(forBus:0)
        guard format.sampleRate>0,format.channelCount>0 else {throw message("没有可用麦克风，请检查系统输入设备。")}
        let meter=input
        node.installTap(onBus:0,bufferSize:1024,format:format) { buffer,_ in meter.consume(buffer.audioBufferList) };tapped=true
        engine.prepare();try engine.start()
    }
    private func message(_ text:String)->NSError {NSError(domain:"WallSoulAudio",code:1,userInfo:[NSLocalizedDescriptionKey:text])}
    @available(macOS 14.2, *)
    private func startOutput(_ id:String) throws {
        guard let appPID=NSWorkspace.shared.runningApplications.first(where:{$0.bundleIdentifier==id})?.processIdentifier else {throw message("音频来源应用已退出，请重新打开后开始跟随。")}
        let processes=audioProcesses().filter{$0.1==id || $0.1.hasPrefix(id+".")}
        guard !processes.isEmpty else {throw message("所选应用还没有音频进程。请先让豆包播放一句话，再点击开始跟随。")}
        let description=CATapDescription(stereoMixdownOfProcesses:processes.map{$0.0})
        description.name="幕灵 · 所选应用音频";description.isPrivate=true;description.muteBehavior = .unmuted
        if #available(macOS 26.0, *) {description.bundleIDs=Array(Set([id]+processes.map{$0.1}));description.isProcessRestoreEnabled=true}
        var status=AudioHardwareCreateProcessTap(description,&processTap)
        guard status==noErr else {throw message("无法采集应用音频（\(status)）。请允许幕灵的系统音频录制权限后重试。")}
        var address=AudioObjectPropertyAddress(mSelector:kAudioTapPropertyFormat,mScope:kAudioObjectPropertyScopeGlobal,mElement:kAudioObjectPropertyElementMain)
        var format=AudioStreamBasicDescription();var size=UInt32(MemoryLayout<AudioStreamBasicDescription>.size)
        status=AudioObjectGetPropertyData(processTap,&address,0,nil,&size,&format)
        guard status==noErr,format.mFormatID==kAudioFormatLinearPCM,format.mFormatFlags & kAudioFormatFlagIsFloat != 0,format.mBitsPerChannel==32 else {throw message("当前音频输出格式不受支持，请切换系统输出设备后重试。")}
        let composition:[String:Any]=[kAudioAggregateDeviceNameKey:"WallSoul Audio Meter",kAudioAggregateDeviceUIDKey:UUID().uuidString,kAudioAggregateDeviceIsPrivateKey:true,kAudioAggregateDeviceTapAutoStartKey:true,kAudioAggregateDeviceTapListKey:[[kAudioSubTapUIDKey:description.uuid.uuidString,kAudioSubTapDriftCompensationKey:true]]]
        status=AudioHardwareCreateAggregateDevice(composition as CFDictionary,&aggregate)
        guard status==noErr else {throw message("音频采集设备创建失败（\(status)）。")}
        let meter=output
        status=AudioDeviceCreateIOProcIDWithBlock(&io,aggregate,queue) { _,buffers,_,_,_ in meter.consume(buffers) }
        guard status==noErr, let io else {throw message("音频回调创建失败（\(status)）。")}
        status=AudioDeviceStart(aggregate,io)
        guard status==noErr else {throw message("音频采集启动失败（\(status)）。")}
        sourceSession=AudioSourceSession(appPID:appPID,processIDs:Set(processes.map{$0.0}))
    }
    func snapshot()->[String:Any] {
        let now=ProcessInfo.processInfo.systemUptime
        let (mic,_,_)=input.read(),(sound,variation,brightness)=output.read()
        if enabled {
            reaction.update(time:now,mic:mic,sound:sound,variation:variation,micFloor:micFloor)
            phase=reaction.phase
            if now>nextSourceCheck {
                nextSourceCheck=now+2
                let appPID=NSWorkspace.shared.runningApplications.first(where:{$0.bundleIdentifier==source})?.processIdentifier
                if #available(macOS 14.2, *) {
                    let restoresProcesses:Bool
                    if #available(macOS 26.0, *) {restoresProcesses=true} else {restoresProcesses=false}
                    let processes=restoresProcesses ? Set<AudioObjectID>() : Set(audioProcesses().filter{$0.1==source || $0.1.hasPrefix(source+".")}.map{$0.0})
                    if let issue=sourceSession?.interruption(appPID:appPID,processIDs:processes,restoresProcesses:restoresProcesses) {fail(issue)}
                }
                if enabled && !engine.isRunning {fail("麦克风采集已中断，声音跟随已停止。请检查系统输入设备后重新开始跟随。")}
            }
        }
        return ["phase":phase,"enabled":enabled,"source":source,"emotion":reaction.emotion,"level":enabled ? reaction.level : 0,"inputLevel":enabled ? min(1,max(0,(20*log10(max(mic,0.000001))+60)/50)) : 0,"outputLevel":enabled ? min(1,max(0,(20*log10(max(sound,0.000001))+60)/50)) : 0,"brightness":enabled ? brightness : 0,"error":error]
    }
}
@_cdecl("ws_audio") public func wsAudio(_ command:UnsafePointer<CChar>,_ input:UnsafePointer<CChar>)->UnsafeMutablePointer<CChar>? {
    precondition(Thread.isMainThread)
    let audio=AudioReactive.shared;let cmd=String(cString:command)
    let value:Any
    if cmd=="sources" {value=audio.sources()} else {
        if cmd=="start" {let data=String(cString:input).data(using:.utf8)!;audio.start((try? JSONSerialization.jsonObject(with:data)) as? [String:Any] ?? [:])}
        if cmd=="stop" {audio.stop()};value=audio.snapshot()
    }
    guard let data=try? JSONSerialization.data(withJSONObject:value),let text=String(data:data,encoding:.utf8) else{return nil};return strdup(text)
}
func suspendPlatformAudio(){precondition(Thread.isMainThread);AudioReactive.shared.stop()}
