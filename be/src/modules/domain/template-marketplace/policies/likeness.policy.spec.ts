import { Test } from "@nestjs/testing"
import type { LikenessClaim } from "@nivo-lite/agent-sdk/template"
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

const SUBJECT = Symbol("likeness.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { consentCovers } }],
    }).compile()
    return moduleRef.get<{ consentCovers: typeof consentCovers }>(SUBJECT)
}

describe("consentCovers", () => {
    it("needs no consent for a neutral persona", async () => {
        const subject = await build()

        expect(subject.consentCovers(null, [], NOW)).toBe(true)
    })

    it("accepts a consent of the same person, ignoring case and spaces, that allows every use claimed", async () => {
        const subject = await build()

        expect(subject.consentCovers(CLAIM, [record()], NOW)).toBe(true)
        expect(subject.consentCovers(CLAIM, [record({ expiresAt: new Date("2027-01-01T00:00:00.000Z") })], NOW)).toBe(
            true,
        )
    })

    it("refuses a consent of someone else, one that does not allow a use claimed, one that ended and one the person took back", async () => {
        const subject = await build()

        expect(subject.consentCovers(CLAIM, [], NOW)).toBe(false)
        expect(subject.consentCovers(CLAIM, [record({ personName: "Someone Else" })], NOW)).toBe(false)
        expect(subject.consentCovers(CLAIM, [record({ allowedUses: ["name"] })], NOW)).toBe(false)
        expect(subject.consentCovers(CLAIM, [record({ expiresAt: new Date("2026-11-02T00:00:00.000Z") })], NOW)).toBe(
            false,
        )
        expect(subject.consentCovers(CLAIM, [record({ revokedAt: new Date("2026-11-01T00:00:00.000Z") })], NOW)).toBe(
            false,
        )
    })

    it("lets one valid record carry the persona when another has been taken back", async () => {
        const subject = await build()

        expect(subject.consentCovers(CLAIM, [record({ revokedAt: NOW }), record()], NOW)).toBe(true)
    })
})
