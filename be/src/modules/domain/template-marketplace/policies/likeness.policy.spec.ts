import type { LikenessClaim } from "@nivo/agent-sdk/template"
import { consentCovers } from "./likeness.policy"
import type { ConsentRecord } from "./likeness.policy"

const NOW = new Date("2026-11-03T00:00:00.000Z")
const CLAIM: LikenessClaim = {
    personName: "Ngoc Trinh",
    allowedUses: ["name", "voice_style"],
    disclosure: "Tro ly AI cua Ngoc Trinh",
}
const record = (over: Partial<ConsentRecord> = {}): ConsentRecord => ({
    personName: "ngoc trinh ",
    allowedUses: ["name", "voice_style", "avatar"],
    expiresAt: null,
    revokedAt: null,
    ...over,
})

describe("consentCovers", () => {
    it("needs no consent for a neutral persona", () => {
        expect(consentCovers(null, [], NOW)).toBe(true)
    })

    it("accepts a consent of the same person, ignoring case and spaces, that allows every use claimed", () => {
        expect(consentCovers(CLAIM, [record()], NOW)).toBe(true)
        expect(consentCovers(CLAIM, [record({ expiresAt: new Date("2027-01-01T00:00:00.000Z") })], NOW)).toBe(true)
    })

    it("refuses a consent of someone else, one that does not allow a use claimed, one that ended and one the person took back", () => {
        expect(consentCovers(CLAIM, [], NOW)).toBe(false)
        expect(consentCovers(CLAIM, [record({ personName: "Someone Else" })], NOW)).toBe(false)
        expect(consentCovers(CLAIM, [record({ allowedUses: ["name"] })], NOW)).toBe(false)
        expect(consentCovers(CLAIM, [record({ expiresAt: new Date("2026-11-02T00:00:00.000Z") })], NOW)).toBe(false)
        expect(consentCovers(CLAIM, [record({ revokedAt: new Date("2026-11-01T00:00:00.000Z") })], NOW)).toBe(false)
    })

    it("lets one valid record carry the persona when another has been taken back", () => {
        expect(consentCovers(CLAIM, [record({ revokedAt: NOW }), record()], NOW)).toBe(true)
    })
})
