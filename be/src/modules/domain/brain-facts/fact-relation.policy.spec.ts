import { Test } from "@nestjs/testing"
import type { RelationInput } from "./brain-facts.contracts"
import {
    carriedRelationsOf as realCarriedRelationsOf,
    checkRelation as realCheckRelation,
    otherEnd as realOtherEnd,
} from "./fact-relation.policy"

const SUBJECT = Symbol("fact-relation.policy")
const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
const B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"

/** The policy as a Nest value. */
interface Policy {
    readonly checkRelation: typeof realCheckRelation
    readonly otherEnd: typeof realOtherEnd
    readonly carriedRelationsOf: typeof realCarriedRelationsOf
}

const build = async (): Promise<Policy> => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: {
                    checkRelation: realCheckRelation,
                    otherEnd: realOtherEnd,
                    carriedRelationsOf: realCarriedRelationsOf,
                },
            },
        ],
    }).compile()
    return moduleRef.get<Policy>(SUBJECT)
}

/** An edge input between A and B. */
const inputOf = (_kind: "related", changes: Partial<RelationInput> = {}): RelationInput => ({
    fromFactId: A,
    toFactId: B,
    createdBy: "Ada",
    kind: "related",
    ...changes,
})

describe("fact-relation.policy", () => {
    it("keeps two different facts with a known kind and a trimmed short label", async () => {
        const policy = await build()

        expect(policy.checkRelation({ ...inputOf("related"), kind: "applies_to", label: "  applies  ", createdBy: " Ada " })).toEqual({
            ok: true,
            relation: { fromFactId: A, toFactId: B, kind: "applies_to", label: "applies", createdBy: "Ada" },
        })
    })

    it("refuses an edge from a fact to itself, of an unknown kind, or with a long label", async () => {
        const policy = await build()

        expect(policy.checkRelation(inputOf("related", { toFactId: A }))).toEqual({ ok: false, reason: "self" })
        expect(policy.checkRelation({ ...inputOf("related"), kind: JSON.parse('"owns"') })).toEqual({ ok: false, reason: "kind" })
        expect(policy.checkRelation(inputOf("related", { label: "x".repeat(81) }))).toEqual({ ok: false, reason: "label" })
    })

    it("reads the other end of an edge from either fact, and none from a third", async () => {
        const policy = await build()

        expect(policy.otherEnd({ fromFactId: A, toFactId: B }, A)).toBe(B)
        expect(policy.otherEnd({ fromFactId: A, toFactId: B }, B)).toBe(A)
        expect(policy.otherEnd({ fromFactId: A, toFactId: B }, "c")).toBeNull()
    })

    it("carries an old value's edges to the new value, never an edge between the two values", async () => {
        const policy = await build()
        const edge = { id: "e", kind: "related" as const, label: null, createdBy: "NIVO", createdAt: "" }

        expect(
            policy.carriedRelationsOf(
                [
                    { ...edge, fromFactId: A, toFactId: "c" },
                    { ...edge, fromFactId: B, toFactId: A },
                ],
                A,
                B,
            ),
        ).toEqual([{ fromFactId: B, toFactId: "c", kind: "related", label: null, createdBy: "NIVO" }])
    })
})
