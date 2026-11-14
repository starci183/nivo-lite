import { Test } from "@nestjs/testing"
import { builder, mock } from "@starci/jest-preset"
import { AgentRunsViewService, type RunDetail, type RunRecord, type RunStepDetail } from "@modules/domain/agent-runs"
import {
    RunStopRecordsService,
    RunStopsError,
    RunStopsErrorCode,
    ThreadApprovalsService,
    ThreadResumeRequestsService,
    type ApprovalVerdictOutcome,
    type RunStop,
} from "@modules/domain/agent-threads"
import { AgentWorkAccessService } from "@modules/domain/agent-work"
import type { InstallationRecord } from "@modules/domain/module-installations"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { WorkItemsViewsReadService } from "@modules/domain/work-items"
import { SEND_ORDER_SUMMARY_VI } from "@tests/fixtures/i18n/agent-work-handler-spec.messages"
import { AgentRunDecisionsService } from "./agent-run-decisions.service"
import type { AgentRunVerdict } from "./agent-run-decisions.contracts"

/** The installation the work item is seen through. */
const INSTALLATION = builder<InstallationRecord>({
    id: "inst-1",
    workspaceId: "ws-1",
    moduleKey: "sales",
    name: "Sales",
    isMulti: false,
    agentId: "agent-1",
    status: "live",
    operatingMode: "autopilot",
    liveEnabled: true,
    activeContextVersionId: null,
    settings: {},
    createdAt: "2026-11-01T00:00:00.000Z",
})

/** The step and work item an open approval stop names. */
interface OpenApproval {
    /** The step the stop sits at. */
    readonly stepKey: string
    /** The work item the stop waits on. */
    readonly workItemId: string
}

/** How one case sets the doubles up. */
interface BuildOptions {
    /** The action of the work item the stop names. */
    readonly action?: string
    /** The status of the work item. */
    readonly status?: string
    /** How the seat proof ends. */
    readonly manager?: () => Promise<InstallationRecord>
    /** What the approvals' door answers. */
    readonly outcome?: ApprovalVerdictOutcome
    /** Whether the run is one of the deleted old engine. */
    readonly old?: boolean
    /** The open approval stop of the run; null for none. */
    readonly openItem?: OpenApproval | null
    /** Whether the seat is the owner's. */
    readonly owner?: boolean
}

/** A step of the old engine that waits on the work item `wi-1`. */
const stepOf = builder<RunStepDetail>({
    stepKey: "ask",
    nodeKey: "ask",
    kind: "ask",
    ordinal: 1,
    status: "running",
    attempt: 1,
    maxAttempts: 1,
    startedAt: null,
    endedAt: null,
    durationMs: null,
    errorCode: null,
    waitItemId: "wi-1",
    workItemId: null,
    input: {},
    result: null,
    calls: [],
})

/** An open approval stop of a run, before its step and item are named. */
const stopOf = builder<RunStop>({
    id: "stop-1",
    version: "v1",
    runId: "run-1",
    stepKey: "send-qr",
    agentId: "agent-1",
    workflowId: null,
    contactId: null,
    conversationId: null,
    kind: "approval",
    state: "open",
    reason: "",
    question: null,
    detail: { suggestions: [], facts: [] },
    cardMessageId: null,
    customerLines: [],
    answers: [],
    decision: null,
    repeats: 1,
    stoppedAt: "2026-11-11T01:00:00.000Z",
    resolvedAt: null,
})

/** A thread run that waits at a stop: its steps name no item, the approval STOP does. */
const threadRun = (): RunDetail => ({ run: mock<RunRecord>({ id: "run-1", status: "waiting" }), engine: "langgraph", steps: [] })

/** A run of the deleted old engine (history): one step that names the work item `wi-1`. */
const oldRun = (): RunDetail => ({
    run: mock<RunRecord>({ id: "run-1", status: "waiting" }),
    engine: "legacy",
    steps: [stepOf({})],
})

/** The work item as the views read it. */
const itemRow = (action: string, status = "waiting_decision") => ({
    item: { id: "wi-1", action, status, reason: null, error: null, proposal: { summary: SEND_ORDER_SUMMARY_VI, fields: {} } },
})

/** The thread runs the service hands every verdict to (one double: the door must be handed exactly them). */
const THREADS = mock<ThreadResumeRequestsService>()

/** The open approval stop a case offers: the default one, or the named one, or none. */
const stopsOf = (options: BuildOptions): ReadonlyArray<RunStop> => {
    const open = options.openItem === undefined ? { stepKey: "send-qr", workItemId: "wi-1" } : options.openItem
    if (open === null) return []
    return [stopOf({ stepKey: open.stepKey, detail: { suggestions: [], facts: [{ name: "workItemId", value: open.workItemId }] } })]
}

const build = async (options: BuildOptions = {}) => {
    const runs = mock<AgentRunsViewService>({ detail: jest.fn().mockResolvedValue(options.old === true ? oldRun() : threadRun()) })
    const approvals = mock<RunStopRecordsService>({ ofRun: jest.fn().mockResolvedValue(stopsOf(options)) })
    const items = mock<WorkItemsViewsReadService>({
        find: jest.fn().mockResolvedValue(itemRow(options.action ?? "approve_tool_call", options.status)),
    })
    const work = mock<ThreadApprovalsService>({
        verdict: jest.fn().mockResolvedValue(options.outcome ?? { kind: "decided", workItemId: "wi-1", status: "done" }),
    })
    const access = mock<AgentWorkAccessService>({
        managedInstallation: jest.fn(options.manager ?? (() => Promise.resolve(INSTALLATION()))),
        owner: jest.fn(() =>
            options.owner === false
                ? Promise.reject(new RunStopsError({ code: RunStopsErrorCode.NotFound }))
                : Promise.resolve("member-1"),
        ),
    })
    const members = mock<WorkspaceMembersService>({ idOf: jest.fn().mockResolvedValue("member-1") })
    const container = await Test.createTestingModule({
        providers: [
            AgentRunDecisionsService,
            { provide: AgentWorkAccessService, useValue: access },
            { provide: AgentRunsViewService, useValue: runs },
            { provide: WorkItemsViewsReadService, useValue: items },
            { provide: WorkspaceMembersService, useValue: members },
            { provide: RunStopRecordsService, useValue: approvals },
            { provide: ThreadApprovalsService, useValue: work },
            { provide: ThreadResumeRequestsService, useValue: THREADS },
        ],
    }).compile()
    const service = container.get(AgentRunDecisionsService)
    const decide = (verdict: AgentRunVerdict, stepKey?: string) =>
        service.decide("user-1", "ws-1", "inst-1", "run-1", stepKey ?? null, verdict, "vi")
    return { decide, work, approvals, items }
}

describe("AgentRunDecisionsService (the approval STOP of a thread run names the item)", () => {
    it("finds the item through the run's open approval stop of the step and approves it through the inbox's door, as the owner", async () => {
        const { decide, work, approvals } = await build()

        await expect(decide("approve", "send-qr")).resolves.toEqual({ ok: true, refusal: null, accepted: null })

        expect(approvals.ofRun).toHaveBeenCalledWith("ws-1", "run-1")
        expect(work.verdict).toHaveBeenCalledWith(
            { workspaceId: "ws-1", workItemId: "wi-1", verdict: "approved", by: "member-1", owner: true, locale: "vi" },
            THREADS,
        )
    })

    it("lets only the owner approve; a manager may refuse, through the same door", async () => {
        const manager = await build({ owner: false })

        await expect(manager.decide("approve")).resolves.toEqual({ ok: false, refusal: "not_an_approver", accepted: null })
        expect(manager.work.verdict).not.toHaveBeenCalled()
        await expect(manager.decide("reject")).resolves.toEqual({ ok: true, refusal: null, accepted: null })
        expect(manager.work.verdict).toHaveBeenCalledWith(
            { workspaceId: "ws-1", workItemId: "wi-1", verdict: "refused", by: "member-1", owner: false, locale: "vi" },
            THREADS,
        )
    })

    it("answers decision_not_found when the thread run waits on no approval", async () => {
        const { decide, work } = await build({ openItem: null })

        await expect(decide("approve")).resolves.toEqual({ ok: false, refusal: "decision_not_found", accepted: null })
        expect(work.verdict).not.toHaveBeenCalled()
    })

    it("answers decision_not_found for a run of the old engine, and reads no stop or item of it", async () => {
        const { decide, work, approvals, items } = await build({ old: true })

        await expect(decide("approve")).resolves.toEqual({ ok: false, refusal: "decision_not_found", accepted: null })
        expect(approvals.ofRun).not.toHaveBeenCalled()
        expect(items.find).not.toHaveBeenCalled()
        expect(work.verdict).not.toHaveBeenCalled()
    })

    it("refuses a seat that is not an owner or manager before it reads anything", async () => {
        const denied = new RunStopsError({ code: RunStopsErrorCode.NotFound })
        const { decide, work, approvals } = await build({ manager: () => Promise.reject(denied) })

        await expect(decide("approve")).rejects.toBe(denied)
        expect(approvals.ofRun).not.toHaveBeenCalled()
        expect(work.verdict).not.toHaveBeenCalled()
    })

    it("answers a refusal, not a failure, when the approvals' door says the seat may not decide the item", async () => {
        const { decide } = await build({ outcome: { kind: "refused", code: "not_owner" } })

        await expect(decide("approve")).resolves.toEqual({ ok: false, refusal: "not_an_approver", accepted: null })
    })

    it("answers that a decision somebody else already took is closed", async () => {
        const { decide } = await build({ outcome: { kind: "refused", code: "not_waiting" } })

        await expect(decide("approve")).resolves.toEqual({ ok: false, refusal: "decision_closed", accepted: null })
    })

    it("takes nothing for an item that no longer waits", async () => {
        const { decide, work } = await build({ status: "done" })

        await expect(decide("approve")).resolves.toEqual({ ok: false, refusal: "decision_closed", accepted: null })
        expect(work.verdict).not.toHaveBeenCalled()
    })

    it("offers a retry, not an approval, for an item that only wants another try", async () => {
        const { decide, work } = await build({ action: "connect_sepay" })

        await expect(decide("approve")).resolves.toEqual({
            ok: false,
            refusal: "option_not_offered",
            accepted: ["retry", "reject"],
        })
        await expect(decide("retry")).resolves.toEqual({ ok: true, refusal: null, accepted: null })
        expect(work.verdict).toHaveBeenCalledWith(
            { workspaceId: "ws-1", workItemId: "wi-1", verdict: "approved", by: "member-1", owner: true, locale: "vi" },
            THREADS,
        )
    })
})

describe("AgentRunDecisionsService (a verdict the permission request does not offer)", () => {
    it("refuses retry with the verdicts the request takes, before the inbox door is reached: the item still waits, nothing is replayed", async () => {
        const { decide, work } = await build()

        await expect(decide("retry")).resolves.toEqual({
            ok: false,
            refusal: "option_not_offered",
            accepted: ["approve", "reject"],
        })
        expect(work.verdict).not.toHaveBeenCalled()
    })

    it("approves once and declines once, each through the inbox door with its own decision", async () => {
        const approved = await build()
        const declined = await build()

        await expect(approved.decide("approve")).resolves.toEqual({ ok: true, refusal: null, accepted: null })
        await expect(declined.decide("reject")).resolves.toEqual({ ok: true, refusal: null, accepted: null })

        expect(approved.work.verdict).toHaveBeenCalledTimes(1)
        expect(approved.work.verdict).toHaveBeenCalledWith(
            { workspaceId: "ws-1", workItemId: "wi-1", verdict: "approved", by: "member-1", owner: true, locale: "vi" },
            THREADS,
        )
        expect(declined.work.verdict).toHaveBeenCalledTimes(1)
        expect(declined.work.verdict).toHaveBeenCalledWith(
            { workspaceId: "ws-1", workItemId: "wi-1", verdict: "refused", by: "member-1", owner: true, locale: "vi" },
            THREADS,
        )
    })
})
