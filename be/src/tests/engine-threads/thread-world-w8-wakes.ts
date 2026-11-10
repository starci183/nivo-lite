import type { Provider } from "@nestjs/common"
import { mock } from "@starci/jest-preset"
import { WORKFLOW_CALL_MEMBER, WORKFLOW_PARAMS_MEMBER } from "@nivo-lite/agent-sdk/graph"
import { AgentGraphTurnPolicyService } from "@modules/domain/agent-graphs"
import type { EntityDefinition } from "@nivo-lite/agent-sdk/entity"
import type { EntityEngineService } from "@modules/domain/entity-engine"
import { GraphNodeRegistryService } from "@modules/domain/graph-nodes"
import { agentTurnViewOf } from "../fixtures/builders/agent-work.builder"
import { WS, WorldError } from "./thread-world-records"
import { LEAD, type ThreadProcess, type Woken } from "./thread-world"
import {
    ACCOUNTING,
    SALES,
    moneyDbOf,
    type Books,
    type MoneyDb,
    type WakeIn,
} from "./workflows/reconcile/thread-world-money"
import { moneyProcessOf } from "./workflows/reconcile/thread-world-money-process"

// The wakes of package W8 (design rows 2-2 and 2-3: sales care, web order and reports on threads). The database and the process are
// P7's money world (`workflows/reconcile/thread-world-money*.ts`: three agents with every seeded workflow, rights per connected account,
// the books, a send by `leadId` resolved to the customer's conversation, UUID run ids so the ledger keeps run + step). What this file
// adds is the door of each trigger these workflows take, written as the real door writes its wake: the after-sale hand-off
// (`core.call-workflow` → `AgentTagService`), a care timer (`AgentWorkSweepService.wakeForCare`), a website form
// (`WebsiteLeadWakeService.wake`) and the evening close (`AgentWorkSweepService`/scheduler, source `schedule`, probe `accounting_close`).

/** The workflows of this package, by namespace (what the flag names). */
export const W8_WORKFLOWS = {
    afterSale: "sales.after-sale",
    deliveryCheck: "sales.delivery-check",
    occasion: "sales.occasion",
    paymentReminder: "sales.payment-reminder",
    webOrder: "sales.web-order",
    reports: "accounting.reports",
} as const

/** The model purposes of the steps (`<node id>:<purpose>`). */
export const W8P = {
    afterSale: "sales.after-sale:after-sale",
    carePlanDay: "sales.care-plan:care-plan-delivery-day",
    deliveryCheck: "sales.care-delivery-check:delivery-check",
    occasion: "sales.care-occasion:occasion",
    paymentReminder: "sales.payment-reminder:payment-reminder",
    unpaidNotice: "sales.unpaid-notice:unpaid-notice",
    webOrder: "sales.web-order:web-order",
    dailyClose: "accounting.report:daily-close",
    core: "engine:step-trouble",
} as const

/** A wake as a spec hands it in, with where it came from (the evening close is a `schedule` wake, every other one a `tag`). */
export interface W8WakeIn extends WakeIn {
    /** The work source of the wake. */
    readonly source: "tag" | "schedule"
}

/** The end hand-off of the reconcile (`to-after-sale`, `core.call-workflow`) as the tag door writes it: pinned, the inputs as params. */
export const afterSaleWake = (orderId: string, callerRunId = "reconcile-run-1"): W8WakeIn => ({
    source: "tag",
    agentId: SALES,
    eventKey: `call-workflow:${callerRunId}:sales.after-sale`,
    scopeKey: `lead:${LEAD}`,
    context: {
        text: "sales.after-sale",
        tagContext: JSON.stringify({
            [WORKFLOW_CALL_MEMBER]: { workflow: "after-sale", version: "latest" },
            [WORKFLOW_PARAMS_MEMBER]: { orderId, leadId: LEAD },
            caller: { runId: callerRunId },
        }),
        leadId: LEAD,
        locale: "vi",
        authorAgentId: ACCOUNTING,
    },
})

/** The care steps a timer wakes the sales agent for. */
export type CareKind = "payment-reminder" | "payment-stale" | "delivery-check" | "occasion"

/** A care timer that fell due, as `AgentWorkSweepService.wakeForCare` tags the sales agent (source `care-timer`). */
export const careTimerWake = (kind: CareKind, ref: string, dueAt: string, suffix = ""): W8WakeIn => {
    const aboutOrder = kind !== "occasion"
    const subject = `${aboutOrder ? "order" : "lead"}:${ref}`
    return {
        source: "tag",
        agentId: SALES,
        eventKey: `care:task-${kind}-${ref}:${String(Date.parse(dueAt))}`,
        scopeKey: `subject:${subject}`,
        context: {
            text: `care.due ${kind}`,
            tagContext: JSON.stringify({ event: "care.due", careKind: kind, ref, suffix, dueAt }),
            subject,
            ...(aboutOrder ? {} : { leadId: ref }),
            locale: "vi",
            tagSource: "care-timer",
        },
    }
}

/** What a website form gave. */
export interface WebForm {
    /** The input that recorded the form. */
    readonly inboundEventId: string
    /** What the customer wrote. */
    readonly request: string
    /** The phone they left, or null. */
    readonly phone: string | null
}

/** An accepted website form, as `WebsiteLeadWakeService.wake` tags the sales agent (source `website_lead`, no chat). */
export const websiteWake = (form: WebForm): W8WakeIn => ({
    source: "tag",
    agentId: SALES,
    eventKey: `website-lead:${form.inboundEventId}`,
    scopeKey: `lead:${LEAD}`,
    context: {
        text: `Khach web: ${form.request}`,
        tagContext: JSON.stringify({
            kind: "website-lead",
            leadId: LEAD,
            inboundEventId: form.inboundEventId,
            contact: { name: "Lan", phone: form.phone, email: null },
            request: form.request,
            source: {},
            chat: false,
            firstContact: { route: "owner_item", via: form.phone === null ? "none" : "phone" },
        }),
        subject: `lead:${LEAD}`,
        channel: "website",
        leadId: LEAD,
        locale: "vi",
        tagSource: "website_lead",
    },
})

/** The evening close fired by the accounting agent's schedule trigger (probe `accounting_close`), for one slot. */
export const closeWake = (slotMs: number): W8WakeIn => ({
    source: "schedule",
    agentId: ACCOUNTING,
    eventKey: `trigger-close:${String(slotMs)}`,
    scopeKey: `agent:${ACCOUNTING}:schedule`,
    context: { triggerId: "trigger-close", slot: String(slotMs), probeKey: "accounting_close" },
})

/** Runs one wake through the REAL flow under a fresh fence of its scope's lease (as the drain does), and says how it ended. */
export const w8Wake = async (process: ThreadProcess, input: W8WakeIn): Promise<Woken> => {
    const { db } = process
    db.turns += 1
    db.fence += 1
    const turn = agentTurnViewOf({
        workspaceId: WS,
        agentId: input.agentId,
        wakeId: `wake-${String(db.turns)}`,
        eventKey: input.eventKey,
        source: input.source,
        scopeKey: input.scopeKey,
        context: structuredClone(input.context),
        actorMemberId: null,
        fence: db.fence,
        turnId: `turn-${String(db.turns)}`,
    })
    const runOf = (): string | null => [...db.runs.values()].find((run) => run.wakeId === turn.wakeId)?.id ?? null
    try {
        const ending = await process.flows.run(turn, new AbortController().signal)
        return { ending, runId: runOf(), error: null }
    } catch (error) {
        return { ending: null, runId: runOf(), error }
    }
}

/** A process over a fresh money database with the books given; `flag` empty plays the old engine. */
export const w8ProcessOf = async (
    books: Books,
    flag: ReadonlyArray<string>,
    seed: (db: MoneyDb) => void = () => undefined,
): Promise<ThreadProcess & { readonly db: MoneyDb }> => {
    const db = moneyDbOf(books)
    seed(db)
    const process = await moneyProcessOf(db, flag)
    return { ...process, db }
}

/** The status of a run's thread. */
export const threadStatusOf = async (process: ThreadProcess, runId: string): Promise<string | undefined> =>
    (await process.threads.stateOf({ workspaceId: WS, runId }))?.status

/** The steps a run's thread has done, in order. */
export const threadStepsOf = async (process: ThreadProcess, runId: string): Promise<ReadonlyArray<string>> =>
    Object.keys((await process.threads.stateOf({ workspaceId: WS, runId }))?.state.steps ?? {})

/** The process dies on the `done` projection write of the n-th step of a run: that step acted, its checkpoint is not written. */
export const diesAtDone = (db: MoneyDb, nth: number): void => {
    let done = 0
    db.records.crashOnce((mutation) => {
        if (mutation.entity !== "agent.run-step" || mutation.op !== "update" || mutation.values.status !== "done") return false
        done += 1
        return done === nth
    })
}

/** What a walk left in the world, comparable across engines (no clock stamps). */
export const w8OutcomeOf = (db: MoneyDb): Readonly<Record<string, unknown>> => ({
    acts: db.acts.map((act) => ({ effect: act.effect, payload: act.payload, key: act.key, dedupeKey: act.dedupeKey })),
    lines: db.lines.map((line) => ({ conversationId: line.conversationId, text: line.text, channelRef: line.channelRef })),
    team: db.team.map((message) => ({ key: message.key, versions: message.versions })),
    ledger: db.records.of("agent.node-effect").map((row) => row.data),
    modelAsked: db.model.asked.map((one) => one.purpose),
})

/** The AI core's report of a step that could not complete: the founder decides; no customer line. */
export const coreReport = (question: string): Readonly<Record<string, unknown>> => ({
    decision: "report",
    reason: "Buoc nay chua hoan tat duoc, can chu tiem quyet.",
    question,
    suggestions: [
        { text: "Lam tiep", handledBy: "workflow" },
        { text: "Toi tu xu ly", handledBy: "person" },
    ],
    customerLine: null,
})

/** The step's agent cannot complete. */
export const confusedAnswer = (reason: string, question: string): Readonly<Record<string, unknown>> => ({
    confused: { reason, question },
})

/** The entities the turn policy reads that the world's records hold: the effect ledger and the stops. */
const TOLD_ENTITIES: ReadonlySet<string> = new Set(["agent.node-effect", "agent.run-stop"])

/**
 * The REAL turn policy (`AgentGraphTurnPolicyService`: what a step is told it already did and said, W3's `alreadyDone` fill) over the
 * world's records, for a process's `extra` providers. The records' engine knows no entity declarations, so this one answers a
 * declaration for the ledger and the stops (all the policy checks is that they exist) and refuses every other entity, as an app
 * that does not hold it (no module settings, no conversation rows: the world keeps those in its store).
 */
export const turnPolicyOf = (db: MoneyDb): Provider => {
    const records = db.records.engine
    const engine = mock<EntityEngineService>({
        scoped: (workspaceId, work) => records.scoped(workspaceId, work),
        within: (manager, workspaceId, work) => records.within(manager, workspaceId, work),
        get: (tx, entity, id) => records.get(tx, entity, id),
        list: (tx, query, scope) => records.list(tx, query, scope),
        definition: (entity: string) => {
            if (!TOLD_ENTITIES.has(entity)) throw new WorldError({ code: "WORLD_ENTITY_UNKNOWN", params: { entity } })
            return mock<EntityDefinition>()
        },
    })
    return {
        provide: AgentGraphTurnPolicyService,
        useFactory: (nodes: GraphNodeRegistryService) => new AgentGraphTurnPolicyService(nodes, engine, db.clock),
        inject: [GraphNodeRegistryService],
    }
}
