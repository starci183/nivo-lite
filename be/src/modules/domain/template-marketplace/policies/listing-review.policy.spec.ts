import { Test } from "@nestjs/testing"
import { nextStatus } from "./listing-review.policy"

const SUBJECT = Symbol("listing-review.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { nextStatus } }],
    }).compile()
    return moduleRef.get<{ nextStatus: typeof nextStatus }>(SUBJECT)
}

describe("nextStatus: the review of a listing", () => {
    it("submits a draft or a rejected listing when its checks pass, and leaves a draft a draft when they fail", async () => {
        const subject = await build()

        expect(subject.nextStatus("draft", "submit", true)).toBe("submitted")
        expect(subject.nextStatus("rejected", "submit", true)).toBe("submitted")
        expect(subject.nextStatus("draft", "submit", false)).toBe("draft")
    })

    it("lets only a submitted listing be approved or rejected", async () => {
        const subject = await build()

        expect(subject.nextStatus("submitted", "approve", true)).toBe("approved")
        expect(subject.nextStatus("submitted", "reject", true)).toBe("rejected")
        for (const status of ["draft", "approved", "rejected"] as const) {
            expect(subject.nextStatus(status, "approve", true)).toBeNull()
            expect(subject.nextStatus(status, "reject", true)).toBeNull()
        }
    })

    it("keeps an approved or a submitted listing from being submitted again", async () => {
        const subject = await build()

        expect(subject.nextStatus("approved", "submit", true)).toBeNull()
        expect(subject.nextStatus("submitted", "submit", true)).toBeNull()
    })
})
