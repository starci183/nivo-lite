import { nextStatus } from "./listing-review.policy"

describe("nextStatus: the review of a listing", () => {
    it("submits a draft or a rejected listing when its checks pass, and leaves a draft a draft when they fail", () => {
        expect(nextStatus("draft", "submit", true)).toBe("submitted")
        expect(nextStatus("rejected", "submit", true)).toBe("submitted")
        expect(nextStatus("draft", "submit", false)).toBe("draft")
    })

    it("lets only a submitted listing be approved or rejected", () => {
        expect(nextStatus("submitted", "approve", true)).toBe("approved")
        expect(nextStatus("submitted", "reject", true)).toBe("rejected")
        for (const status of ["draft", "approved", "rejected"] as const) {
            expect(nextStatus(status, "approve", true)).toBeNull()
            expect(nextStatus(status, "reject", true)).toBeNull()
        }
    })

    it("keeps an approved or a submitted listing from being submitted again", () => {
        expect(nextStatus("approved", "submit", true)).toBeNull()
        expect(nextStatus("submitted", "submit", true)).toBeNull()
    })
})
