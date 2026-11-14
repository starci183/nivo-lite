import type { AgentWake } from "@modules/domain/agent-work"
import type { NodeRow } from "@modules/domain/graph-nodes"
import { agentTurnViewOf } from "../../../fixtures/builders/agent-work.builder"
import { memoryCheckpointStore } from "../../../fixtures/builders/checkpoint-store.builder"
import { workflowWorldOf } from "../../../fixtures/builders/workflow-world.builder"
import { ScriptedModel, TickingClock, type Rights } from "../../thread-world-outside"
import { ChatWorld } from "../../thread-world-chat"
import { MemoryRecords, WS } from "../../thread-world-records"
import { CONTACT, CONV, FRONT, LEAD, ZALO, type ThreadDb, type ThreadProcess, type Woken } from "../../thread-world"

// THE MONEY WORLD of package P7 (1-8: consult + reconcile on threads). The database and the process of the 0-9 world (`thread-world*.ts`),
// with three agents (front desk, sales, accounting) and their seeded workflows, the shop's books (orders, bank transactions, claims,
// catalogue) as the data ports read them, and two outside parts the 0-9 world does not need: the gateway's `nivo.tool.ledger.entry.append` (one line per
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
    consult: "sales.consult-turn:agent",
    createOrder: "sales.create-order:create-order",
    sendQr: "payment.request:send-qr",
    orderNotice: "sales.order-notice:order-notice",
    match: "accounting.match-payment:agent",
    /** The holding line of the reconciliation (`accounting.payment-holding-notice`, an agent that writes the one line its step sends). */
    hold: "accounting.payment-holding-notice:agent",
    /** The claim of a customer's words (`accounting.claim-record`, an agent that reads them; the step records the claim). */
    claim: "accounting.claim-record:agent",
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
        { agentId: FRONT, connectionId: ZALO, provider: "zalo_oa" },
        { agentId: SALES, connectionId: ZALO, provider: "zalo_oa" },
        { agentId: SALES, connectionId: SEPAY, provider: "sepay" },
        { agentId: ACCOUNTING, connectionId: ZALO, provider: "zalo_oa" },
        {
            agentId: ACCOUNTING,
            connectionId: SEPAY,
            provider: "sepay",
        },
        { agentId: ACCOUNTING, connectionId: SHEET, provider: "google" },
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
}

/** A fresh money database: the three agents' workflows seeded from the templates, one customer, one Zalo conversation, the books. */
export const moneyDbOf = (books: Books = {}): MoneyDb => {
    const clock = new TickingClock()
    const workflows = workflowWorldOf({ [FRONT]: "chatbot", [SALES]: "sales", [ACCOUNTING]: "accounting" })
    const versions = new Map(
        [...workflows.graphs.entries()].map(([id, flow]) => [id, { number: Number(id.split("@").at(-1)), flow }]),
    )
    const records = new MemoryRecords(clock)
    // The books as the ENGINE holds them too (`sales.order`, `payment.transaction`): what the settle's exactness floor reads
    // (`SettleFactsReader`, `awaitingOrdersOf`), never a stub. A world credit names no direction: it is money in.
    ;(books.order ?? []).forEach((row) => records.put("sales.order", String(row.id), structuredClone(row)))
    ;(books["bank-transaction"] ?? []).forEach((row) =>
        records.put("payment.transaction", String(row.id), { direction: "credit", ...structuredClone(row) }),
    )
    return {
        clock,
        store: {
            message: [],
            inbox: [],
            conversation: [{ id: CONV, leadId: LEAD, contactId: CONTACT, channel: "zalo", connectionId: ZALO }],
            "sales-lead": [{ id: LEAD, contactName: "Lan" }],
            order: [...(books.order ?? [])],
            "bank-transaction": [...(books["bank-transaction"] ?? [])],
            "payment-claim": [...(books["payment-claim"] ?? [])],
        },
        acts: [],
        lines: [],
        team: [],
        throwOn: new Map(),
        rights: rightsOf(),
        chat: new ChatWorld(),
        records,
        checkpoints: memoryCheckpointStore(),
        wakes: [],
        runs: new Map(),
        versions,
        workflows,
        model: new ScriptedModel(),
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
