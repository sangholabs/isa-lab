// 덜내 아이콘·스플래시·스토어 그래픽 생성기. 저장소 루트에서 `swift apps/mobile/assets/make-icons.swift`
// 모양: 높은 반투명 막대(일반계좌 세금) 옆에 낮은 초록 막대와 아래 화살표(ISA로 줄어든 세금). 색은 앱의 파랑·초록.
import CoreGraphics
import CoreText
import Foundation
import ImageIO
import UniformTypeIdentifiers

func rgb(_ hex: UInt32, _ a: CGFloat = 1) -> CGColor {
    CGColor(srgbRed: CGFloat(hex >> 16 & 0xFF) / 255, green: CGFloat(hex >> 8 & 0xFF) / 255, blue: CGFloat(hex & 0xFF) / 255, alpha: a)
}
let blueTop = rgb(0x2B60B8), blueBottom = rgb(0x1B4690), mint = rgb(0x5BDDAE), ghost = rgb(0xFFFFFF, 0.3)

/// 좌상단 원점 캔버스에 그려 PNG로 쓴다. opaque면 알파 채널 없이 쓴다(App Store 아이콘 규칙).
func png(_ path: String, _ w: Int, _ h: Int, opaque: Bool, _ draw: (CGContext) -> Void) {
    let ctx = CGContext(data: nil, width: w, height: h, bitsPerComponent: 8, bytesPerRow: 0,
                        space: CGColorSpace(name: CGColorSpace.sRGB)!,
                        bitmapInfo: (opaque ? CGImageAlphaInfo.noneSkipLast : .premultipliedLast).rawValue)!
    ctx.translateBy(x: 0, y: CGFloat(h)); ctx.scaleBy(x: 1, y: -1)
    draw(ctx)
    let dest = CGImageDestinationCreateWithURL(URL(fileURLWithPath: path) as CFURL, UTType.png.identifier as CFString, 1, nil)!
    CGImageDestinationAddImage(dest, ctx.makeImage()!, nil)
    guard CGImageDestinationFinalize(dest) else { fatalError("write failed: \(path)") }
    print("wrote \(path) \(w)x\(h)")
}

func background(_ c: CGContext, height h: CGFloat) {
    let g = CGGradient(colorsSpace: CGColorSpace(name: CGColorSpace.sRGB), colors: [blueTop, blueBottom] as CFArray, locations: [0, 1])!
    c.drawLinearGradient(g, start: .zero, end: CGPoint(x: 0, y: h), options: [])
}

/// 마크. 설계 공간 464×544를 rect 가운데에 맞춘다.
func mark(_ c: CGContext, fit rect: CGRect, ghost: CGColor, accent: CGColor) {
    let s = min(rect.width / 464, rect.height / 544)
    c.saveGState()
    c.translateBy(x: rect.midX - 232 * s, y: rect.midY - 272 * s)
    c.scaleBy(x: s, y: s)
    func bar(_ r: CGRect, _ color: CGColor) {
        c.setFillColor(color)
        c.addPath(CGPath(roundedRect: r, cornerWidth: 44, cornerHeight: 44, transform: nil))
        c.fillPath()
    }
    bar(CGRect(x: 0, y: 0, width: 200, height: 544), ghost)      // 일반계좌
    bar(CGRect(x: 264, y: 304, width: 200, height: 240), accent) // ISA
    c.setStrokeColor(accent); c.setLineWidth(44); c.setLineCap(.round); c.setLineJoin(.round)
    c.move(to: CGPoint(x: 294, y: 120)); c.addLine(to: CGPoint(x: 364, y: 196)); c.addLine(to: CGPoint(x: 434, y: 120))
    c.strokePath()
    c.restoreGState()
}

func text(_ c: CGContext, _ s: String, font: String, size: CGFloat, color: CGColor, x: CGFloat, baseline y: CGFloat, canvasHeight h: CGFloat) {
    let attr = [kCTFontAttributeName: CTFontCreateWithName(font as CFString, size, nil), kCTForegroundColorAttributeName: color] as CFDictionary
    let line = CTLineCreateWithAttributedString(CFAttributedStringCreate(nil, s as CFString, attr)!)
    c.saveGState()
    c.translateBy(x: 0, y: h); c.scaleBy(x: 1, y: -1) // CoreText는 좌하단 원점
    c.textPosition = CGPoint(x: x, y: h - y)
    CTLineDraw(line, c)
    c.restoreGState()
}

let root = CommandLine.arguments.count > 1 ? CommandLine.arguments[1] : "."
let assets = "\(root)/apps/mobile/assets", store = "\(root)/docs/store"
try FileManager.default.createDirectory(atPath: store, withIntermediateDirectories: true)

let iconMark = CGRect(x: 262, y: 242, width: 500, height: 540)
let safeMark = CGRect(x: 312, y: 302, width: 400, height: 420) // 안드로이드 적응형 아이콘 안전 영역(지름 66/108) 안쪽
func icon(_ c: CGContext) { background(c, height: 1024); mark(c, fit: iconMark, ghost: ghost, accent: mint) }

png("\(assets)/icon.png", 1024, 1024, opaque: true, icon)
// iOS 18+ 다크·틴트 아이콘. 다크는 투명 배경(시스템이 어두운 배경을 깐다), 틴트는 검정 바탕에 흰 마크(밝을수록 색이 입혀진다)
png("\(assets)/icon-dark.png", 1024, 1024, opaque: false) { mark($0, fit: iconMark, ghost: ghost, accent: mint) }
png("\(assets)/icon-tinted.png", 1024, 1024, opaque: true) { c in
    c.setFillColor(rgb(0x000000)); c.fill(CGRect(x: 0, y: 0, width: 1024, height: 1024))
    mark(c, fit: iconMark, ghost: rgb(0xFFFFFF, 0.45), accent: rgb(0xFFFFFF))
}
png("\(assets)/android-icon-background.png", 1024, 1024, opaque: true) { background($0, height: 1024) }
png("\(assets)/android-icon-foreground.png", 1024, 1024, opaque: false) { mark($0, fit: safeMark, ghost: ghost, accent: mint) }
png("\(assets)/android-icon-monochrome.png", 1024, 1024, opaque: false) { mark($0, fit: safeMark, ghost: rgb(0xFFFFFF, 0.45), accent: rgb(0xFFFFFF)) }
png("\(assets)/splash-icon.png", 1024, 1024, opaque: false) { mark($0, fit: CGRect(x: 272, y: 252, width: 480, height: 520), ghost: rgb(0x1F4E9C, 0.22), accent: rgb(0x0F9B72)) }
png("\(assets)/favicon.png", 48, 48, opaque: true) { c in c.scaleBy(x: 48 / 1024, y: 48 / 1024); icon(c) }
png("\(store)/play-icon-512.png", 512, 512, opaque: false) { c in c.scaleBy(x: 0.5, y: 0.5); icon(c) }
png("\(store)/feature-graphic.png", 1024, 500, opaque: true) { c in
    background(c, height: 500)
    mark(c, fit: CGRect(x: 96, y: 110, width: 240, height: 280), ghost: ghost, accent: mint)
    text(c, "덜내", font: "AppleSDGothicNeo-Bold", size: 132, color: rgb(0xFFFFFF), x: 392, baseline: 250, canvasHeight: 500)
    text(c, "일반계좌와 ISA 세금 차이를 한 화면에", font: "AppleSDGothicNeo-Medium", size: 34, color: rgb(0xFFFFFF, 0.88), x: 396, baseline: 322, canvasHeight: 500)
}
