// The deck's palette: a dark stage, with colors that mean the same thing everywhere
// (web/css/style.css): root red, 3rd amber, 5th blue, 7th purple, flavor/blue note teal.
import MusicTheory
import SwiftUI

public enum Palette {
  public static let background = Color(hex: 0x17171B)
  public static let card = Color(hex: 0x202027)
  public static let card2 = Color(hex: 0x2A2A33)
  public static let line = Color(hex: 0x34343D)
  public static let line2 = Color(hex: 0x45454F)
  public static let text = Color(hex: 0xE4E4E7)
  public static let muted = Color(hex: 0xA1A1AA)
  public static let faint = Color(hex: 0x71717A)
  public static let pearl = Color(hex: 0xE9DFC8)
  public static let root = Color(hex: 0xE5484D)
  public static let third = Color(hex: 0xF5A524)
  public static let fifth = Color(hex: 0x3B82F6)
  public static let seventh = Color(hex: 0xA855F7)
  public static let teal = Color(hex: 0x14B8A6)
  public static let ok = teal
  public static let warn = third
  public static let bad = root

  // The fretboard.
  public static let woodTop = Color(hex: 0x4A2E1E)
  public static let woodMid = Color(hex: 0x3D2619)
  public static let woodBottom = Color(hex: 0x321E13)
  public static let woodEdge = Color(hex: 0x2A1810)
  public static let inlay = Color(hex: 0x7D6754)
  public static let fretWire = Color(hex: 0xBDB6A6)
  public static let string = Color(hex: 0xD9D4C7)

  public static func color(for role: DegreeRole) -> Color {
    switch role {
    case .root: root
    case .third: third
    case .fifth: fifth
    case .seventh: seventh
    case .flavor: teal
    case .other: Color(hex: 0x52525B)
    }
  }

  /// Text on top of a role's color.
  public static func ink(for role: DegreeRole) -> Color {
    switch role {
    case .third: Color(hex: 0x1C1404)
    default: .white
    }
  }
}

public extension Color {
  init(hex: UInt32, opacity: Double = 1) {
    self.init(.sRGB,
              red: Double((hex >> 16) & 0xFF) / 255,
              green: Double((hex >> 8) & 0xFF) / 255,
              blue: Double(hex & 0xFF) / 255,
              opacity: opacity)
  }
}
