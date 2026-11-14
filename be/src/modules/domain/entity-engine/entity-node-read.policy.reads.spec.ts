import { Test } from "@nestjs/testing"
import type { EntityDefinition } from "@nivo-lite/agent-sdk/entity"
import type { NodeQuery } from "@nivo-lite/agent-sdk/node"
import { queryProblems } from "@nivo-lite/agent-sdk/query"
import type { EntityCatalog } from "@nivo-lite/agent-sdk/query"
import type { EntityNodeTurn } from "./entity-node.contracts"
import { nodeReadPlanOf } from "./entity-node-read.policy"
import { INSTALLED } from "@modules/domain/installed-plugins"
import { EntityEngineError, EntityEngineErrorCode } from "./errors/entity-engine.error"

const NODE_READ: unique symbol = Symbol("entity-node.node-read")

/** The functions of the policy file these cases call. */
interface NodeReadPlanPolicy {
    readonly nodeReadPlanOf: typeof nodeReadPlanOf
}

const build = async (): Promise<NodeReadPlanPolicy> => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: NODE_READ, useFactory: (): NodeReadPlanPolicy => ({ nodeReadPlanOf }) }],
    }).compile()
    return moduleRef.get<NodeReadPlanPolicy>(NODE_READ)
}

const WS = "11111111-1111-4111-8111-111111111111"
const TURN: EntityNodeTurn = { workspaceId: WS, subject: null, conversationId: null }

/** Every entity the flow F declares, by data kind and by name: the planner checks a node read against them as the engine does. */
const BY_KIND: ReadonlyMap<string, EntityDefinition> = new Map(
    INSTALLED.entities().map((entity) => [entity.dataKind, entity]),
)
const CATALOG: EntityCatalog = new Map(INSTALLED.entities().map((entity) => [entity.name, entity]))

/** The name of the installed entity of a data kind: the engine reads the chatbot's conversation by its kind, never by a type name. */
const nameOfKind = (kind: string): string => {
    const entity = BY_KIND.get(kind)
    if (entity === undefined) throw new EntityEngineError({ code: EntityEngineErrorCode.EntityUnknown })
    return entity.name
}

// The chatbot keeps no `message` record any more (ruling R26: the words of a customer conversation are engine data, `customer_messages`
// per route, read through `nivo.tool.conversation.message.list`), so there is no `message` kind to name here.
const CONVERSATION = nameOfKind("conversation")

const KINDS: Readonly<Record<string, string>> = { [CONVERSATION]: "conversation", "blocks-core.sales.order": "order" }
const kindOf = (name: string): string | undefined => KINDS[name]

const TX_FIELDS = ["id", "amountVnd", "reference", "payer", "occurredAt", "orderId", "status"]
const ORDER_FIELDS = ["id", "orderNo", "contactId", "items", "amountVnd", "status", "confirmedAt", "createdAt"]

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
        "payment.settle: one order",
        "order",
        { where: { id: "o1" }, fields: ["id", "orderNo", "amountVnd", "status"], limit: 1 },
    ],
    [
        "payment.request: one order",
        "order",
        { where: { id: "o1" }, fields: ["orderNo", "amountVnd", "status", "items"], limit: 1 },
    ],
    // The three `message` record reads (sales.consult-turn's thread, chatbot understand / answer / complaint's posted lines,
    // agent-graph-turn-policy's sent agent lines) are DELETED with the chatbot message record (ruling R26): the lines come from the
    // engine's line per route; that read is proven by customer-routes/customer-messages.service.spec.ts,
    // platform-ports/customer-messages-port.service.spec.ts and channels/customer-message-native.service.spec.ts.
    [
        "sales care: the person's latest orders (the paid ones kept in the node)",
        "order",
        { where: { contactId: "c1" }, fields: ORDER_FIELDS, limit: 50 },
    ],
    [
        "accounting close report: the credits of a status",
        "bank-transaction",
        { where: { direction: "credit", status: "matched" }, fields: TX_FIELDS, limit: 200 },
    ],
    [
        "team chat paid card: every credit of one order, by its index `order (orderId, id desc)` (D-MX-12)",
        "bank-transaction",
        { where: { orderId: "o1" }, fields: ["amountVnd", "direction", "status"], limit: 20 },
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

// The block "the static reads of the be outside the node reads" (chat-messages, chat-conversations, chat-followers) is DELETED: those
// be reads of the chatbot's records went with the chat-records removal (ruling R26: the be reads no chatbot record; no be source names
// the chatbot's entity any more), and the chat's record now has none of the fields they filtered on (`connectionId`, `externalId`,
// message `channelRef` / `role` / `sentAt`). The package's own reads of the chat are proven by blocks-core's chatbot read specs.
