import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { sourceToolSpecOf as sourceToolSpecOfSubject } from "./source-tool-spec.policy"

const SUBJECT = Symbol("source-tool-spec.policy")

describe("source-tool-spec.policy built the way Nest does", () => {
    let sourceToolSpecOf: typeof sourceToolSpecOfSubject

    beforeAll(async () => {
        const moduleRef = await Test.createTestingModule({
            providers: [{ provide: SUBJECT, useValue: mock<{ sourceToolSpecOf: typeof sourceToolSpecOfSubject }>({ sourceToolSpecOf: sourceToolSpecOfSubject }) }],
        }).compile()
        ;({ sourceToolSpecOf } = moduleRef.get<{ sourceToolSpecOf: typeof sourceToolSpecOfSubject }>(SUBJECT))
    })

describe("sourceToolSpecOf: the spec of a source's operation, from the pinned document", () => {
    const of = (method: "GET" | "POST" | "PATCH", effect: "money" | "irreversible" | "none" | null) =>
        sourceToolSpecOf({ source: "crm", dataKind: "customers", method, effect })

    it("reads a GET over every held account, owned by the source key", () => {
        expect(of("GET", null)).toEqual({
            mutates: false,
            owners: ["crm"],
            account: "each",
            dataKind: "customers",
            onceBy: [],
            refusals: { closed: false, codes: [] },
            repeatable: true,
        })
    })

    it("makes every other method a write on ONE account, its effect mark changing nothing (display only)", () => {
        const plain = of("POST", "none")
        expect(plain).toEqual({ ...of("GET", null), mutates: true, account: "any", repeatable: false })
        expect(of("POST", "money")).toEqual(plain)
        expect(of("POST", null)).toEqual(plain)
        expect(of("PATCH", "irreversible")).toEqual(plain)
    })
})
})
