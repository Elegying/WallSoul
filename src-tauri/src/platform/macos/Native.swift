import AppKit

private var observers: [NSObjectProtocol] = []
private var asleep = false
private var locked = false
private var desktop: NSWindow?
private func output(_ value: Any) -> UnsafeMutablePointer<CChar>? {
    guard let data = try? JSONSerialization.data(withJSONObject: value, options: [.sortedKeys]), let text = String(data: data, encoding: .utf8) else { return nil }
    return strdup(text)
}
@_cdecl("ws_free") public func wsFree(_ ptr: UnsafeMutablePointer<CChar>?) { free(ptr) }
@_cdecl("ws_desktop") public func wsDesktop(_ pointer: UnsafeMutableRawPointer, _ screenID: UInt32) -> Bool {
    precondition(Thread.isMainThread)
    guard let screen = NSScreen.screens.first(where: { ($0.deviceDescription[NSDeviceDescriptionKey("NSScreenNumber")] as? NSNumber)?.uint32Value == screenID }) else { return false }
    let window = Unmanaged<NSWindow>.fromOpaque(pointer).takeUnretainedValue()
    window.orderOut(nil)
    window.styleMask = [.borderless, .nonactivatingPanel]
    window.level = NSWindow.Level(rawValue: Int(CGWindowLevelForKey(.desktopWindow)) + 1)
    window.collectionBehavior = [.canJoinAllSpaces, .stationary, .ignoresCycle]
    window.ignoresMouseEvents = true
    window.hidesOnDeactivate = false
    window.hasShadow = false
    window.isOpaque = true
    window.backgroundColor = .black
    window.setFrame(screen.frame, display: true)
    window.orderFrontRegardless()
    desktop = window
    return window.level.rawValue < Int(CGWindowLevelForKey(.desktopIconWindow)) && window.ignoresMouseEvents
}
@_cdecl("ws_system") public func wsSystem() -> UnsafeMutablePointer<CChar>? {
    precondition(Thread.isMainThread)
    let screens: [[String: Any]] = NSScreen.screens.map { screen in
        ["id": (screen.deviceDescription[NSDeviceDescriptionKey("NSScreenNumber")] as? NSNumber)?.uint32Value ?? 0, "name": screen.localizedName, "width": screen.frame.width, "height": screen.frame.height, "scale": screen.backingScaleFactor]
    }
    var value: [String: Any] = ["suspended": asleep || locked, "screens": screens]
    let mouse = NSEvent.mouseLocation
    if let screen = NSScreen.screens.first(where: { NSMouseInRect(mouse, $0.frame, false) }) {
        value["pointer"] = ["x": (mouse.x-screen.frame.minX)/screen.frame.width, "y": 1-(mouse.y-screen.frame.minY)/screen.frame.height, "screen": (screen.deviceDescription[NSDeviceDescriptionKey("NSScreenNumber")] as? NSNumber)?.uint32Value ?? 0]
    }
    if let window = desktop {
        value["desktop"] = ["level": window.level.rawValue, "mousePass": window.ignoresMouseEvents, "canBecomeKey": window.canBecomeKey, "visible": window.isVisible, "occluded": !window.occlusionState.contains(.visible), "width": window.frame.width, "height": window.frame.height]
    }
    return output(value)
}
@_cdecl("ws_observe") public func wsObserve() {
    precondition(Thread.isMainThread)
    let nc = NSWorkspace.shared.notificationCenter
    observers.append(nc.addObserver(forName: NSWorkspace.willSleepNotification, object: nil, queue: .main) { _ in asleep = true; suspendPlatformAudio(); desktop?.orderOut(nil) })
    observers.append(nc.addObserver(forName: NSWorkspace.didWakeNotification, object: nil, queue: .main) { _ in asleep = false })
    observers.append(nc.addObserver(forName: NSWorkspace.screensDidSleepNotification, object: nil, queue: .main) { _ in locked = true; suspendPlatformAudio(); desktop?.orderOut(nil) })
    observers.append(nc.addObserver(forName: NSWorkspace.screensDidWakeNotification, object: nil, queue: .main) { _ in locked = false })
    observers.append(nc.addObserver(forName: NSWorkspace.sessionDidResignActiveNotification, object: nil, queue: .main) { _ in locked = true; suspendPlatformAudio(); desktop?.orderOut(nil) })
    observers.append(nc.addObserver(forName: NSWorkspace.sessionDidBecomeActiveNotification, object: nil, queue: .main) { _ in locked = false })
}
@_cdecl("ws_cleanup") public func wsCleanup() {
    for token in observers { NSWorkspace.shared.notificationCenter.removeObserver(token) }
    observers.removeAll(); desktop = nil
}

@_cdecl("ws_detach") public func wsDetach() { desktop = nil }
