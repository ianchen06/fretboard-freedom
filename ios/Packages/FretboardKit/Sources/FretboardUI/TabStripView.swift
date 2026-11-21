// The sequence as tab, one column per note, with the next note ringed and each note colored by how
// you played it this pass (web/js/seqtab.js). It scrolls to keep the next note in view.
import MusicTheory
import SwiftUI

public struct TabStripView: View {
  public enum NoteState: Hashable, Sendable { case pending, hit, miss }

  public var tuning: Tuning
  public var notes: [ShapeNote]
  public var states: [NoteState]
  public var current: Int?
  /// Notes per beat: a faint line marks each beat.
  public var notesPerBeat: Int
  /// Hide the frets ("from memory").
  public var hidden: Bool

  public init(tuning: Tuning = .standard, notes: [ShapeNote], states: [NoteState] = [], current: Int?, notesPerBeat: Int,
              hidden: Bool = false, rowHeight: CGFloat = 17) {
    self.tuning = tuning
    self.notes = notes
    self.states = states
    self.current = current
    self.notesPerBeat = max(1, notesPerBeat)
    self.hidden = hidden
    rowH = rowHeight
  }

  let column: CGFloat = 34
  let rowH: CGFloat

  public var body: some View {
    ScrollViewReader { proxy in
      ScrollView(.horizontal, showsIndicators: false) {
        HStack(alignment: .top, spacing: 0) {
          labels
          LazyHStack(spacing: 0) {
            ForEach(notes.indices, id: \.self) { i in
              cell(i).id(i)
            }
          }
        }
        .padding(.horizontal, 8)
      }
      .onChange(of: current) { _, new in
        guard let new else { return }
        withAnimation(.snappy(duration: 0.25)) { proxy.scrollTo(new, anchor: UnitPoint(x: 0.35, y: 0.5)) }
      }
    }
    .frame(height: rowH * 6 + 30)
  }

  var labels: some View {
    VStack(spacing: 0) {
      ForEach(highToLow, id: \.self) { s in
        Text(tuning.stringName(s))
          .font(.system(size: 12, weight: .semibold, design: .monospaced))
          .foregroundStyle(Palette.faint)
          .frame(width: 18, height: rowH)
      }
    }
  }

  func cell(_ i: Int) -> some View {
    let n = notes[i]
    let state = i < states.count ? states[i] : .pending
    let isCurrent = i == current
    let beatStart = i % notesPerBeat == 0
    let color: Color = switch state {
    case .hit: Palette.teal
    case .miss: Palette.root
    case .pending: isCurrent ? Palette.text : Palette.muted
    }
    return VStack(spacing: 0) {
      ZStack(alignment: .topLeading) {
        // Six string lines.
        VStack(spacing: 0) {
          ForEach(0..<6, id: \.self) { _ in
            Rectangle().fill(Palette.line2).frame(height: 1).frame(maxHeight: .infinity)
          }
        }
        .frame(height: rowH * 6)
        if beatStart {
          Rectangle().fill(Palette.line2.opacity(0.7)).frame(width: 1, height: rowH * 6)
        }
        Text(hidden && state == .pending ? "?" : "\(n.fret)")
          .font(.system(size: 14, weight: isCurrent ? .heavy : .semibold, design: .monospaced))
          .foregroundStyle(color)
          .padding(.horizontal, 3)
          .background(Palette.background)
          .frame(width: column, height: rowH)
          .offset(y: CGFloat(n.string - 1) * rowH)
      }
      .frame(width: column, height: rowH * 6)
      Text(n.label)
        .font(.system(size: 11, weight: .bold, design: .rounded))
        .foregroundStyle(Palette.color(for: n.role))
        .frame(height: 22)
    }
    .background {
      if isCurrent {
        RoundedRectangle(cornerRadius: 7).stroke(Palette.third, lineWidth: 2).padding(.vertical, -2)
      }
    }
    .accessibilityElement(children: .ignore)
    .accessibilityLabel("Note \(i + 1): \(tuning.stringLongName(n.string)) string fret \(n.fret), \(n.label)")
  }
}
