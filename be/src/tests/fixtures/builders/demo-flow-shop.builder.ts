import { mock } from "@starci/jest-preset"
import type { EffectPayload, SubjectRef } from "@nivo-lite/agent-sdk/node"
import { TOOL } from "@nivo-lite/blocks-core"
import type { FlowWake } from "@modules/domain/agent-graphs"
import type { RunView } from "@modules/domain/agent-runs"
import type { AgentTagService } from "@modules/domain/agent-work"
import { GraphNodesError, GraphNodesErrorCode } from "@modules/domain/graph-nodes"
import type { NodeRow, NodeTurn } from "@modules/domain/graph-nodes"
import { AgentTagEffectService } from "../../../modules/domain/agents/agent-tag-effect.service"
import type { ConversationChannelOwners, InstallationDirectory } from "../../../modules/domain/agents/agents.port"
import { agentInstallationOf } from "./agents.builder"
import type { ShopFreezes } from "./lead-freeze-shop.builder"
import { flowWorldOf } from "./flow-f-world.builder"
import type { FlowModelScript, FlowWorld } from "./flow-f-world.builder"
import { conversationHoldsWorldOf } from "./conversation-holds-world.builder"
import type { ConversationHoldsWorld } from "./conversation-holds-world.builder"
import { leadMemoryWorldOf } from "./lead-memory-world.builder"
import type { LeadMemoryWorld } from "./lead-memory-world.builder"
import { workflowWorldOf } from "./workflow-world.builder"
import type { WorkflowWorld } from "./workflow-world.builder"
import { QR_URL, play } from "./demo-flow-run.builder"
import type { PlayOptions, Played, RunMemo } from "./demo-flow-run.builder"
import { CONVERSATION } from "./demo-flow-models.builder"
import { orderOf, rowsOf, transferCodeOf, writeOf } from "./demo-flow-tools.builder"
import type { Store } from "./demo-flow-tools.builder"
import words from "./demo-flow-shop.words.json"

export {
    AFTER_SALE_PURPOSE,
    ANSWER_PURPOSE,
    CONVERSATION,
    LEDGER_PURPOSE,
    MATCH_PURPOSE,
    ORDER_NO,
    RECEIVED_PURPOSE,
    SETTLE_PURPOSE,
    UNDERSTAND_PURPOSE,
    agrees,
    answers,
    confusedBy,
    matches,
    paysOrder,
    thanks,
    understands,
} from "./demo-flow-models.builder"
export { OWNER_LIMIT_VND, rowsOf } from "./demo-flow-tools.builder"
export type { Store } from "./demo-flow-tools.builder"

export { QR_URL, advance, doorOf, play, playedOf } from "./demo-flow-run.builder"
export type { PlayOptions, Played, Progress, RunMemo, Seat } from "./demo-flow-run.builder"

/** The run that already holds the conversation of a lead mid-consult. */
const HELD_RUN = "run-before"

/** The front desk agent. */
export const CHATBOT = "chatbot-agent"
/** The Sales agent that owns the Zalo channel of the conversation. */
export const SALES_OWNER = "sales-zalo-agent"
/** The Accounting agent. */
export const ACCOUNTING = "accounting-agent"

/** The transfer content of the demo order. */
export const TRANSFER_CODE = "DH202611090001"
/** The nodes of a consult turn that only asks: the turn ends at the consult, which keeps the conversation. */
export const CONSULT_PATH: ReadonlyArray<string> = ["consult"]

/** One catalogue row with a photo. */
export const catalogueRow = (id: string, name: string, priceVnd: number): NodeRow => ({
    id,
    name,
    priceVnd,
    active: true,
    imageUrl: `https://files.example/${id}.jpg`,
    imageType: "image/jpeg",
})

/** Three bouquets the demo shop sells. */
export const CATALOGUE: ReadonlyArray<NodeRow> = [
    catalogueRow("c1", words.roseName, 450_000),
    catalogueRow("c2", words.sunflowerName, 350_000),
    catalogueRow("c3", words.basketName, 250_000),
]

/** One message the fake channel carried to the customer. */
export interface Sent {
    /** The customer send, the care send, or the QR of an order. */
    readonly effect: string
    /** The agent whose run sent it. */
    readonly agent: string
    /** The words, pictures and conversation of the message. */
    readonly payload: EffectPayload
}

/** A tag one agent wrote for another, as the tag door received it. */
export interface Tagged {
    readonly fromAgentId: string
    readonly toAgentId: string
    readonly text: string
    readonly conversationId?: string | undefined
    readonly leadId?: string | undefined
    readonly channel?: string | undefined
    readonly subject?: string | undefined
    readonly context?: Readonly<Record<string, unknown>> | undefined
}

/** A call the payment tool received. */
export interface ToolCall {
    readonly tool: string
    readonly args: unknown
    /** Whether the call replayed the owner's approval. */
    readonly approved: boolean
}

/** The shop: the in-memory records, the fake channel and the tag door. */
export interface Shop {
    readonly store: Store
    readonly world: FlowWorld
    readonly sent: Array<Sent>
    readonly tagged: Array<Tagged>
    readonly toolCalls: Array<ToolCall>
    /** The runs played, one entry each. */
    readonly runs: Array<string>
    /** The effects whose executor the app is missing: running one fails the step for good, as a missing executor does. */
    readonly missing: Set<string>
    /** The workflows of the shop's agents, seeded from the templates, behind the real routing. */
    readonly workflows: WorkflowWorld
    /** The lead memory of the shop: one per customer, across every workflow. */
    readonly memory: LeadMemoryWorld
    /** The conversations the Sales consult keeps between turns, and the customer lines sent on to their keeper. */
    readonly holds: ConversationHoldsWorld
    /** The runs opened, by id, as the run engine keeps them: the guards of a hand-off read the calling run and the standing ones. */
    readonly runViews: Map<string, RunView>
    /** The freezes of customers the start of every run asks, or null for a shop that keeps none. */
    freezes: ShopFreezes | null
    /** How many wakes were played: each gets its own wake id. */
    wakes: number
    /** What each run that stopped keeps for a retry, by run. */
    readonly memos: Map<string, RunMemo>
    /** The ledger of the effects every run of the shop shares: a run played again from its failed step repeats no call it made. */
    readonly ledger: Map<string, SubjectRef>
}

/** The records every demo shop starts with: the catalogue and the customer's conversation. */
export const baseStore = (): Store => ({
    "catalogue-item": CATALOGUE.map((row) => ({ ...row })),
    messages: [],
    conversation: [{ id: CONVERSATION, leadId: "lead-1", lastAt: "2026-11-04T09:00:00.000Z" }],
})

/** The request a tag came to the tag service with, as the shop keeps it. */
type TagRequest = Parameters<AgentTagService["tagAgent"]>[0]

const taggedOf = (request: TagRequest): Tagged => ({
    fromAgentId: "fromAgentId" in request ? request.fromAgentId : "unknown",
    toAgentId: request.toAgentId,
    text: request.text,
    conversationId: request.conversationId ?? undefined,
    leadId: request.leadId ?? undefined,
    channel: request.channel ?? undefined,
    subject: request.subject ?? undefined,
    context: request.context ?? undefined,
})

/** The tag door of the shop: the real executor over the one Sales agent of the workspace, which owns the Zalo channel. */
const tagDoorOf = (tagged: Array<Tagged>): AgentTagEffectService => {
    const tags = mock<AgentTagService>({
        tagAgent: (request: TagRequest) => {
            tagged.push(taggedOf(request))
            return Promise.resolve({ tagged: true, wakeId: `wake-${tagged.length}` })
        },
    })
    const installations = mock<InstallationDirectory>({
        firstOfModule: (_workspace: string, module: string) =>
            Promise.resolve(agentInstallationOf({ agentId: module === "sales" ? SALES_OWNER : `${module}-agent` })),
    })
    const owners = mock<ConversationChannelOwners>({
        ownerAgentOf: (_workspace: string, _conversation: string, module: string) =>
            Promise.resolve(module === "sales" ? SALES_OWNER : null),
        ownerAgentOfLead: (_workspace: string, _lead: string, module: string) =>
            Promise.resolve(module === "sales" ? SALES_OWNER : null),
    })
    return new AgentTagEffectService(tags, installations, owners)
}

/** The shop whose effects change the store the way the app's executors do, and whose sends and tags are captured. */
export const shopOf = (store: Store): Shop => {
    const world = flowWorldOf(store)
    const sent: Array<Sent> = []
    const tagged: Array<Tagged> = []
    const tagDoor = tagDoorOf(tagged)
    const record = (effect: string, payload: EffectPayload, kind: string, id: string): SubjectRef => {
        world.ran.push({ effect, payload, subject: { kind, id } })
        return { kind, id }
    }
    const missing = new Set<string>()
    const execute = async (effect: string, payload: EffectPayload, turn?: NodeTurn): Promise<SubjectRef> => {
        if (missing.has(effect))
            throw new GraphNodesError({ code: GraphNodesErrorCode.ExecutorMissing, params: { effect } })
        const written = writeOf(store, record, effect, payload)
        if (written !== null) return written
        if (effect === TOOL.customerMessageSend) {
            sent.push({ effect, agent: turn?.agentId ?? "unknown", payload })
            return record(effect, payload, "message", `message-${world.ran.length + 1}`)
        }
        if (effect === TOOL.paymentQrCreate) {
            // The QR tool sends the bank details, the QR and the order card itself, from the order's own numbers.
            const order = orderOf(store, payload.orderId)
            const transferContent = transferCodeOf(order?.orderNo)
            sent.push({
                effect,
                agent: turn?.agentId ?? "unknown",
                payload: { ...payload, conversationId: turn?.conversationId ?? null, text: transferContent, qrUrl: QR_URL },
            })
            const facts = { orderNo: order?.orderNo, amountVnd: order?.amountVnd, transferContent, qrUrl: QR_URL }
            return { ...record(effect, payload, "message", `message-${world.ran.length + 1}`), facts }
        }
        if (effect === TOOL.agentTag && turn !== undefined) {
            const call = { key: `tag-${world.ran.length + 1}`, dedupeKey: null }
            const subject = await tagDoor.execute(turn, payload, call)
            return record(effect, payload, subject.kind, subject.id)
        }
        return world.execute(effect, payload, turn)
    }
    const workflows = workflowWorldOf({ [CHATBOT]: "chatbot", [SALES_OWNER]: "sales", [ACCOUNTING]: "accounting" })
    // The consult run that already holds the conversation of a lead mid-consult was a run of the Sales consult workflow.
    workflows.pins.set(HELD_RUN, {
        runId: HELD_RUN,
        workflowId: `${SALES_OWNER}:consult`,
        workflowVersionId: "held",
        workflowVersion: 1,
    })
    return {
        store,
        world: { ...world, execute },
        sent,
        tagged,
        toolCalls: [],
        runs: [],
        workflows,
        memory: leadMemoryWorldOf(store),
        holds: conversationHoldsWorldOf(store),
        runViews: new Map(),
        missing,
        freezes: null,
        wakes: 0,
        memos: new Map(),
        ledger: new Map(),
    }
}

/** The wake of a customer's message in the Zalo conversation, which the shop stores. */
const customerWake = (shop: Shop, text: string): FlowWake => {
    const id = `msg-${rowsOf(shop.store, "messages").length + 1}`
    rowsOf(shop.store, "messages").push({ id, body: text, at: "2026-11-04T10:00:00.000Z" })
    return {
        source: "customer",
        actorMemberId: null,
        context: { conversationId: CONVERSATION, messageId: id, channelEventId: `zalo:${id}`, lookupName: false },
    }
}

/** The wake a tag writes in the agent it tags: the words, the plain data as JSON text, and who tagged. */
export const tagWake = (tag: Tagged | undefined): FlowWake => ({
    source: "tag",
    actorMemberId: null,
    context: {
        text: tag?.text ?? "",
        ...(tag?.context === undefined ? {} : { tagContext: JSON.stringify(tag.context) }),
        ...(tag?.subject === undefined ? {} : { subject: tag.subject }),
        ...(tag?.conversationId === undefined ? {} : { conversationId: tag.conversationId }),
        ...(tag?.channel === undefined ? {} : { channel: tag.channel }),
        ...(tag?.leadId === undefined ? {} : { leadId: tag.leadId }),
        locale: "vi",
        ...(tag === undefined ? {} : { authorAgentId: tag.fromAgentId }),
    },
})

/** The wake the bank feed writes in Accounting for a new credit. */
export const creditWake = (transactionId: string): FlowWake => ({
    source: "tag",
    actorMemberId: null,
    context: { text: "Money in", tagSource: "bank_feed", subject: `bank-transaction:${transactionId}` },
})

/** The effect ids the world ran since the `from`th, in order. */
export const effectsSince = (shop: Shop, from: number): ReadonlyArray<string> =>
    shop.world.ran.slice(from).map((entry) => entry.effect)

/** What a customer's message set going: the front desk's run, and the Sales or Accounting run its hand-off woke. */
export interface Turn {
    readonly front: Played
    readonly sales: Played | null
    /** The Accounting run the front desk's hand-off of a payment claim woke, or null. */
    readonly accounting: Played | null
    /** The effects of the whole turn, in order. */
    readonly effects: ReadonlyArray<string>
}

/** The scripted answers of the models the agents call, by agent. */
export interface Models {
    readonly front: FlowModelScript
    readonly sales?: FlowModelScript
    readonly accounting?: FlowModelScript
}

/** A customer writes: the front desk answers first, and the agent it hands the customer to (Sales, or Accounting for a claim) runs next. */
export const customerSays = async (
    shop: Shop,
    text: string,
    models: Models,
    options: PlayOptions = {},
): Promise<Turn> => {
    const from = shop.world.ran.length
    const seen = shop.tagged.length
    const kept = shop.holds.redirected.length
    const front = await play(shop, { id: CHATBOT, module: "chatbot" }, customerWake(shop, text), models.front)
    const handed = shop.tagged.slice(seen)
    // A line the front door sent on to the agent that keeps the conversation is that agent's customer wake.
    const sent = shop.holds.redirected.slice(kept).find((wake) => wake.agentId === SALES_OWNER)
    const heldWake: FlowWake | undefined =
        sent === undefined ? undefined : { source: sent.source, actorMemberId: sent.actorMemberId, context: sent.context }
    const tagFor = (agent: string) => handed.find((each) => each.toAgentId === agent)
    const toSales = tagFor(SALES_OWNER)
    const toAccounting = tagFor(ACCOUNTING)
    const salesWake = heldWake ?? (toSales === undefined ? undefined : tagWake(toSales))
    const seat = { id: SALES_OWNER, module: "sales" } as const
    const sales =
        salesWake === undefined ? null : await play(shop, seat, salesWake, models.sales ?? {}, options)
    const accounting =
        toAccounting === undefined
            ? null
            : await play(shop, { id: ACCOUNTING, module: "accounting" }, tagWake(toAccounting), models.accounting ?? {})
    return { front, sales, accounting, effects: effectsSince(shop, from) }
}

/** The key of the workflow a played run was pinned to (`consult`, `front-desk`), or null for a run of no workflow. */
export const workflowOf = (shop: Shop, played: Played | null): string | null => {
    const pin = played?.runId == null ? undefined : shop.workflows.pins.get(played.runId)
    return pin?.workflowId.split(":").at(-1) ?? null
}

/** The shop's one customer. */
export const leadOf = (shop: Shop): NodeRow | undefined => rowsOf(shop.store, "sales-lead")[0]

/** The last message the customer got, or undefined when none. */
export const lastSent = (shop: Shop): Sent | undefined => shop.sent.at(-1)

/** A shop whose customer is mid-consult with the Sales agent, which keeps their conversation: the next message can settle the order. */
export const closingShop = (): Shop => shopOf(closingStore())

/** The records of a shop whose customer can settle the order with the next message. */
export const closingStore = (): Store => ({
    ...baseStore(),
    "sales-lead": [{ id: "lead-1", contactName: words.customerName, consultStage: "close" }],
})
