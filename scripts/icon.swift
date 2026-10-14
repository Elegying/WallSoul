import AppKit
let size = 1024
let image = NSImage(size: NSSize(width: size, height: size))
image.lockFocus()
NSColor(calibratedRed: 0.20, green: 0.35, blue: 0.28, alpha: 1).setFill()
NSBezierPath(roundedRect: NSRect(x: 0, y: 0, width: size, height: size), xRadius: 220, yRadius: 220).fill()
NSColor(calibratedRed: 0.90, green: 0.91, blue: 0.79, alpha: 1).setFill()
NSBezierPath(ovalIn: NSRect(x: 245, y: 345, width: 534, height: 480)).fill()
NSColor(calibratedRed: 0.58, green: 0.69, blue: 0.54, alpha: 1).setFill()
let hills = NSBezierPath(); hills.move(to: NSPoint(x: 0, y: 260)); hills.curve(to: NSPoint(x: 1024, y: 240), controlPoint1: NSPoint(x: 400, y: 600), controlPoint2: NSPoint(x: 640, y: 0)); hills.line(to: .zero); hills.close(); hills.fill()
image.unlockFocus()
let bitmap=NSBitmapImageRep(data:image.tiffRepresentation!)!
try bitmap.representation(using:.png,properties:[:])!.write(to: URL(fileURLWithPath: "src-tauri/icons/source.png"))
