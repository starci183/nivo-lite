import { askedSchema, doneSchema, stepInputSchema, subjectSchema } from "./agent-graph-node-step.schema"

/** A record of `count` members, each holding `value`. */
const membersOf = (count: number, value: unknown): Record<string, unknown> =>
    Object.fromEntries(Array.from({ length: count }, (_unused, index) => [`k${String(index)}`, value]))

describe("agent-graph-node-step.schema", () => {
    it("reads a step input with a nested trigger of every JSON kind and an optional approval", () => {
        const trigger = {
            text: "hi",
            amount: 5,
            paid: true,
            none: null,
            gone: undefined,
            list: [1, "a"],
            nested: { a: [{ b: 1 }] },
        }

        expect(stepInputSchema.safeParse({ versionId: "v-1", nodeKey: "n-1", trigger }).success).toBe(true)
        expect(
            stepInputSchema.safeParse({
                versionId: "v-1",
                nodeKey: "n-1",
                trigger: {},
                approval: { stepKey: "s-1", by: "member-1", fingerprint: "f" },
            }).success,
        ).toBe(true)
    })

    it("refuses a step input with an empty key, a trigger or nested object over 500 members, or a list over 500", () => {
        expect(stepInputSchema.safeParse({ versionId: "", nodeKey: "n-1", trigger: {} }).success).toBe(false)
        expect(
            stepInputSchema.safeParse({ versionId: "v-1", nodeKey: "n-1", trigger: membersOf(501, 1) }).success,
        ).toBe(false)
        expect(
            stepInputSchema.safeParse({ versionId: "v-1", nodeKey: "n-1", trigger: { nested: membersOf(501, 1) } })
                .success,
        ).toBe(false)
        expect(
            stepInputSchema.safeParse({ versionId: "v-1", nodeKey: "n-1", trigger: { list: Array(501).fill(1) } })
                .success,
        ).toBe(false)
    })

    it("reads the effects of a done step and refuses one whose effect names no subject", () => {
        expect(doneSchema.safeParse({ effects: [{ id: "e-1", subject: { kind: "order", id: "o-1" } }] }).success).toBe(
            true,
        )
        expect(doneSchema.safeParse({ effects: [{ id: "e-1" }] }).success).toBe(false)
    })

    it("reads a subject and an asked item, and refuses an empty id or fingerprint", () => {
        expect(subjectSchema.safeParse({ kind: "order", id: "o-1" }).success).toBe(true)
        expect(subjectSchema.safeParse({ kind: "order", id: "" }).success).toBe(false)
        expect(askedSchema.safeParse({ fields: { fingerprint: "f" } }).success).toBe(true)
        expect(askedSchema.safeParse({ fields: { fingerprint: "" } }).success).toBe(false)
    })
})
