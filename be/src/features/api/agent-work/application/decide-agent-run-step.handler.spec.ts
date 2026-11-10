import { mock } from "@starci/jest-preset"
import type { AgentGraphDecisionsService } from "@modules/domain/agent-graphs"
import type { AgentRunsViewService, RunDetail } from "@modules/domain/agent-runs"
import type { AgentWorkAccessService } from "@modules/domain/agent-work"
import { DecisionsError, DecisionsErrorCode } from "@modules/domain/decisions"
import type { WorkDecisionService, WorkItem } from "@modules/domain/decisions"
import type { InstallationRecordsService } from "@modules/domain/module-installations"
import type { TeamChatDecisionService } from "@modules/domain/team-chat"
import type { WorkItemsViewsReadService } from "@modules/domain/work-items"
import type { Logger } from "@modules/platform/logging"
import { DecideAgentRunStepCommand } from "./decide-agent-run-step.command"
import type { AgentRunVerdict } from "./decide-agent-run-step.contracts"
import { DecideAgentRunStepHandler } from "./decide-agent-run-step.handler"

const REQUEST_ID = "req-1"

/** The run: one step that waits on the work item `wi-1`. */
const waitingRun = (): RunDetail =>
    ({
        run: { id: "run-1", status: "waiting" },
        steps: [
            {
                stepKey: "ask",
                nodeKey: "ask",
                ordinal: 1,
                status: "waiting",
                waitItemId: "wi-1",
                workItemId: null,
                input: {},
                result: {},
                calls: [],
                attempt: 1,
                maxAttempts: 3,
                startedAt: null,
                durationMs: null,
                errorCode: null,
            },
        ],
    }) as unknown as RunDetail

/** The work item as the views read it. */
const itemRow = (action: string, status = "waiting_decision") => ({
    item: { id: "wi-1", action, status, reason: null, error: null, proposal: { summary: "Gửi đơn", fields: {} } },
})

interface Built {
    readonly handler: DecideAgentRunStepHandler
    readonly access: AgentWorkAccessService
    readonly chat: TeamChatDecisionService
    readonly work: WorkDecisionService
}

const build = (
    options: {
        readonly action?: string
        readonly status?: string
        readonly asked?: boolean
        readonly chatAnswer?: Awaited<ReturnType<TeamChatDecisionService["decide"]>>
        readonly manager?: () => Promise<string>
        readonly workDecide?: () => Promise<never>
    } = {},
): Built => {
    const access = mock<AgentWorkAccessService>({
        manager: jest.fn(options.manager ?? (() => Promise.resolve("member-1"))),
    })
    const installations = mock<InstallationRecordsService>({
        find: jest.fn().mockResolvedValue({ agentId: "agent-1" }),
    })
    const runs = mock<AgentRunsViewService>({ detail: jest.fn().mockResolvedValue(waitingRun()) })
    const items = mock<WorkItemsViewsReadService>({
        find: jest.fn().mockResolvedValue(itemRow(options.action ?? "approve_order", options.status)),
    })
    const graphDecisions = mock<AgentGraphDecisionsService>({
        byItem: jest.fn().mockResolvedValue(
            options.asked === true
                ? { closed: false, approvalRequestId: REQUEST_ID }
                : { closed: false, approvalRequestId: null },
        ),
    })
    const chat = mock<TeamChatDecisionService>({
        decide: jest.fn().mockResolvedValue(options.chatAnswer ?? { ok: true, approval: {} }),
    })
    const work = mock<WorkDecisionService>({
        decide: jest.fn(options.workDecide ?? (() => Promise.resolve({} as WorkItem))),
    })
    const handler = new DecideAgentRunStepHandler(
        mock<Logger>(),
        access,
        installations,
        runs,
        items,
        graphDecisions,
        chat,
        work,
    )
    return { handler, access, chat, work }
}

const commandOf = (verdict: AgentRunVerdict): DecideAgentRunStepCommand =>
    new DecideAgentRunStepCommand({
        request: { workspaceId: "ws-1", installationId: "inst-1", runId: "run-1", verdict, locale: "vi" },
        principal: { id: "user-1" } as never,
    })

describe("DecideAgentRunStepHandler", () => {
    it("approves the waiting item through the inbox door, which resumes the run", async () => {
        const { handler, work, chat } = build()

        await expect(handler.execute(commandOf("approve"))).resolves.toEqual({ ok: true, refusal: null })
        expect(work.decide).toHaveBeenCalledWith("user-1", "ws-1", {
            workItemId: "wi-1",
            decision: "approved",
            locale: "vi",
        })
        expect(chat.decide).not.toHaveBeenCalled()
    })

    it("refuses the waiting item through the same door, so the module's own rule parks or ends the run", async () => {
        const { handler, work } = build()

        await expect(handler.execute(commandOf("reject"))).resolves.toEqual({ ok: true, refusal: null })
        expect(work.decide).toHaveBeenCalledWith("user-1", "ws-1", {
            workItemId: "wi-1",
            decision: "rejected",
            locale: "vi",
        })
    })

    it("settles the open request of the group as the chat card does when the graph asked one", async () => {
        const { handler, work, chat } = build({ asked: true })

        await expect(handler.execute(commandOf("approve"))).resolves.toEqual({ ok: true, refusal: null })
        expect(chat.decide).toHaveBeenCalledWith("ws-1", "user-1", REQUEST_ID, "approve")
        expect(work.decide).not.toHaveBeenCalled()
    })

    it("sends a refusal to the request of the group with the reject verdict", async () => {
        const { handler, chat } = build({ asked: true })

        await handler.execute(commandOf("reject"))

        expect(chat.decide).toHaveBeenCalledWith("ws-1", "user-1", REQUEST_ID, "reject")
    })

    it("lets the owner answer the item itself when the group did not name them", async () => {
        const { handler, work } = build({ asked: true, chatAnswer: { ok: false, refusal: "not_an_approver" } })

        await expect(handler.execute(commandOf("approve"))).resolves.toEqual({ ok: true, refusal: null })
        expect(work.decide).toHaveBeenCalledTimes(1)
    })

    it("answers that a request somebody settled first is closed", async () => {
        const { handler, work } = build({ asked: true, chatAnswer: { ok: false, refusal: "decision_closed" } })

        await expect(handler.execute(commandOf("approve"))).resolves.toEqual({ ok: false, refusal: "decision_closed" })
        expect(work.decide).not.toHaveBeenCalled()
    })

    it("refuses a seat that is not an owner or manager before it reads anything", async () => {
        const denied = new DecisionsError({ code: DecisionsErrorCode.NotAllowed })
        const { handler, work, chat } = build({ manager: () => Promise.reject(denied) })

        await expect(handler.execute(commandOf("approve"))).rejects.toBe(denied)
        expect(work.decide).not.toHaveBeenCalled()
        expect(chat.decide).not.toHaveBeenCalled()
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

    it("offers a retry, not an approval, for an order whose payment details could not go out", async () => {
        const { handler, work } = build({ action: "connect_sepay" })

        await expect(handler.execute(commandOf("approve"))).resolves.toEqual({
            ok: false,
            refusal: "option_not_offered",
        })
        await expect(handler.execute(commandOf("retry"))).resolves.toEqual({ ok: true, refusal: null })
        expect(work.decide).toHaveBeenCalledWith("user-1", "ws-1", {
            workItemId: "wi-1",
            decision: "approved",
            locale: "vi",
        })
    })
})
