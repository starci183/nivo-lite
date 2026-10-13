import { transferDetailsOf } from "./transfer-details.policy"

/** The Vietnamese label, built from code points so the spec stays ASCII. */
const VIETNAMESE_LABEL = ["th", 0xf4, "ng tin chuy", 0x1ec3, "n kho", 0x1ea3, "n"]
    .map((part) => (typeof part === "string" ? part : String.fromCodePoint(part)))
    .join("")

describe("transferDetailsOf", () => {
    it("reads the English bank-transfer line", () => {
        expect(transferDetailsOf("Hours: 8-5\nBank Transfer Details: 9704 123\nThanks")).toBe("9704 123")
    })

    it("reads the English payment-details line", () => {
        expect(transferDetailsOf("payment details: VCB 001")).toBe("VCB 001")
    })

    it("reads the Vietnamese label", () => {
        expect(transferDetailsOf(`${VIETNAMESE_LABEL}: 9704 999`)).toBe("9704 999")
    })

    it("reads a bulleted line and a fullwidth colon", () => {
        expect(transferDetailsOf(`\u2022 bank transfer details\uff1a  VCB 002  `)).toBe("VCB 002")
    })

    it("reads a dashed line across a Windows break", () => {
        expect(transferDetailsOf("- payment details: ACB 7\r\nnext")).toBe("ACB 7")
    })

    it("reads a starred line", () => {
        expect(transferDetailsOf("* Bank transfer details: TCB 3")).toBe("TCB 3")
    })

    it("answers nothing when the knowledge has no details line", () => {
        expect(transferDetailsOf("We deliver in Hue.")).toBeNull()
    })

    it("answers nothing for empty knowledge", () => {
        expect(transferDetailsOf("")).toBeNull()
    })

    it("answers nothing when no knowledge was passed", () => {
        expect(transferDetailsOf(null)).toBeNull()
        expect(transferDetailsOf(undefined)).toBeNull()
    })
})
