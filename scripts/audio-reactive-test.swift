import Foundation
import CoreAudio
// Keep checks active in the optimized build too; Swift assert is disabled by -O.
@main struct AudioTests {
 static func main() {
  var reaction=AudioReaction()
  reaction.update(time:1,mic:0.08,sound:0,variation:0,micFloor:0.012)
  precondition(reaction.phase=="listening" && reaction.level==0,"Microphone drives attention, never the character mouth")
  reaction.update(time:1.1,mic:0,sound:0,variation:0,micFloor:0.012)
  precondition(reaction.phase=="listening","Hold gaze across syllable pauses")
  reaction.update(time:2,mic:0.08,sound:0.08,variation:0.02,micFloor:0.012)
  precondition(reaction.phase=="speaking" && reaction.level>0,"Only selected output drives mouth")
  reaction.update(time:2.28,mic:0.04,sound:0,variation:0,micFloor:0.012)
  precondition(reaction.phase=="speaking","A short phrase pause does not interrupt the speaking animation")
  reaction.update(time:2.4,mic:0.04,sound:0,variation:0,micFloor:0.012)
  precondition(reaction.phase=="monitoring","Output leakage must not leave the character listening")
  precondition(reaction.emotion=="neutral","A previous output emotion must not leak into silence or listening")
  for n in 1...30 {reaction.update(time:2.4+Double(n)*0.05,mic:0,sound:0,variation:0,micFloor:0.012)}
  precondition(reaction.level<0.001,"Silence closes mouth")
  reaction.update(time:5,mic:0.08,sound:0,variation:0,micFloor:0.012)
  reaction.update(time:5.1,mic:0.08,sound:0.08,variation:0,micFloor:0.012)
  reaction.update(time:5.5,mic:0,sound:0,variation:0,micFloor:0.012)
  precondition(reaction.phase=="monitoring","New output clears an earlier microphone hold")
  reaction.update(time:5.75,mic:0.08,sound:0,variation:0,micFloor:0.012)
  precondition(reaction.phase=="listening","A real user turn can begin once the bounded echo tail ends")
  let source=AudioSourceSession(appPID:42,processIDs:[7,8])
  precondition(source.interruption(appPID:42,processIDs:[8,9],restoresProcesses:false)==nil,"A surviving captured process remains usable")
  precondition(source.interruption(appPID:nil,processIDs:[],restoresProcesses:true) != nil,"Source exit stops capture on every supported OS")
  precondition(source.interruption(appPID:43,processIDs:[7,8],restoresProcesses:true) != nil,"A fast restart with the same bundle ID must not pretend the original session is alive")
  precondition(source.interruption(appPID:42,processIDs:[9],restoresProcesses:false) != nil,"Pre-restoration process taps detect a lost audio process")
  precondition(source.interruption(appPID:42,processIDs:[9],restoresProcesses:true)==nil,"Native process restoration can replace an audio helper within the same app session")
  func brightness(_ frequency:Double)->Double {
   let meter=AudioMeter()
   var samples=(0..<4096).map { Float(sin(Double($0)*2*Double.pi*frequency/48000)*0.1) }
   samples.withUnsafeMutableBytes { bytes in
    var list=AudioBufferList(mNumberBuffers:1,mBuffers:AudioBuffer(mNumberChannels:1,mDataByteSize:UInt32(bytes.count),mData:bytes.baseAddress))
    for _ in 0..<10 {meter.consume(&list)}
   }
   return meter.read().2
  }
  precondition(brightness(5000)>brightness(200)+0.5,"Mouth family follows spectral change, independently of loudness")
  print("PASS: input attention, phrase pauses, echo tails, source exit/restart, native restoration and bounded mouth response")
 }
}
