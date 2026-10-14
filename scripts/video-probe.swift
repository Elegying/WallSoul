import AppKit
import WebKit

@MainActor final class Probe: NSObject, NSApplicationDelegate, WKScriptMessageHandler {
    var window: NSWindow!
    func applicationDidFinishLaunching(_ notification: Notification) {
        let config = WKWebViewConfiguration()
        config.mediaTypesRequiringUserActionForPlayback = []
        config.userContentController.add(self, name: "probe")
        let view = WKWebView(frame: .zero, configuration: config)
        window = NSWindow(contentRect: NSRect(x: 80, y: 80, width: 800, height: 740), styleMask: [.titled, .closable, .resizable], backing: .buffered, defer: false)
        window.title = "幕灵 · 透明视频性能原型"
        window.contentView = view
        window.makeKeyAndOrderFront(nil)
        let path = CommandLine.arguments.count > 1 ? CommandLine.arguments[1] : "/artifacts/alpha-lab.html"
        view.load(URLRequest(url: URL(string: "http://127.0.0.1:1421" + path)!))
    }
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let text = message.body as? String, let data = (text + "\n").data(using: .utf8) else { return }
        let path = "/Users/jared/Desktop/app/WallSoul/artifacts/video-probe-events.jsonl"
        if !FileManager.default.fileExists(atPath: path) { FileManager.default.createFile(atPath: path, contents: nil) }
        if let file = FileHandle(forWritingAtPath: path) { file.seekToEndOfFile(); file.write(data); try? file.close() }
    }
    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { true }
}
@main struct VideoProbeApp {
    @MainActor static func main() {
        let app = NSApplication.shared
        let delegate = Probe()
        app.delegate = delegate
        app.setActivationPolicy(.regular)
        app.run()
    }
}
