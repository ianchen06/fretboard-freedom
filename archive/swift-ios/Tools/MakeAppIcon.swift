// Draws the 1024 × 1024 app icon: A minor pentatonic box 1 on a slice of rosewood neck (frets 5–8),
// in the deck's colors (root red, 3rd amber, 5th blue, 7th purple, the 4th neutral). High e on top,
// as in the app. iPadOS rounds the corners itself, so the image is a full square with no alpha.
//
//   swift ios/Tools/MakeAppIcon.swift
//
// writes ios/FretboardFreedom/Assets.xcassets/AppIcon.appiconset/AppIcon.png.
import CoreGraphics
import Foundation
import ImageIO
import UniformTypeIdentifiers

let size = 1024
let space = CGColorSpace(name: CGColorSpace.sRGB)!

func rgb(_ hex: UInt32, _ alpha: CGFloat = 1) -> CGColor {
  CGColor(colorSpace: space, components: [
    CGFloat((hex >> 16) & 0xFF) / 255, CGFloat((hex >> 8) & 0xFF) / 255, CGFloat(hex & 0xFF) / 255, alpha,
  ])!
}

let ctx = CGContext(data: nil, width: size, height: size, bitsPerComponent: 8, bytesPerRow: 0, space: space,
                    bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue)!
// Top-left origin, like the drawing coordinates below.
ctx.translateBy(x: 0, y: CGFloat(size))
ctx.scaleBy(x: 1, y: -1)

func linear(_ colors: [UInt32], from: CGPoint, to: CGPoint) {
  let g = CGGradient(colorsSpace: space, colors: colors.map { rgb($0) } as CFArray, locations: nil)!
  ctx.drawLinearGradient(g, start: from, end: to, options: [.drawsBeforeStartLocation, .drawsAfterEndLocation])
}

// The stage.
linear([0x24242C, 0x121215], from: .zero, to: CGPoint(x: 0, y: size))

// The neck.
let neckTop: CGFloat = 176, neckBottom: CGFloat = 848
ctx.saveGState()
ctx.setShadow(offset: CGSize(width: 0, height: 18), blur: 40, color: rgb(0x000000, 0.55))
ctx.setFillColor(rgb(0x3D2619))
ctx.fill(CGRect(x: 0, y: neckTop, width: CGFloat(size), height: neckBottom - neckTop))
ctx.restoreGState()
ctx.saveGState()
ctx.clip(to: CGRect(x: 0, y: neckTop, width: CGFloat(size), height: neckBottom - neckTop))
linear([0x4A2E1E, 0x3D2619, 0x321E13], from: CGPoint(x: 0, y: neckTop), to: CGPoint(x: 0, y: neckBottom))
ctx.restoreGState()
// Binding along both edges.
ctx.setFillColor(rgb(0xE9DFC8, 0.30))
ctx.fill(CGRect(x: 0, y: neckTop, width: CGFloat(size), height: 5))
ctx.fill(CGRect(x: 0, y: neckBottom - 5, width: CGFloat(size), height: 5))

// Fret wires: frets 5, 6, 7 and 8 sit between them, shifted so the box sits in the middle.
let wires: [CGFloat] = [113, 341, 569, 797, 1025]
for x in wires {
  ctx.setFillColor(rgb(0x8F887A))
  ctx.fill(CGRect(x: x - 8, y: neckTop + 5, width: 16, height: neckBottom - neckTop - 10))
  ctx.setFillColor(rgb(0xD6D0C2))
  ctx.fill(CGRect(x: x - 5, y: neckTop + 5, width: 6, height: neckBottom - neckTop - 10))
}
let fretX: [Int: CGFloat] = [5: 227, 6: 455, 7: 683, 8: 911]

// Strings, high e (0) to low E (5).
let stringY = (0..<6).map { 232 + CGFloat($0) * 112 }
let gauge: [CGFloat] = [4, 5, 6, 8, 10, 12]
for (i, y) in stringY.enumerated() {
  ctx.saveGState()
  ctx.setShadow(offset: CGSize(width: 0, height: 4), blur: 6, color: rgb(0x000000, 0.5))
  ctx.setFillColor(rgb(i < 3 ? 0xE4DFD3 : 0xCFC6B4))
  ctx.fill(CGRect(x: 0, y: y - gauge[i] / 2, width: CGFloat(size), height: gauge[i]))
  ctx.restoreGState()
}

// Box 1 of A minor pentatonic: (string, fret, color).
let root: UInt32 = 0xE5484D, third: UInt32 = 0xF5A524, fourth: UInt32 = 0x8A8A93
let fifth: UInt32 = 0x3B82F6, seventh: UInt32 = 0xA855F7
let notes: [(Int, Int, UInt32)] = [
  (0, 5, root), (0, 8, third),
  (1, 5, fifth), (1, 8, seventh),
  (2, 5, third), (2, 7, fourth),
  (3, 5, seventh), (3, 7, root),
  (4, 5, fourth), (4, 7, fifth),
  (5, 5, root), (5, 8, third),
]
let r: CGFloat = 47
for (s, f, color) in notes {
  let c = CGPoint(x: fretX[f]!, y: stringY[s])
  let dot = CGRect(x: c.x - r, y: c.y - r, width: 2 * r, height: 2 * r)
  ctx.saveGState()
  ctx.setShadow(offset: CGSize(width: 0, height: 8), blur: 14, color: rgb(0x000000, 0.55))
  ctx.setFillColor(rgb(color))
  ctx.fillEllipse(in: dot)
  ctx.restoreGState()
  // A soft top light and a thin dark rim, so the dots read as pressed buttons.
  ctx.saveGState()
  ctx.addEllipse(in: dot)
  ctx.clip()
  let shine = CGGradient(colorsSpace: space, colors: [rgb(0xFFFFFF, 0.28), rgb(0xFFFFFF, 0)] as CFArray, locations: nil)!
  ctx.drawLinearGradient(shine, start: CGPoint(x: c.x, y: c.y - r), end: CGPoint(x: c.x, y: c.y + r * 0.2), options: [])
  ctx.restoreGState()
  ctx.setStrokeColor(rgb(0x000000, 0.35))
  ctx.setLineWidth(3)
  ctx.strokeEllipse(in: dot.insetBy(dx: 1.5, dy: 1.5))
}

let out = URL(fileURLWithPath: #filePath).deletingLastPathComponent()
  .appending(path: "../FretboardFreedom/Assets.xcassets/AppIcon.appiconset/AppIcon.png").standardized
let dest = CGImageDestinationCreateWithURL(out as CFURL, UTType.png.identifier as CFString, 1, nil)!
CGImageDestinationAddImage(dest, ctx.makeImage()!, nil)
guard CGImageDestinationFinalize(dest) else { fatalError("Couldn’t write \(out.path)") }
print("Wrote \(out.path)")
