import AppKit
import AVFoundation
import Foundation

/// Offline decode probe. It neither opens windows nor captures the screen or microphone.
@main struct InspectAlphaVideo {
    static func main() async throws {
        guard (3...4).contains(CommandLine.arguments.count) else { fatalError("input.mov output.png [seconds]") }
        let asset = AVURLAsset(url: URL(fileURLWithPath: CommandLine.arguments[1]))
        let generator = AVAssetImageGenerator(asset: asset)
        generator.appliesPreferredTrackTransform = true
        generator.requestedTimeToleranceBefore = .zero
        generator.requestedTimeToleranceAfter = .zero
        let seconds = CommandLine.arguments.count == 4 ? Double(CommandLine.arguments[3])! : 0
        let image = try await generator.image(at: CMTime(seconds: seconds, preferredTimescale: 32000)).image
        let bitmap = NSBitmapImageRep(cgImage: image)
        let png = bitmap.representation(using: .png, properties: [:])!
        try png.write(to: URL(fileURLWithPath: CommandLine.arguments[2]))
        let result: [String: Any] = [
            "width": image.width, "height": image.height,
            "alphaInfo": image.alphaInfo.rawValue,
            "cornerAlpha": bitmap.colorAt(x: 0, y: 0)!.alphaComponent,
            "faceAlpha": bitmap.colorAt(x: image.width / 2, y: image.height / 3)!.alphaComponent,
        ]
        print(String(data: try JSONSerialization.data(withJSONObject: result, options: [.prettyPrinted, .sortedKeys]), encoding: .utf8)!)
    }
}
