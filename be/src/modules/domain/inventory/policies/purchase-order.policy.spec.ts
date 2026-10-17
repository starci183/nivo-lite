import { Test } from "@nestjs/testing"
import { poNumberOf, poNumberPrefix } from "./purchase-order.policy"

const SUBJECT = Symbol("purchase-order.policy")

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { poNumberPrefix, poNumberOf } }],
    }).compile()
    return moduleRef.get<typeof import("./purchase-order.policy")>(SUBJECT)
}

describe("poNumberPrefix", () => {
    it("names the month of the instant", async () => {
        const subject = await buildSubject()

        expect(subject.poNumberPrefix(new Date("2026-10-12T08:00:00.000Z"))).toBe("PO-202610-")
        expect(subject.poNumberPrefix(new Date("2027-01-02T00:00:00.000Z"))).toBe("PO-202701-")
    })
})

describe("poNumberOf", () => {
    it("starts a month at one", async () => {
        const subject = await buildSubject()

        expect(subject.poNumberOf("PO-202610-", null)).toBe("PO-202610-0001")
    })

    it("follows the last number of the month", async () => {
        const subject = await buildSubject()

        expect(subject.poNumberOf("PO-202610-", "PO-202610-0041")).toBe("PO-202610-0042")
    })

    it("starts again when the last number has no readable sequence", async () => {
        const subject = await buildSubject()

        expect(subject.poNumberOf("PO-202610-", "PO-202610-xyz")).toBe("PO-202610-0001")
    })
})
