import XCTest

@MainActor
final class WrapperUITests: XCTestCase {
    private let app = XCUIApplication()

    override func setUp() {
        continueAfterFailure = false
    }

    func testBundledPagesAndPracticeControls() {
        app.launch()
        assertPage("Find Any Note")

        navigate(to: "Daily session")
        assertPage("Daily Session")

        navigate(to: "Scales")
        assertPage("Scales")

        navigate(to: "Call & response")
        assertPage("Call & Response")
        XCTAssertTrue(button(startingWith: "Start the band").waitForExistence(timeout: 8))

        navigate(to: "Rhythm")
        assertPage("Rhythm")

        navigate(to: "Song writing 写歌")
        assertPage("Song Writing")
        XCTAssertTrue(web.textFields["Song title"].waitForExistence(timeout: 8))

        navigate(to: "Find any note")
        assertPage("Find Any Note")
    }

    func testPracticeSettingsSurviveRelaunchAndADrillStarts() {
        app.launch()
        assertPage("Find Any Note")
        web.swipeUp()
        selectDrill("One note everywhere")
        selectDrill("Flash cards")
        XCTAssertTrue(drillOption("Naturals").waitForExistence(timeout: 8), "Flash card settings did not appear")

        navigate(to: "Rhythm")
        assertPage("Rhythm")
        app.terminate()
        app.launch()
        XCTAssertTrue(drillOption("Naturals").waitForExistence(timeout: 8), "Flash card mode did not survive relaunch")

        web.swipeUp(velocity: .slow)
        let start = button(startingWith: "Start")
        XCTAssertTrue(start.waitForExistence(timeout: 8))
        start.tap()
        assertText("Flash cards")
        let skip = button(startingWith: "Skip")
        XCTAssertTrue(skip.waitForExistence(timeout: 8))
        skip.tap()
        button(startingWith: "Stop").tap()
        let change = web.buttons["Change drill"]
        XCTAssertTrue(change.waitForExistence(timeout: 8))
        change.tap()
        selectDrill("One note everywhere")
    }

    func testMicrophoneAndRhythmWorklet() {
        app.launch()
        navigate(to: "Rhythm")
        let mic = web.buttons["Enable microphone"]
        XCTAssertTrue(mic.waitForExistence(timeout: 8))
        mic.tap()
        allowMicrophoneIfPrompted()

        let listening = web.buttons.containing(NSPredicate(format: "label IN %@", ["Listening", "Interface"])).firstMatch
        XCTAssertTrue(listening.waitForExistence(timeout: 10), "WKWebView could not open the microphone")

        let start = button(startingWith: "Start")
        XCTAssertTrue(start.exists)
        start.tap()
        let stop = button(startingWith: "Stop")
        XCTAssertTrue(stop.waitForExistence(timeout: 10), "Rhythm did not start after loading the bundled AudioWorklet")
        stop.tap()
        XCTAssertTrue(start.waitForExistence(timeout: 8))
    }

    func testBundledArpeggioPracticeStartsAndStops() {
        app.launch()
        navigate(to: "Scales")
        let arpeggios = web.descendants(matching: .any).matching(NSPredicate(
            format: "label BEGINSWITH %@ AND elementType != %d", "Arpeggios", XCUIElement.ElementType.staticText.rawValue
        )).firstMatch
        XCTAssertTrue(arpeggios.waitForExistence(timeout: 8))
        arpeggios.tap()
        assertText("A7 arpeggio · position 1")
        assertText("A7 chord tones")

        let start = button(startingWith: "Start")
        XCTAssertTrue(start.waitForExistence(timeout: 8))
        if !start.isHittable { web.swipeUp() }
        start.tap()
        let stop = button(startingWith: "Stop")
        XCTAssertTrue(stop.waitForExistence(timeout: 8))
        stop.tap()
        XCTAssertTrue(start.waitForExistence(timeout: 8))
    }

    private var web: XCUIElement { app.webViews.firstMatch }

    private func navigate(to name: String, file: StaticString = #filePath, line: UInt = #line) {
        let link = web.links[name]
        XCTAssertTrue(link.waitForExistence(timeout: 8), "Missing link to \(name)", file: file, line: line)
        link.tap()
    }

    private func assertText(_ text: String, file: StaticString = #filePath, line: UInt = #line) {
        let label = web.staticTexts.containing(NSPredicate(format: "label ==[c] %@", text)).firstMatch
        XCTAssertTrue(label.waitForExistence(timeout: 8), "Missing \(text)", file: file, line: line)
    }

    private func assertPage(_ title: String, file: StaticString = #filePath, line: UInt = #line) {
        let page = web.otherElements["\(title) · Fretboard Freedom"].firstMatch
        XCTAssertTrue(page.waitForExistence(timeout: 8), "Could not open \(title)", file: file, line: line)
    }

    private func button(startingWith text: String) -> XCUIElement {
        web.buttons.containing(NSPredicate(format: "label BEGINSWITH %@", text)).firstMatch
    }

    private func selectDrill(_ name: String) {
        let drill = drillOption(name)
        XCTAssertTrue(drill.waitForExistence(timeout: 8), "Missing drill option \(name)")
        drill.tap()
    }

    private func drillOption(_ name: String) -> XCUIElement {
        web.descendants(matching: .any).matching(NSPredicate(
            format: "label == %@ AND elementType != %d", name, XCUIElement.ElementType.staticText.rawValue
        )).firstMatch
    }

    private func allowMicrophoneIfPrompted() {
        let springboard = XCUIApplication(bundleIdentifier: "com.apple.springboard")
        let allow = springboard.alerts.buttons.matching(NSPredicate(format: "label IN %@", ["Allow", "OK"])).firstMatch
        if allow.waitForExistence(timeout: 3) { allow.tap() }
    }
}
