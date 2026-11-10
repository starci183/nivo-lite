import { mock } from "@starci/jest-preset"
import type { AgentRunsViewService, RunDetail } from "@modules/domain/agent-runs"
import type { RunStop, RunStopRecordsService } from "@modules/domain/agent-threads"
import type { AgentWorkAccessService } from "@modules/domain/agent-work"
import { DecisionsError, DecisionsErrorCode } from "@modules/domain/decisions"
import type { WorkDecisionService, WorkItem } from "@modules/domain/decisions"
import type { InstallationRecordsService } from "@modules/domain/module-installations"
import type { WorkItemsViewsReadService } from "@modules/domain/work-items"
import type { Logger } from "@modules/platform/logging"
import { DecideAgentRunStepCommand } from "./decide-agent-run-step.command"
import type { AgentRunVerdict } from "./decide-agent-run-step.contracts"
import { DecideAgentRunStepHandler } from "./decide-agent-run-step.handler"

/** A thread run that waits at a stop: its steps name no item, the approval STOP does. */
const threadRun = (): RunDetail =>
    ({ run: { id: "run-1", status: "waiting" }, engine: "langgraph", steps: [] }) as unknown as RunDetail

/** A run of the deleted old engine (history): one step that names the work item `wi-1`. */
const oldRun = (): RunDetail =>
    ({
        run: { id: "run-1", status: "waiting" },
        engine: "legacy",
        steps: [{ stepKey: "ask", status: "running", waitItemId: "wi-1", workItemId: null }],
    }) as unknown as RunDetail

/** The work item as the views read it. */
const itemRow = (action: string, status = "waiting_decision") => ({
    item: { id: "wi-1", action, status, reason: null, error: null, proposal: { summary: "Gửi đơn", fields: {} } },
})

interface Built {
    readonly handler: DecideAgentRunStepHandler
    readonly work: WorkDecisionService
    readonly approvals: RunStopRecordsService
    readonly items: WorkItemsViewsReadService
}

const build = (
    options: {
        readonly action?: string
        readonly status?: string
        readonly manager?: () => Promise<string>
        readonly workDecide?: () => Promise<never>
        readonly old?: boolean
        readonly openItem?: { readonly stepKey: string; readonly workItemId: string } | null
        readonly owner?: boolean
    } = {},
): Built => {
    const access = mock<AgentWorkAccessService>({
        manager: jest.fn(options.manager ?? (() => Promise.resolve("member-1"))),
        owner: jest.fn(() =>
            options.owner === false
                ? Promise.reject(new DecisionsError({ code: DecisionsErrorCode.NotAllowed }))
                : Promise.resolve("member-1"),
        ),
    })
    const installations = mock<InstallationRecordsService>({
        find: jest.fn().mockResolvedValue({ agentId: "agent-1" }),
    })
    const runs = mock<AgentRunsViewService>({
        detail: jest.fn().mockResolvedValue(options.old === true ? oldRun() : threadRun()),
    })
    const approvalStop = (item: { readonly stepKey: string; readonly workItemId: string }): RunStop =>
        ({
            stepKey: item.stepKey,
            kind: "approval",
            state: "open",
            stoppedAt: "2026-11-11T01:00:00.000Z",
            detail: { suggestions: [], facts: [{ name: "workItemId", value: item.workItemId }] },
        }) as unknown as RunStop
    const open = options.openItem === undefined ? { stepKey: "send-qr", workItemId: "wi-1" } : options.openItem
    const approvals = mock<RunStopRecordsService>({
        ofRun: jest.fn().mockResolvedValue(open === null ? [] : [approvalStop(open)]),
    })
    const items = mock<WorkItemsViewsReadService>({
        find: jest.fn().mockResolvedValue(itemRow(options.action ?? "approve_tool_call", options.status)),
    })
    const work = mock<WorkDecisionService>({
        decide: jest.fn(options.workDecide ?? (() => Promise.resolve({} as WorkItem))),
    })
    const handler = new DecideAgentRunStepHandler(mock<Logger>(), access, installations, runs, items, work, approvals)
    return { handler, work, approvals, items }
}

const commandOf = (verdict: AgentRunVerdict, stepKey?: string): DecideAgentRunStepCommand =>
    new DecideAgentRunStepCommand({
        request: { workspaceId: "ws-1", installationId: "inst-1", runId: "run-1", verdict, locale: "vi", stepKey: stepKey ?? null },
        principal: { id: "user-1" } as never,
    })

describe("DecideAgentRunStepHandler (the approval STOP of a thread run names the item)", () => {
    it("finds the item through the run's open approval stop of the step and approves it through the inbox's door, as the owner", async () => {
        const { handler, work, approvals } = build()

        await expect(handler.execute(commandOf("approve", "send-qr"))).resolves.toEqual({ ok: true, refusal: null })

        expect(approvals.ofRun).toHaveBeenCalledWith("ws-1", "run-1")
        expect(work.decide).toHaveBeenCalledWith("user-1", "ws-1", { workItemId: "wi-1", decision: "approved", locale: "vi" })
    })

    it("lets only the owner approve; a manager may refuse, through the same door", async () => {
        const manager = build({ owner: false })

        await expect(manager.handler.execute(commandOf("approve"))).resolves.toEqual({ ok: false, refusal: "not_an_approver" })
        expect(manager.work.decide).not.toHaveBeenCalled()
        await expect(manager.handler.execute(commandOf("reject"))).resolves.toEqual({ ok: true, refusal: null })
        expect(manager.work.decide).toHaveBeenCalledWith("user-1", "ws-1", { workItemId: "wi-1", decision: "rejected", locale: "vi" })
    })

    it("answers decision_not_found when the thread run waits on no approval", async () => {
        const { handler, work } = build({ openItem: null })

        await expect(handler.execute(commandOf("approve"))).resolves.toEqual({ ok: false, refusal: "decision_not_found" })
        expect(work.decide).not.toHaveBeenCalled()
    })

    it("answers decision_not_found for a run of the old engine, and reads no stop or item of it", async () => {
        const { handler, work, approvals, items } = build({ old: true })

        await expect(handler.execute(commandOf("approve"))).resolves.toEqual({ ok: false, refusal: "decision_not_found" })
        expect(approvals.ofRun).not.toHaveBeenCalled()
        expect(items.find).not.toHaveBeenCalled()
        expect(work.decide).not.toHaveBeenCalled()
    })

    it("refuses a seat that is not an owner or manager before it reads anything", async () => {
        const denied = new DecisionsError({ code: DecisionsErrorCode.NotAllowed })
        const { handler, work, approvals } = build({ manager: () => Promise.reject(denied) })

        await expect(handler.execute(commandOf("approve"))).rejects.toBe(denied)
        expect(approvals.ofRun).not.toHaveBeenCalled()
        expect(work.decide).not.toHaveBeenCalled()
    })

    it("answers a refusal, not a failure, when the inbox door says the seat may not decide the item", async () => {
        const { handler } = build({
            workDecide: () => Promise.reject(new DecisionsError({ code: DecisionsErrorCode.NotAllowed })),
        })

        await expect(handler.execute(commandOf("approve"))).resolves.toEqual({ ok: false, refusal: "not_an_approver" })
    })

    it("answers that a decision somebody else already took is closed", async () => {
        const { handler } = build({
            workDecide: () => Promise.reject(new DecisionsError({ code: DecisionsErrorCode.NotWaiting })),
        })

        await expect(handler.execute(commandOf("approve"))).resolves.toEqual({ ok: false, refusal: "decision_closed" })
    })

    it("takes nothing for an item that no longer waits", async () => {
        const { handler, work } = build({ status: "done" })

        await expect(handler.execute(commandOf("approve"))).resolves.toEqual({ ok: false, refusal: "decision_closed" })
        expect(work.decide).not.toHaveBeenCalled()
    })

    it("offers a retry, not an approval, for an item that only wants another try", async () => {
        const { handler, work } = build({ action: "connect_sepay" })

        await expect(handler.execute(commandOf("approve"))).resolves.toEqual({ ok: false, refusal: "option_not_offered" })
        await expect(handler.execute(commandOf("retry"))).resolves.toEqual({ ok: true, refusal: null })
        expect(work.decide).toHaveBeenCalledWith("user-1", "ws-1", { workItemId: "wi-1", decision: "approved", locale: "vi" })
    })
})
