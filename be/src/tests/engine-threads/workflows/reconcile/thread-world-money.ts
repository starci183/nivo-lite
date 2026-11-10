import { WORKFLOW_CALL_MEMBER, WORKFLOW_PARAMS_MEMBER } from "@nivo-lite/agent-sdk/graph"
import type { AgentWake } from "@modules/domain/agent-work"
import type { NodeRow } from "@modules/domain/graph-nodes"
import { agentTurnViewOf } from "../../../fixtures/builders/agent-work.builder"
import { memoryCheckpointStore } from "../../../fixtures/builders/checkpoint-store.builder"
import { workflowWorldOf } from "../../../fixtures/builders/workflow-world.builder"
import { ScriptedModel, TickingClock, type Rights } from "../../thread-world-outside"
import { MemoryRecords, WS } from "../../thread-world-records"
import { CONV, FRONT, LEAD, ZALO, type Act, type ThreadDb, type ThreadProcess, type Woken } from "../../thread-world"

// THE MONEY WORLD of package P7 (1-8: consult + reconcile on threads). The database and the process of the 0-9 world (`thread-world*.ts`),
// with three agents (front desk, sales, accounting) and their seeded workflows, the shop's books (orders, bank transactions, claims,
// catalogue) as the data ports read them, and two outside parts the 0-9 world does not need: the gateway's `nivo.ledger.entry.append` (one line per
// bank transaction, however often it is asked: its own business key) and the bank's settle (the order is paid, the credit tied to it).
// The process over it is `thread-world-money-process.ts`. Faked: the model (scripted per purpose), the outside acts, the wake and run
// tables, as in the 0-9 world.

/** The sales agent (consult). */
export const SALES = "sales-agent"
/** The accounting agent (reconcile). */
export const ACCOUNTING = "accounting-agent"
/** The shop's bank account (SePay). */
export const SEPAY = "sepay-1"
/** The shop's books (Google Sheets). */
export const SHEET = "google-1"
/** The consult workflow, by namespace. */
export const CONSULT_WORKFLOW = "sales.consult"
/** The reconcile workflow, by namespace. */
export const RECONCILE_WORKFLOW = "accounting.reconcile"
/** The after-sale (thank-you) workflow, by namespace. */
export const AFTER_SALE_WORKFLOW = "sales.after-sale"

/** The model purposes of the steps (`<node id>:<purpose>`). */
export const P = {
    consult: "sales.consult-turn:consult",
    createOrder: "sales.create-order:create-order",
    sendQr: "payment.request:send-qr",
    orderNotice: "sales.order-notice:order-notice",
    match: "accounting.match-payment:agent",
    settle: "payment.settle:agent",
    post: "accounting.post-payment:agent",
    paidNotice: "payment.received-notice:agent",
    afterSale: "sales.after-sale:after-sale",
    carePlanDay: "sales.care-plan:care-plan-delivery-day",
    core: "engine:step-trouble",
} as const

/** One call of a gateway tool (not an effect): what the door was asked. */
export interface ToolCall {
    /** The tool. */
    readonly tool: string
    /** Its arguments. */
    readonly args: Readonly<Record<string, unknown>>
    /** The call key. */
    readonly key: string
}

/** The money world's database: the 0-9 database, the gateway's tool calls and the cash book. */
export interface MoneyDb extends ThreadDb {
    /** Every call of a gateway tool, in order. */
    readonly toolCalls: Array<ToolCall>
    /** The cash book: one line per bank transaction (its business key), the ref it was given. */
    readonly book: Map<string, string>
}

/** The rights of the shop: Zalo, one bank account, one books sheet; each agent attached to what its template ticks, `auto`. */
const rightsOf = (): Rights => ({
    accounts: [
        { id: ZALO, provider: "zalo_oa" },
        { id: SEPAY, provider: "sepay" },
        { id: SHEET, provider: "google" },
    ],
    attachments: [
        { agentId: FRONT, connectionId: ZALO, provider: "zalo_oa", abilities: { "customer.send": "auto" } },
        { agentId: SALES, connectionId: ZALO, provider: "zalo_oa", abilities: { "customer.send": "auto" } },
        { agentId: SALES, connectionId: SEPAY, provider: "sepay", abilities: { "qr.create": "auto" } },
        { agentId: ACCOUNTING, connectionId: ZALO, provider: "zalo_oa", abilities: { "customer.send": "auto" } },
        {
            agentId: ACCOUNTING,
            connectionId: SEPAY,
            provider: "sepay",
            abilities: { "transactions.read": "auto", "credit.rematch": "auto" },
        },
        { agentId: ACCOUNTING, connectionId: SHEET, provider: "google", abilities: { "ledger.write": "auto" } },
    ],
    defaults: new Map(),
})

/** The shop's books as a spec seeds them. */
export interface Books {
    /** The orders. */
    readonly order?: Array<NodeRow>
    /** The bank transactions (credits). */
    readonly "bank-transaction"?: Array<NodeRow>
    /** The customers' payment claims. */
    readonly "payment-claim"?: Array<NodeRow>
    /** The catalogue. */
    readonly "catalogue-item"?: Array<NodeRow>
}

/** The text of a value, or empty. */
const textOf = (value: unknown): string => (typeof value === "string" ? value : "")

/** A fresh money database: the three agents' workflows seeded from the templates, one customer, one Zalo conversation, the books. */
export const moneyDbOf = (books: Books = {}): MoneyDb => {
    const clock = new TickingClock()
    const workflows = workflowWorldOf({ [FRONT]: "chatbot", [SALES]: "sales", [ACCOUNTING]: "accounting" })
    const versions = new Map(
        [...workflows.graphs.entries()].map(([id, flow]) => [id, { number: Number(id.split("@").at(-1)), flow }]),
    )
    return {
        clock,
        store: {
            message: [],
            inbox: [],
            conversation: [{ id: CONV, leadId: LEAD, channel: "zalo", connectionId: ZALO }],
            "sales-lead": [{ id: LEAD, contactName: "Lan" }],
            order: [...(books.order ?? [])],
            "bank-transaction": [...(books["bank-transaction"] ?? [])],
            "payment-claim": [...(books["payment-claim"] ?? [])],
            "catalogue-item": [...(books["catalogue-item"] ?? [])],
        },
        acts: [],
        lines: [],
        team: [],
        throwOn: new Map(),
        rights: rightsOf(),
        records: new MemoryRecords(clock),
        checkpoints: memoryCheckpointStore(),
        wakes: [],
        runs: new Map(),
        versions,
        workflows,
        model: new ScriptedModel(),
        released: [],
        forgetTaskWrites: false,
        fence: 10,
        turns: 0,
        toolCalls: [],
        book: new Map(),
    }
}

/** A wake as a spec hands it in: who is woken, from where, about what. */
export interface WakeIn {
    /** The agent woken. */
    readonly agentId: string
    /** The wake's event key (what makes it once). */
    readonly eventKey: string
    /** The lock scope its lease is taken on. */
    readonly scopeKey: string
    /** The context its door wrote. */
    readonly context: AgentWake["context"]
}

/** Runs one wake through the REAL flow under a fresh fence of its scope's lease (as the drain does), and says how it ended. */
export const wake = async (process: ThreadProcess, input: WakeIn): Promise<Woken> => {
    const { db } = process
    db.turns += 1
    db.fence += 1
    const turn = agentTurnViewOf({
        workspaceId: WS,
        agentId: input.agentId,
        wakeId: `wake-${db.turns}`,
        eventKey: input.eventKey,
        source: "tag",
        scopeKey: input.scopeKey,
        context: structuredClone(input.context),
        actorMemberId: null,
        fence: db.fence,
        turnId: `turn-${db.turns}`,
    })
    const runOf = (): string | null => [...db.runs.values()].find((run) => run.wakeId === turn.wakeId)?.id ?? null
    try {
        const ending = await process.flows.run(turn, new AbortController().signal)
        return { ending, runId: runOf(), error: null }
    } catch (error) {
        return { ending: null, runId: runOf(), error }
    }
}

/** The front desk's hand-off to the sales consult, as `core.call-workflow` tags it (pinned to the workflow, the inputs as params). */
export const consultWake = (text: string, eventKey = "call-workflow:turn-0:sales.consult"): WakeIn => {
    const params = { conversationId: CONV, text, channel: "zalo", leadId: LEAD }
    return {
        agentId: SALES,
        eventKey,
        scopeKey: `conversation:${CONV}`,
        context: {
            text,
            tagContext: JSON.stringify({
                [WORKFLOW_CALL_MEMBER]: { workflow: "consult", version: "latest" },
                [WORKFLOW_PARAMS_MEMBER]: params,
                caller: { runId: "turn-0" },
            }),
            conversationId: CONV,
            channel: "zalo",
            leadId: LEAD,
            locale: "vi",
            authorAgentId: FRONT,
        },
    }
}

/** A credit from the bank feed, as `BankFeedFlowService.tag` wakes the accounting agent (no lead, no conversation). */
export const bankFeedWake = (transactionId: string): WakeIn => ({
    agentId: ACCOUNTING,
    eventKey: `bank-feed:${SEPAY}:${transactionId}`,
    scopeKey: `subject:bank-transaction:${transactionId}`,
    context: {
        text: "Tien ve",
        subject: `bank-transaction:${transactionId}`,
        locale: "vi",
        tagSource: "bank_feed",
    },
})

/** The rematch job's start of the reconciliation for a credit that names an order's new code (`engine.workflow`, keyed per order). */
export const rematchWake = (transactionId: string, orderId: string): WakeIn => ({
    agentId: ACCOUNTING,
    eventKey: `workflow-start:rematch:${transactionId}:${orderId}`,
    scopeKey: `subject:bank-transaction:${transactionId}`,
    context: {
        text: "accounting.reconcile",
        tagContext: JSON.stringify({
            [WORKFLOW_CALL_MEMBER]: { workflow: "reconcile", version: "latest" },
            [WORKFLOW_PARAMS_MEMBER]: { transactionId },
        }),
        locale: "vi",
        tagSource: "engine.workflow",
    },
})

/** A tool and its arguments, as the model names them. */
export type ScriptedCallBody = Readonly<{
    /** The tool. */
    tool: string
    /** Its arguments. */
    args: Readonly<Record<string, unknown>>
}>

/** One tool call as the model answers it (a type, not an interface: the scripted model takes any JSON record). */
export type ScriptedCall = Readonly<Record<"call", ScriptedCallBody>>

/** A tool call of the model's script. */
export const calls = (tool: string, args: Readonly<Record<string, unknown>>): ScriptedCall => ({ call: { tool, args } })

/** The customer lines of the conversation, by text. */
export const linesOf = (db: MoneyDb): ReadonlyArray<string> => db.lines.map((line) => line.text)

/** The agent of each module the world runs. */
const AGENT_OF_MODULE: Readonly<Record<string, string>> = { chatbot: FRONT, sales: SALES, accounting: ACCOUNTING }

/**
 * The wake a hand-off (`core.call-workflow`'s `nivo.agent.tag` act) makes for its target, as `AgentTagService` writes it: the target agent of
 * the module, the workflow pin and the mapped inputs as the tag's data, the customer and conversation it names.
 */
export const handOffWake = (act: Act, fromAgentId: string): WakeIn => {
    const { payload } = act
    const conversationId = textOf(payload.conversationId)
    const leadId = textOf(payload.leadId)
    return {
        agentId: AGENT_OF_MODULE[textOf(payload.toModuleKey)] ?? "",
        eventKey: act.dedupeKey ?? act.key,
        scopeKey: conversationId === "" ? `lead:${leadId}` : `conversation:${conversationId}`,
        context: {
            text: textOf(payload.text),
            tagContext: JSON.stringify(payload.context ?? {}),
            ...(conversationId === "" ? {} : { conversationId }),
            ...(leadId === "" ? {} : { leadId }),
            ...(typeof payload.channel === "string" ? { channel: payload.channel } : {}),
            locale: "vi",
            authorAgentId: fromAgentId,
        },
    }
}
