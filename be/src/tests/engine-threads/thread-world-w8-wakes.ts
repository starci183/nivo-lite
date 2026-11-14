import type { Provider } from "@nestjs/common"
import { AGENT_NODE_EFFECTS, AGENT_RUN_STEPS, memoryEffectStore } from "@tests/fixtures/builders/engine-core-tables.builder"
import { AgentGraphTurnPolicyService } from "@modules/domain/agent-graphs"
import { RunStopRecordsService } from "@modules/domain/agent-threads"
import { chatServicesOf } from "./thread-world-intake"
import { WS } from "./thread-world-records"
import type { ThreadProcess } from "./thread-world"
import type { MoneyDb } from "./workflows/reconcile/thread-world-money"

// The wakes of package W8 (design rows 2-2 and 2-3: sales care, web order and reports on threads). The database and the process are
// P7's money world (`workflows/reconcile/thread-world-money*.ts`: three agents with every seeded workflow, rights per connected account,
// the books, a send by `leadId` resolved to the customer's conversation, UUID run ids so the ledger keeps run + step). What this file
// adds is the door of each trigger these workflows take, written as the real door writes its wake: the after-sale hand-off
// (`core.call-workflow` → `AgentTagService`), a care timer (`AgentWorkSweepService.wakeForCare`), a website form
// (`WebsiteLeadWakeService.wake`). Ledger (TOOLS-LEAD F2): the evening close wake (`closeWake`, probe `accounting_close`) and the reports
// workflow / purpose left with the accounting module (dropped; no spec used them); the website wake names the CORE contact the intake met,
// no sales lead (coordinator's ruling: the website trigger carries `contactId`).

/** The workflows of this package, by namespace. */
export const W8_WORKFLOWS = {
    afterSale: "sales.after-sale",
    deliveryCheck: "sales.delivery-check",
    occasion: "sales.occasion",
    paymentReminder: "sales.payment-reminder",
    webOrder: "sales.web-order",
} as const

/** The model purposes of the steps (`<node id>:<purpose>`). */
export const W8P = {
    afterSale: "sales.after-sale:agent",
    carePlanDay: "sales.care-plan-delivery:agent",
    deliveryCheck: "sales.care-delivery-check:agent",
    occasion: "sales.care-occasion:agent",
    paymentReminder: "sales.payment-reminder:agent",
    webOrderKeep: "sales.web-order-keep:agent",
    webOrder: "sales.web-order-notice:agent",
    core: "engine:step-trouble",
} as const

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
        if (mutation.entity !== AGENT_RUN_STEPS || mutation.op !== "update" || mutation.values.status !== "done") return false
        done += 1
        return done === nth
    })
}

/** What a walk left in the world, comparable with a fixed baseline (no clock stamps). */
export const w8OutcomeOf = (db: MoneyDb): Readonly<Record<string, unknown>> => ({
    acts: db.acts.map((act) => ({ effect: act.effect, payload: act.payload, key: act.key, dedupeKey: act.dedupeKey })),
    lines: db.lines.map((line) => ({ conversationId: line.conversationId, text: line.text, channelRef: line.channelRef })),
    team: db.team.map((message) => ({ key: message.key, versions: message.versions })),
    ledger: db.records.of(AGENT_NODE_EFFECTS).map((row) => row.data),
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

/**
 * The REAL turn policy (`AgentGraphTurnPolicyService`: what a step is told it already did and said, W3's `alreadyDone` fill) over the
 * world's database, for a process's `extra` providers (no conversation rows: the world keeps those in its store); the effect ledger and
 * the stops are the REAL ledger store double and stop door over the world's tables.
 */
export const turnPolicyOf = (db: MoneyDb): Provider => {
    return {
        provide: AgentGraphTurnPolicyService,
        useFactory: (stops: RunStopRecordsService) =>
            new AgentGraphTurnPolicyService(db.clock, undefined, undefined, stops, memoryEffectStore(db.records), chatServicesOf(db).deliveries),
        inject: [RunStopRecordsService],
    }
}
