import { Test } from "@nestjs/testing"
import { FLOW_F_ENTITIES } from "@nivo-lite/blocks-core/entities"
import type { EntityDefinition } from "@nivo-lite/agent-sdk/entity"
import type { NodeQuery } from "@nivo-lite/agent-sdk/node"
import { queryProblems } from "@nivo-lite/agent-sdk/query"
import type { EntityCatalog, FilterExpr, OrderBy, Query } from "@nivo-lite/agent-sdk/query"
import type { EntityNodeTurn } from "./entity-node.contracts"
import { isLookup, limitOf, newestOrderOf, nodeReadPlanOf, nodeRowOf, turnPathOf } from "./entity-node-read.policy"

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
    it("lists a workspace read under the equalities, with only the declared fields selected, as a lookup when it pins the id", async () => {
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
                order: [["id", "asc"]],
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

const UNIQUE: EntityDefinition = {
    entry: "entity",
    name: "payment.claim",
    dataKind: "payment-claim",
    fields: {
        dedupeKey: { kind: "text", nullable: false, maxLength: 40 },
        status: { kind: "text", nullable: false, maxLength: 20 },
    },
    indexes: [{ name: "dedupe", on: ["dedupeKey", "id"] }],
    constraints: [{ kind: "unique", name: "dedupe_key", on: ["dedupeKey"], refusal: "claim-already-recorded" }],
}

describe("isLookup", () => {
    it("is a lookup of one record when the read pins the id or every field of a unique key", () => {
        expect(isLookup(UNIQUE, ["id"])).toBe(true)
        expect(isLookup(UNIQUE, ["dedupeKey"])).toBe(true)
        expect(isLookup(UNIQUE, ["status", "dedupeKey"])).toBe(true)
    })

    it("is a listing when the fields pinned name no single record", () => {
        expect(isLookup(UNIQUE, ["status"])).toBe(false)
        expect(isLookup(UNIQUE, [])).toBe(false)
        expect(isLookup(ORDER, ["total"])).toBe(false)
    })
})

describe("the order a node read follows", () => {
    const orderOf = async (
        entity: EntityDefinition,
        where: Readonly<Record<string, string | number>>,
    ): Promise<ReadonlyArray<readonly [string, string]> | undefined> => {
        const policy = await build()
        return policy.nodeReadPlanOf(entity, kindOf, TURN, { where, fields: ["status"] }, "workspace")?.query.order
    }

    it("reads one record by its id, or by a unique key, in the order of the id", async () => {
        expect(await orderOf(UNIQUE, { id: "c-1" })).toEqual([["id", "asc"]])
        expect(await orderOf(UNIQUE, { dedupeKey: "d-1" })).toEqual([["id", "asc"]])
    })

    it("falls back to the creation order where no index serves a newest-first read of the pins (the engine then refuses it)", async () => {
        expect(await orderOf(UNIQUE, { status: "open" })).toEqual([
            ["createdAt", "desc"],
            ["id", "desc"],
        ])
    })

    it("reads newest first by the time column a declared index serves after the pins, the creation time when one serves it", async () => {
        const timed: EntityDefinition = {
            ...UNIQUE,
            fields: { ...UNIQUE.fields, sentAt: { kind: "timestamptz", nullable: false } },
            indexes: [
                { name: "status_sent", on: ["status", { desc: "sentAt" }, { desc: "id" }] },
                { name: "dedupe_status_created", on: ["dedupeKey", "status", { desc: "createdAt" }, { desc: "id" }] },
                { name: "status_folded", on: ["status", { fold: "dedupeKey" }, "id"] },
            ],
        }
        expect(newestOrderOf(timed, ["status"])).toEqual([
            ["sentAt", "desc"],
            ["id", "desc"],
        ])
        expect(newestOrderOf(timed, ["status", "dedupeKey"])).toEqual([
            ["createdAt", "desc"],
            ["id", "desc"],
        ])
        expect(newestOrderOf(timed, [])).toBeNull()
    })
})

/** Every entity the flow F declares, by data kind and by name: the planner checks a node read against them as the engine does. */
const BY_KIND: ReadonlyMap<string, EntityDefinition> = new Map(
    FLOW_F_ENTITIES.map((entity) => [entity.dataKind, entity]),
)
const CATALOG: EntityCatalog = new Map(FLOW_F_ENTITIES.map((entity) => [entity.name, entity]))

const TX_FIELDS = ["id", "amountVnd", "reference", "payer", "occurredAt", "orderId", "status"]
const ORDER_FIELDS = ["id", "orderNo", "leadId", "items", "amountVnd", "status", "confirmedAt", "createdAt"]

/** The data reads the payment and accounting nodes make, with the equality each filters on and the fields it takes (SePay-shaped rows). */
const READS: ReadonlyArray<readonly [string, string, NodeQuery]> = [
    [
        "payment.evidence: the transaction that arrived",
        "bank-transaction",
        { where: { id: "t1" }, fields: TX_FIELDS, limit: 1 },
    ],
    [
        "payment.evidence: the feed for a claim that names an amount",
        "bank-transaction",
        { where: { amountVnd: 5000 }, fields: TX_FIELDS, limit: 200 },
    ],
    [
        "payment.evidence: the feed for a claim that names none",
        "bank-transaction",
        { where: { status: "unmatched" }, fields: TX_FIELDS, limit: 200 },
    ],
    [
        "payment.evidence: the open orders",
        "order",
        { where: { status: "confirmed" }, fields: ORDER_FIELDS, limit: 200 },
    ],
    [
        "payment.evidence: the open claims",
        "payment-claim",
        { where: { status: "open" }, fields: ["id", "status", "claimedAt"], limit: 200 },
    ],
    [
        "payment.evidence: one claim",
        "payment-claim",
        { where: { id: "c1" }, fields: ["id", "status", "claimedAt"], limit: 1 },
    ],
    [
        "payment.evidence: the name of a customer",
        "sales-lead",
        { where: { id: "l1" }, fields: ["id", "contactName"], limit: 1 },
    ],
    [
        "payment.evidence: a conversation",
        "conversation",
        { where: { id: "v1" }, fields: ["id", "leadId", "lastAt"], limit: 1 },
    ],
    [
        "payment.settle: the conversation of a customer",
        "conversation",
        { where: { leadId: "l1" }, fields: ["id", "leadId", "lastAt"], limit: 20 },
    ],
    [
        "payment.settle: one order",
        "order",
        { where: { id: "o1" }, fields: ["id", "orderNo", "amountVnd", "status"], limit: 1 },
    ],
    [
        "payment.request: one order",
        "order",
        { where: { id: "o1" }, fields: ["orderNo", "amountVnd", "status", "items"], limit: 1 },
    ],
    [
        "sales.consult-turn: the thread of the conversation",
        "message",
        { where: { conversationId: "v1" }, fields: ["role", "text", "sentAt"], limit: 30 },
    ],
    [
        "chatbot understand / answer / complaint: the posted lines of the conversation",
        "message",
        { where: { conversationId: "v1", status: "posted" }, fields: ["role", "text", "sentAt"], limit: 30 },
    ],
    [
        "agent-graph-turn-policy: the agent lines a step already sent",
        "message",
        { where: { conversationId: "v1", role: "agent" }, fields: ["text", "sentAt", "channelRef"], limit: 20 },
    ],
    [
        "sales care: the customer's latest orders (the paid ones kept in the node)",
        "order",
        { where: { leadId: "l1" }, fields: ORDER_FIELDS, limit: 50 },
    ],
    [
        "accounting close report: the credits of a status",
        "bank-transaction",
        { where: { direction: "credit", status: "matched" }, fields: TX_FIELDS, limit: 200 },
    ],
    [
        "accounting close report: the booked credit of a bank reference",
        "bank-transaction",
        { where: { externalRef: "FT1" }, fields: TX_FIELDS, limit: 1 },
    ],
]

describe("the data reads of the payment and accounting nodes", () => {
    for (const [name, kind, query] of READS) {
        it(`${name} is a query the planner accepts`, async () => {
            const entity = BY_KIND.get(kind)
            expect(entity).toBeDefined()
            if (entity === undefined) return
            const policy = await build()
            const plan = policy.nodeReadPlanOf(entity, kindOf, TURN, query, "workspace")
            expect(plan).not.toBeNull()
            if (plan === null) return
            expect(queryProblems(plan.query, CATALOG)).toEqual([])
        })
    }

    it("lists the reads of a non-unique filter newest first, so the newer of two matching credits comes first", async () => {
        const policy = await build()
        for (const [, kind, query] of READS.filter(([, , one]) => !("id" in (one.where ?? {})))) {
            const entity = BY_KIND.get(kind)
            const plan = entity === undefined ? null : policy.nodeReadPlanOf(entity, kindOf, TURN, query, "workspace")
            const order = plan?.query.order ?? []
            if (order.length === 1) continue
            expect(order.map(([, direction]) => direction)).toEqual(["desc", "desc"])
            expect(order.at(-1)?.[0]).toBe("id")
        }
    })
})

/** One static read of the be outside the node reads: where it lives, the entity, the condition and the order it lists in. */
interface BeRead {
    readonly name: string
    readonly query: Query
}

const EQ = (field: string): FilterExpr => ({ op: "eq", field, value: "x" })
const AND = (...of: ReadonlyArray<FilterExpr>): FilterExpr => ({ op: "and", of })
const IN = (field: string): FilterExpr => ({ op: "in", field, values: ["x"] })
const RECENT = (field: string): OrderBy => [
    [field, "desc"],
    ["id", "desc"],
]
const BY_ID: OrderBy = [["id", "asc"]]
const read = (name: string, from: string, where: FilterExpr, order: OrderBy): BeRead => ({
    name,
    query: { from, select: [], where, order, page: { size: 5 } },
})

/**
 * The static reads the be makes through the engine outside the node reads: the run machinery (agent-run-records), the chat records, the
 * conversation and customer lookups, the payment feed and the workspace settings. A new static read of the be is added here, so a list
 * no declared index serves is caught by this spec and not by a parked run.
 */
const BE_READS: ReadonlyArray<BeRead> = [
    read("agent-run-records: the run of a wake", "agent.run", EQ("wakeId"), BY_ID),
    read("agent-run-records: the steps of a run", "agent.run-step", EQ("runId"), [
        ["ordinal", "asc"],
        ["id", "asc"],
    ]),
    read("agent-run-records: the steps waiting on a work item", "agent.run-step", EQ("waitItemId"), BY_ID),
    read(
        "agent-run-records: the steps of a kind about a work item",
        "agent.run-step",
        AND(EQ("kind"), EQ("workItemId")),
        BY_ID,
    ),
    read(
        "customer-drafts: the proposed line of a conversation",
        "chat.message",
        AND(EQ("conversationId"), EQ("status")),
        RECENT("sentAt"),
    ),
    read(
        "chat-messages: the lines of a role in a conversation, oldest first",
        "chat.message",
        AND(EQ("conversationId"), IN("role")),
        [
            ["sentAt", "asc"],
            ["id", "asc"],
        ],
    ),
    read(
        "chat-messages: the lines of a role in a conversation, newest first",
        "chat.message",
        AND(EQ("conversationId"), IN("role")),
        RECENT("sentAt"),
    ),
    read(
        "chat-messages: the transcript without system lines",
        "chat.message",
        AND(EQ("conversationId"), { op: "ne", field: "role", value: "system" }),
        RECENT("sentAt"),
    ),
    read("chat-messages: the line of a channel key", "chat.message", EQ("channelRef"), BY_ID),
    read(
        "chat-conversations: the followers of a connection",
        "chat.conversation",
        AND(EQ("channel"), EQ("connectionId"), { op: "gt", field: "lastAt", value: "x" }),
        RECENT("lastAt"),
    ),
    read("chat-conversations: the conversations of some ids", "chat.conversation", IN("id"), RECENT("lastAt")),
    read(
        "chat-conversations: the newest conversations",
        "chat.conversation",
        { op: "ne", field: "channel", value: "" },
        RECENT("lastAt"),
    ),
    read(
        "chat-conversations: the conversation of a customer",
        "chat.conversation",
        AND(EQ("channel"), EQ("connectionId"), EQ("externalId")),
        BY_ID,
    ),
    read("chat-conversations: one conversation by id", "chat.conversation", EQ("id"), BY_ID),
    read(
        "chat-followers: the customer lines after a moment",
        "chat.message",
        AND(IN("conversationId"), EQ("role"), { op: "gt", field: "sentAt", value: "x" }),
        RECENT("sentAt"),
    ),
    read(
        "graph-node-effects: the ledger record of an effect key (a unique key)",
        "agent.node-effect",
        EQ("effectKey"),
        BY_ID,
    ),
    read("workspace-time-zone: the settings of the workspace", "workspace.settings", EQ("key"), [
        ["key", "asc"],
        ["id", "asc"],
    ]),
    read(
        "payment-transactions: the movements of a direction",
        "payment.transaction",
        EQ("direction"),
        RECENT("occurredAt"),
    ),
    read(
        "payment-transactions: the movements of a direction and status",
        "payment.transaction",
        AND(EQ("direction"), EQ("status")),
        RECENT("occurredAt"),
    ),
    read(
        "payment-transactions: the movements of a direction since a moment",
        "payment.transaction",
        AND(EQ("direction"), { op: "gte", field: "occurredAt", value: "x" }),
        RECENT("occurredAt"),
    ),
]

describe("the static reads of the be outside the node reads", () => {
    it.each(BE_READS.map((one) => [one.name, one.query] as const))(
        "%s is a query the planner accepts",
        (_name, query) => {
            expect(queryProblems(query, CATALOG)).toEqual([])
        },
    )
})
