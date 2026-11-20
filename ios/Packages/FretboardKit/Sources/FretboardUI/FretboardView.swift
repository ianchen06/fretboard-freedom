// The fretboard in the deck's style: rosewood, cream frets, high e on top so it reads like tab
// (web/js/fretboard.js), drawn in one Canvas pass so it stays smooth while notes flash at 100 Hz.
import MusicTheory
import SwiftUI

public struct FretDot: Identifiable, Hashable, Sendable {
  public enum Style: Hashable, Sendable {
    /// The rest of the scale, behind the shape.
    case faded
    /// A note of the shape.
    case shape
    /// The note to play next: ringed.
    case next
    /// Just played right.
    case hit
    /// Heard here (probably), in the scale.
    case live
    /// Heard here (probably), outside the scale.
    case outside
    /// A wrong note, where it most likely was.
    case wrong
  }

  public var position: FretPosition
  public var label: String
  public var role: DegreeRole
  public var style: Style
  public var id: String { "\(position.string):\(position.fret):\(style)" }

  public init(_ position: FretPosition, label: String, role: DegreeRole, style: Style) {
    self.position = position
    self.label = label
    self.role = role
    self.style = style
  }

  public init(_ note: ShapeNote, style: Style, label: String? = nil) {
    self.init(note.position, label: label ?? note.label, role: note.role, style: style)
  }
}

public struct FretboardView: View {
  public var tuning: Tuning
  public var frets: ClosedRange<Int>
  public var dots: [FretDot]
  /// The shape's fret window, lit a little.
  public var window: ClosedRange<Int>?
  public var onTap: ((FretPosition) -> Void)?

  static let inlays: Set<Int> = [3, 5, 7, 9, 15, 17, 19, 21]
  static let doubles: Set<Int> = [12, 24]

  public init(tuning: Tuning = .standard, frets: ClosedRange<Int> = 0...15, dots: [FretDot], window: ClosedRange<Int>? = nil,
              onTap: ((FretPosition) -> Void)? = nil) {
    self.tuning = tuning
    self.frets = frets
    self.dots = dots
    self.window = window
    self.onTap = onTap
  }

  struct Geometry {
    var size: CGSize
    var from: Int
    var to: Int
    let labelW: CGFloat = 26
    var hasOpen: Bool { from == 0 }
    var openW: CGFloat { hasOpen ? max(34, size.width * 0.04) : 0 }
    var first: Int { hasOpen ? 1 : from }
    var cells: Int { to - first + 1 }
    var top: CGFloat { 6 }
    var numbersH: CGFloat { 22 }
    var sp: CGFloat { (size.height - top - numbersH) / 6 }
    var boardH: CGFloat { sp * 6 }
    var bx: CGFloat { labelW + openW }
    var bw: CGFloat { size.width - bx - 4 }
    var cellW: CGFloat { bw / CGFloat(cells) }
    func y(_ s: Int) -> CGFloat { top + sp / 2 + CGFloat(s - 1) * sp }
    func x(_ f: Int) -> CGFloat { f == 0 && hasOpen ? labelW + openW * 0.45 : bx + (CGFloat(f - first) + 0.5) * cellW }
    func fretLineX(_ i: Int) -> CGFloat { bx + CGFloat(i) * cellW }
    var dotR: CGFloat { min(cellW, sp) * 0.4 }

    func position(at p: CGPoint) -> FretPosition? {
      guard p.y >= top, p.y <= top + boardH else { return nil }
      let s = min(6, max(1, Int((p.y - top) / sp) + 1))
      if hasOpen && p.x < bx { return p.x >= labelW ? FretPosition(string: s, fret: 0) : nil }
      let f = first + Int((p.x - bx) / cellW)
      return f <= to ? FretPosition(string: s, fret: f) : nil
    }
  }

  public var body: some View {
    Canvas(rendersAsynchronously: false) { ctx, size in
      let g = Geometry(size: size, from: frets.lowerBound, to: frets.upperBound)
      drawBoard(&ctx, g)
      for dot in dots where dot.style == .faded { drawDot(&ctx, g, dot) }
      for dot in dots where dot.style != .faded { drawDot(&ctx, g, dot) }
    }
    .contentShape(Rectangle())
    .gesture(SpatialTapGesture().onEnded { value in
      guard let onTap else { return }
      // The Canvas size isn't known here; onGeometryChange records it.
      if let p = Geometry(size: lastSize.size, from: frets.lowerBound, to: frets.upperBound).position(at: value.location) { onTap(p) }
    })
    .onGeometryChange(for: CGSize.self) { $0.size } action: { lastSize.size = $0 }
    .accessibilityElement()
    .accessibilityLabel("Fretboard, frets \(frets.lowerBound) to \(frets.upperBound)")
    .accessibilityValue(accessibilityValue)
  }

  @State private var lastSize = SizeBox()

  var accessibilityValue: String {
    let next = dots.first { $0.style == .next }
    return next.map { "Next: \(tuning.stringLongName($0.position.string)) string, fret \($0.position.fret), \($0.label)" } ?? ""
  }

  func drawBoard(_ ctx: inout GraphicsContext, _ g: Geometry) {
    let board = CGRect(x: g.bx, y: g.top, width: g.bw, height: g.boardH)
    ctx.fill(Path(roundedRect: board, cornerRadius: 3),
             with: .linearGradient(Gradient(colors: [Palette.woodTop, Palette.woodMid, Palette.woodBottom]),
                                   startPoint: CGPoint(x: 0, y: board.minY), endPoint: CGPoint(x: 0, y: board.maxY)))
    ctx.stroke(Path(roundedRect: board, cornerRadius: 3), with: .color(Palette.woodEdge), lineWidth: 1.5)

    if let w = window {
      let lo = max(g.first, w.lowerBound), hi = min(g.to, w.upperBound)
      if lo <= hi {
        let r = CGRect(x: g.fretLineX(lo - g.first), y: g.top, width: CGFloat(hi - lo + 1) * g.cellW, height: g.boardH)
        ctx.fill(Path(r), with: .color(.white.opacity(0.06)))
      }
    }

    let inlayR = min(g.cellW, g.sp) * 0.16
    for f in g.first...g.to {
      let cx = g.x(f)
      if Self.inlays.contains(f) {
        ctx.fill(Path(ellipseIn: CGRect(x: cx - inlayR, y: g.top + g.boardH / 2 - inlayR, width: 2 * inlayR, height: 2 * inlayR)), with: .color(Palette.inlay))
      }
      if Self.doubles.contains(f) {
        for yy in [g.top + g.sp * 2, g.top + g.sp * 4] {
          ctx.fill(Path(ellipseIn: CGRect(x: cx - inlayR, y: yy - inlayR, width: 2 * inlayR, height: 2 * inlayR)), with: .color(Palette.inlay))
        }
      }
    }
    // Fret wires; the nut is thicker.
    for i in 0...g.cells {
      let x = g.fretLineX(i)
      let nut = i == 0 && g.hasOpen
      var p = Path()
      p.move(to: CGPoint(x: x, y: g.top))
      p.addLine(to: CGPoint(x: x, y: g.top + g.boardH))
      ctx.stroke(p, with: .color(nut ? Palette.pearl : Palette.fretWire.opacity(0.8)), lineWidth: nut ? 6 : 2)
    }
    // Strings, thicker toward low E, across the open column too.
    let widths: [CGFloat] = [1.2, 1.5, 1.9, 2.4, 3, 3.6]
    for s in 1...6 {
      var p = Path()
      p.move(to: CGPoint(x: g.labelW + 4, y: g.y(s)))
      p.addLine(to: CGPoint(x: g.bx + g.bw, y: g.y(s)))
      ctx.stroke(p, with: .color(Palette.string.opacity(0.85)), lineWidth: widths[s - 1])
      ctx.draw(Text(tuning.stringName(s)).font(.system(size: 13, weight: .semibold, design: .monospaced)).foregroundStyle(Palette.muted),
               at: CGPoint(x: g.labelW / 2, y: g.y(s)))
    }
    // Fret numbers.
    for f in (g.hasOpen ? 0 : g.first)...g.to {
      let marked = Self.inlays.contains(f) || Self.doubles.contains(f) || f == 0
      ctx.draw(Text("\(f)").font(.system(size: 12, weight: marked ? .bold : .regular, design: .rounded))
                 .foregroundStyle(marked ? Palette.text : Palette.faint),
               at: CGPoint(x: g.x(f), y: g.top + g.boardH + g.numbersH / 2 + 2))
    }
  }

  func drawDot(_ ctx: inout GraphicsContext, _ g: Geometry, _ dot: FretDot) {
    guard frets.contains(dot.position.fret) else { return }
    let c = CGPoint(x: g.x(dot.position.fret), y: g.y(dot.position.string))
    let r = g.dotR
    let color = Palette.color(for: dot.role)
    func circle(_ radius: CGFloat) -> Path { Path(ellipseIn: CGRect(x: c.x - radius, y: c.y - radius, width: 2 * radius, height: 2 * radius)) }
    func label(_ text: String, _ ink: Color, size: CGFloat = 0.82) {
      ctx.draw(Text(text).font(.system(size: r * size, weight: .bold, design: .rounded)).foregroundStyle(ink), at: c)
    }
    switch dot.style {
    case .faded:
      ctx.fill(circle(r * 0.5), with: .color(color.opacity(0.35)))
    case .shape:
      ctx.fill(circle(r), with: .color(color))
      ctx.stroke(circle(r), with: .color(.black.opacity(0.35)), lineWidth: 1)
      label(dot.label, Palette.ink(for: dot.role))
    case .next:
      var glow = ctx
      glow.addFilter(.blur(radius: r * 0.35))
      glow.stroke(circle(r * 1.32), with: .color(Palette.third.opacity(0.9)), lineWidth: 5)
      ctx.fill(circle(r), with: .color(color))
      ctx.stroke(circle(r * 1.3), with: .color(Palette.third), lineWidth: 3)
      label(dot.label, Palette.ink(for: dot.role))
    case .hit:
      ctx.fill(circle(r), with: .color(color))
      ctx.stroke(circle(r * 1.25), with: .color(Palette.teal), lineWidth: 3.5)
      label(dot.label, Palette.ink(for: dot.role))
    case .live:
      ctx.stroke(circle(r * 1.1), with: .color(.white.opacity(0.9)), lineWidth: 3)
    case .outside:
      ctx.fill(circle(r * 0.9), with: .color(Palette.card2))
      ctx.stroke(circle(r * 0.9), with: .color(Palette.muted), style: StrokeStyle(lineWidth: 2, dash: [4, 3]))
      label(dot.label, Palette.text, size: 0.7)
    case .wrong:
      ctx.fill(circle(r * 0.95), with: .color(Color(hex: 0x2A1810)))
      ctx.stroke(circle(r * 0.95), with: .color(Palette.root), style: StrokeStyle(lineWidth: 2.5, dash: [4, 3]))
      label(dot.label, Palette.root, size: 0.7)
    }
  }
}

/// Holds the last laid-out size without causing a redraw when it's written.
private final class SizeBox { var size = CGSize.zero }

#Preview("A minor box 1", traits: .landscapeLeft) {
  let shape = Shapes.position(root: 9, scale: .minorPentatonic, box: 1)!
  let neck = Shapes.wholeNeck(root: 9, scale: .minorPentatonic, frets: 0...15)
  let inShape = Set(shape.notes.map(\.position))
  return FretboardView(
    frets: 0...15,
    dots: neck.filter { !inShape.contains($0.position) }.map { FretDot($0, style: .faded) }
      + shape.notes.enumerated().map { i, n in FretDot(n, style: i == 3 ? .next : .shape) },
    window: shape.lo...shape.hi
  )
  .frame(height: 300)
  .padding()
  .background(Palette.background)
}
