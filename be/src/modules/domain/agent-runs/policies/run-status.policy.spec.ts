import { Test } from "@nestjs/testing"
import { CLOSED_RUN, statusAfter } from "./run-status.policy"

const SUBJECT = Symbol("run-status.policy")

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { statusAfter } }],
    }).compile()
    return moduleRef.get<{ statusAfter: typeof statusAfter }>(SUBJECT)
}

describe("statusAfter", () => {
    it("is running while a step follows", async () => {
        const { statusAfter } = await buildSubject()
        expect(statusAfter([{ status: "done", waitItemId: null }], true)).toBe("running")
    })

    it("is done when every step is done and none follows", async () => {
        const { statusAfter } = await buildSubject()
        expect(statusAfter([{ status: "done", waitItemId: null }], false)).toBe("done")
        expect(statusAfter([], false)).toBe("done")
    })

    it("is running while a step can run: pending, failed, or running with no wait", async () => {
        const { statusAfter } = await buildSubject()
        expect(statusAfter([{ status: "pending", waitItemId: null }], false)).toBe("running")
        expect(statusAfter([{ status: "failed", waitItemId: null }], false)).toBe("running")
        expect(statusAfter([{ status: "running", waitItemId: null }], false)).toBe("running")
    })

    it("is waiting when only a wait is open", async () => {
        const { statusAfter } = await buildSubject()
        expect(
            statusAfter(
                [
                    { status: "done", waitItemId: null },
                    { status: "running", waitItemId: "item-1" },
                ],
                false,
            ),
        ).toBe("waiting")
    })

    it("names the statuses that take no step", () => {
        expect(CLOSED_RUN).toContain("parked")
        expect(CLOSED_RUN).not.toContain("running")
    })
})
