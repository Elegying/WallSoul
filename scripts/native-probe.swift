import AppKit
@main struct Probe {
 static func main() {
  _ = NSApplication.shared
  if let text=wsSystem() {print(String(cString:text));wsFree(text)}
  print("desktopLevel=\(CGWindowLevelForKey(.desktopWindow)), iconLevel=\(CGWindowLevelForKey(.desktopIconWindow))")
 }
}
