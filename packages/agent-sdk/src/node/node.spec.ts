import { z } from "zod"
import { SdkDefinitionError } from "../block/definition-error"
import { rightsGaps } from "../rights/rights"
import type { DataRight } from "../rights/rights.types"
import { sampleNodeContext } from "../tests/fixtures/node-context"
import { defineNode } from "./node"
import { RightsDeniedError } from "./rights-denied-error"

const READ_ORDERS: DataRight = { kind: "order", access: "read", scope: "turn", fields: ["id", "total"] }

const node = defineNode({
    id: "sales.total",
    role: "execute",
    title: { key: "t" },
    input: z.object({ id: z.string().max(100) }),
    output: z.object({ total: z.number() }),
    rights: [READ_ORDERS],
    effects: ["sales.total-read"],
    run: async (input, context) => {
        const [row] = await context.data.read<{ total: number }>("order", {
            where: { id: input.id },
            fields: ["total"],
        })
        context.effect("sales.total-read", { kind: "order", id: input.id })
        return { total: row?.total ?? 0 }
    },
    examples: [{ name: "one", input: { id: "o1" }, output: { total: 5 }, effects: ["sales.total-read"] }],
})

describe("defineNode", () => {
    it("defines a step that runs under a fake context with its store and records its effect", async () => {
        const context = sampleNodeContext({
            grant: { rights: [READ_ORDERS] },
            store: { order: [{ id: "o1", total: 5 }] },
            now: new Date(5),
            turn: { turnId: "t9" },
        })
        await expect(node.run({ id: "o1" }, context)).resolves.toEqual({ total: 5 })
        expect(context.effects).toEqual([{ kind: "sales.total-read", subject: { kind: "order", id: "o1" } }])
        expect(context.turn.turnId).toBe("t9")
        expect(context.now().getTime()).toBe(5)
    })

    it("refuses a malformed node or effect id", () => {
        const config = {
            role: "output",
            title: { key: "t" },
            input: z.object({}),
            output: z.object({}),
            rights: [],
            run: () => Promise.resolve({}),
            examples: [{ name: "e", input: {}, output: {}, effects: [] }],
        } as const
        expect(() => defineNode({ ...config, id: "Bad.x", effects: [] })).toThrow(SdkDefinitionError)
        expect(() => defineNode({ ...config, id: "ok.node", effects: ["Bad.x"] })).toThrow(SdkDefinitionError)
    })
})

describe("sampleNodeContext", () => {
    it("denies by default, for reads without fields, and for writes outside the grant", () => {
        const context = sampleNodeContext()
        expect(() => context.data.read("order", { fields: ["id"] })).toThrow(RightsDeniedError)
        expect(() => context.data.read("order", { fields: [] })).toThrow(RightsDeniedError)
        expect(() => context.data.write("order", { id: "1" })).toThrow(RightsDeniedError)
    })

    it("limits and cuts rows, filters by where, and records allowed writes", async () => {
        const write: DataRight = { kind: "order", access: "write", scope: "turn", fields: ["id"] }
        const context = sampleNodeContext({
            grant: { rights: [READ_ORDERS, write] },
            store: {
                order: [
                    { id: "1", total: 1 },
                    { id: "2", total: 2 },
                    { id: "3", total: 3 },
                ],
            },
        })
        await expect(context.data.read("order", { fields: ["id"], limit: 2 })).resolves.toEqual([
            { id: "1" },
            { id: "2" },
        ])
        await expect(context.data.read("order", { fields: ["total"], where: { id: "3" } })).resolves.toEqual([
            { total: 3 },
        ])
        await expect(context.data.write("order", { id: "9" })).resolves.toEqual({ kind: "order", id: "order-1" })
        expect(context.writes).toEqual([{ kind: "order", record: { id: "9" } }])
    })
})

describe("sampleNodeContext defaults", () => {
    it("reads nothing from an empty store, writes a record without fields, and tells the epoch", async () => {
        const write: DataRight = { kind: "order", access: "write", scope: "turn", fields: ["id"] }
        const context = sampleNodeContext({ grant: { rights: [READ_ORDERS, write] } })
        await expect(context.data.read("order", { fields: ["id"] })).resolves.toEqual([])
        await expect(context.data.write("order", {})).resolves.toMatchObject({ kind: "order" })
        expect(context.now().getTime()).toBe(0)
    })
})

describe("rightsGaps", () => {
    const held: DataRight = { kind: "order", access: "read", scope: "workspace", fields: ["id", "total"] }

    it("is empty when covered, and workspace covers turn", () => {
        expect(rightsGaps({ rights: [held] }, [READ_ORDERS])).toEqual([])
    })

    it("names a missing kind, access, scope and fields", () => {
        expect(rightsGaps({ rights: [] }, [READ_ORDERS])[0]?.missing).toBe("kind")
        expect(rightsGaps({ rights: [{ ...held, access: "write" }] }, [READ_ORDERS])[0]?.missing).toBe("access")
        expect(
            rightsGaps({ rights: [{ ...held, scope: "turn" }] }, [{ ...READ_ORDERS, scope: "workspace" }])[0]?.missing,
        ).toBe("scope")
        expect(rightsGaps({ rights: [held] }, [{ ...READ_ORDERS, fields: ["id", "secret"] }])[0]?.missing).toEqual([
            "secret",
        ])
        const two = [
            { ...held, access: "write" as const },
            { ...held, scope: "turn" as const },
        ]
        expect(rightsGaps({ rights: two }, [{ ...READ_ORDERS, scope: "workspace" }])[0]?.missing).toBe("access")
    })
})
