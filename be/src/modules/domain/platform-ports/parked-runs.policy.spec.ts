import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { PARKED_LOOKED_AT, errorKeyOf } from "./parked-runs.policy"

interface Subject {
    readonly errorKeyOf: typeof errorKeyOf
    readonly lookedAt: number
}

const SUBJECT = Symbol("parked-runs.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: mock<Subject>({ errorKeyOf, lookedAt: PARKED_LOOKED_AT }) }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

describe("parked runs policy", () => {
    it("keys the words of a failure code and looks at a hundred runs", async () => {
        const policy = await build()
        expect(policy.errorKeyOf("X")).toBe("errors.X")
        expect(policy.lookedAt).toBe(100)
    })
})
