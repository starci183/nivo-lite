import { Test } from "@nestjs/testing"
import type { EntityDefinition } from "@nivo-lite/agent-sdk/entity"
import type { EntityNodeTurn } from "./entity-node.contracts"
import { limitOf, nodeReadPlanOf, nodeRowOf, turnPathOf } from "./entity-node-read.policy"

const NODE_READ: unique symbol = Symbol("entity-node.node-read")

interface NodeReadPolicy {
    readonly limitOf: typeof limitOf
    readonly nodeReadPlanOf: typeof nodeReadPlanOf
    readonly nodeRowOf: typeof nodeRowOf
    readonly turnPathOf: typeof turnPathOf
}

const build = async (): Promise<NodeReadPolicy> => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: NODE_READ,
                useFactory: (): NodeReadPolicy => ({ limitOf, nodeReadPlanOf, nodeRowOf, turnPathOf }),
            },
        ],
    }).compile()
    return moduleRef.get<NodeReadPolicy>(NODE_READ)
}

const ORDER: EntityDefinition = {
    entry: "entity",
    name: "sales.order",
    dataKind: "order",
    fields: { total: { kind: "int", nullable: false } },
}

const MESSAGE: EntityDefinition = {
    entry: "entity",
    name: "chat.message",
    dataKind: "message",
    fields: {
        body: { kind: "text", nullable: false, maxLength: 4000 },
        note: { kind: "text", nullable: true, maxLength: 100 },
    },
    relations: {
        conversation: { kind: "toOne", target: "chat.conversation" },
        replies: { kind: "toMany", target: "chat.message" },
    },
}

const KINDS: Readonly<Record<string, string>> = { "chat.conversation": "conversation", "sales.order": "order" }
const kindOf = (name: string): string | undefined => KINDS[name]

const WS = "11111111-1111-4111-8111-111111111111"
const TURN: EntityNodeTurn = { workspaceId: WS, subject: null, conversationId: null }
const AT = "2026-11-06T10:00:00.000Z"

describe("limitOf", () => {
    it("keeps the limit within one and the page ceiling, and defaults to fifty", async () => {
        const policy = await build()
        expect(policy.limitOf({ fields: ["a"] })).toBe(50)
        expect(policy.limitOf({ fields: ["a"], limit: 7.9 })).toBe(7)
        expect(policy.limitOf({ fields: ["a"], limit: 0 })).toBe(1)
        expect(policy.limitOf({ fields: ["a"], limit: 5000 })).toBe(100)
    })
})

describe("turnPathOf", () => {
    it("is the turn's subject when it is a record of the entity itself", async () => {
        const policy = await build()
        const turn = { ...TURN, subject: { kind: "order", id: "o-1" } }
        expect(policy.turnPathOf(ORDER, kindOf, turn)).toEqual({ relation: null, id: "o-1" })
    })

    it("is the relation that links the entity to the subject, or to the conversation the turn serves", async () => {
        const policy = await build()
        expect(policy.turnPathOf(MESSAGE, kindOf, { ...TURN, subject: { kind: "conversation", id: "c-1" } })).toEqual({
            relation: "conversation",
            id: "c-1",
        })
        expect(policy.turnPathOf(MESSAGE, kindOf, { ...TURN, conversationId: "c-2" })).toEqual({
            relation: "conversation",
            id: "c-2",
        })
    })

    it("prefers the entity's own record to a linked one, and answers null when no record of the turn is reachable", async () => {
        const policy = await build()
        const both = { ...TURN, subject: { kind: "order", id: "o-1" }, conversationId: "c-1" }
        expect(policy.turnPathOf(ORDER, kindOf, both)).toEqual({ relation: null, id: "o-1" })
        expect(policy.turnPathOf(ORDER, kindOf, TURN)).toBeNull()
        expect(policy.turnPathOf(MESSAGE, kindOf, { ...TURN, subject: { kind: "order", id: "o-1" } })).toBeNull()
    })
})

describe("nodeReadPlanOf", () => {
    it("lists a workspace read newest first under the equalities, with only the declared fields selected", async () => {
        const policy = await build()
        const plan = policy.nodeReadPlanOf(
            ORDER,
            kindOf,
            TURN,
            { where: { total: 5, id: "o-1" }, fields: ["id", "total", "total"], limit: 20 },
            "workspace",
        )
        expect(plan).toEqual({
            query: {
                from: "sales.order",
                select: ["total"],
                where: {
                    op: "and",
                    of: [
                        { op: "eq", field: "total", value: 5 },
                        { op: "eq", field: "id", value: "o-1" },
                    ],
                },
                order: [
                    ["createdAt", "desc"],
                    ["id", "desc"],
                ],
                page: { size: 20 },
            },
            via: null,
            anchor: "",
            limit: 20,
        })
    })

    it("filters by the one equality alone, without a group", async () => {
        const policy = await build()
        const plan = policy.nodeReadPlanOf(ORDER, kindOf, TURN, { where: { total: 5 }, fields: ["total"] }, "workspace")
        expect(plan?.query.where).toEqual({ op: "eq", field: "total", value: 5 })
    })

    it("has no condition when the query names no equality", async () => {
        const policy = await build()
        const plan = policy.nodeReadPlanOf(ORDER, kindOf, TURN, { fields: ["total"] }, "workspace")
        expect(plan?.query).not.toHaveProperty("where")
        expect(plan?.query.page).toEqual({ size: 50 })
    })

    it("adds the turn's own record as the id filter of a turn read", async () => {
        const policy = await build()
        const turn = { ...TURN, subject: { kind: "order", id: "o-1" } }
        const plan = policy.nodeReadPlanOf(ORDER, kindOf, turn, { where: { total: 5 }, fields: ["total"] }, "turn")
        expect(plan?.query.where).toEqual({
            op: "and",
            of: [
                { op: "eq", field: "total", value: 5 },
                { op: "eq", field: "id", value: "o-1" },
            ],
        })
        expect(plan?.via).toBeNull()
    })

    it("joins the relation to the turn's record and scans full pages for a linked turn read", async () => {
        const policy = await build()
        const plan = policy.nodeReadPlanOf(
            MESSAGE,
            kindOf,
            { ...TURN, conversationId: "c-1" },
            { fields: ["body"], limit: 5 },
            "turn",
        )
        expect(plan).toMatchObject({ via: "conversation", anchor: "c-1", limit: 5 })
        expect(plan?.query.join).toEqual({ conversation: [] })
        expect(plan?.query.page).toEqual({ size: 100 })
    })

    it("answers no plan for a turn read that reaches no record of the turn", async () => {
        const policy = await build()
        expect(policy.nodeReadPlanOf(ORDER, kindOf, TURN, { fields: ["total"] }, "turn")).toBeNull()
    })
})

describe("nodeRowOf", () => {
    it("cuts a record to the fields asked: system fields from the record, declared ones from its data, absent ones as null", async () => {
        const policy = await build()
        const record = {
            id: "m-1",
            workspaceId: WS,
            version: "3",
            createdAt: AT,
            updatedAt: AT,
            data: { body: "hi", note: null },
        }
        expect(
            policy.nodeRowOf(record, [
                "id",
                "version",
                "createdAt",
                "updatedAt",
                "body",
                "note",
                "ghost",
                "constructor",
            ]),
        ).toEqual({
            id: "m-1",
            version: "3",
            createdAt: AT,
            updatedAt: AT,
            body: "hi",
            note: null,
            ghost: null,
            constructor: null,
        })
    })
})
