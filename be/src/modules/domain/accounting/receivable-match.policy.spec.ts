import { Test } from "@nestjs/testing"
import { matchReceivable } from "./receivable-match.policy"

const SUBJECT = Symbol("receivable-match.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { matchReceivable } }],
    }).compile()
    return moduleRef.get<typeof import("./receivable-match.policy")>(SUBJECT)
}

describe("receivable-match.policy", () => {
    it("reads an exact, partial or over payment against the balance due", async () => {
        const policy = await build()
        const receivable = { receivableId: "rc-1", balanceVnd: 12_800_000 }

        expect(policy.matchReceivable(receivable, 12_800_000)).toBe("exact")
        expect(policy.matchReceivable(receivable, 5_000_000)).toBe("partial")
        expect(policy.matchReceivable(receivable, 13_000_000)).toBe("over")
    })

    it("reads a receivable with nothing due as settled", async () => {
        const policy = await build()

        expect(policy.matchReceivable({ receivableId: "rc-1", balanceVnd: 0 }, 100)).toBe("settled")
    })
})
