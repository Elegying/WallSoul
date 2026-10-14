import AppKit
@main struct DesktopSmoke {
 static func main() {
  let app=NSApplication.shared
  app.setActivationPolicy(.accessory)
  guard let screen=NSScreen.main,let id=screen.deviceDescription[NSDeviceDescriptionKey("NSScreenNumber")] as? NSNumber else {fatalError("no screen")}
  let window=NSWindow(contentRect:NSRect(x:0,y:0,width:200,height:100),styleMask:[.borderless],backing:.buffered,defer:false)
  let result=wsDesktop(Unmanaged.passUnretained(window).toOpaque(),id.uint32Value)
  let level=window.level.rawValue
  assert(result)
  assert(level>Int(CGWindowLevelForKey(.desktopWindow)))
  assert(level<Int(CGWindowLevelForKey(.desktopIconWindow)))
  assert(window.ignoresMouseEvents)
  assert(window.frame==screen.frame)
  assert(!window.canBecomeKey)
  print("PASS desktop above background / below icons; mouse pass; cannot become key; selected screen frame; all Spaces collection behavior=\(window.collectionBehavior.rawValue)")
  window.orderOut(nil);wsDetach();wsCleanup()
 }
}
