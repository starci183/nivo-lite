import { Optional } from "@nestjs/common"
import { CommandHandler } from "@nestjs/cqrs"
import { AgentGraphDecisionsService } from "@modules/domain/agent-graphs"
import { AgentRunsViewService } from "@modules/domain/agent-runs"
import { RunStopRecordsService, openApprovalItemOf } from "@modules/domain/agent-threads"
import { AgentWorkAccessService } from "@modules/domain/agent-work"
import { DecisionsError, DecisionsErrorCode, WorkDecisionService } from "@modules/domain/decisions"
import { InstallationRecordsService } from "@modules/domain/module-installations"
import { TeamChatDecisionService } from "@modules/domain/team-chat"
import { WorkItemsViewsReadService } from "@modules/domain/work-items"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { DomainError } from "@modules/platform/errors"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { decidingItemIdOf, optionsOf } from "./agent-run-decision.policy"
import { itemOf, stepLineOf } from "./agent-runs-view.policy"
import { DecideAgentRunStepCommand } from "./decide-agent-run-step.command"
import type {
    AgentRunDecideRefusal,
    DecideAgentRunStepOutcome,
    DecideAgentRunStepRequest,
} from "./decide-agent-run-step.contracts"

const TAKEN: DecideAgentRunStepOutcome = { ok: true, refusal: null }

/** The work item a run waits on, and whether it is a thread run's approval item (found through its stop). */
interface WaitingItem {
    /** The work item. */
    readonly itemId: string
    /** True for a run on a LangGraph thread. */
    readonly thread: boolean
}

const refused = (refusal: AgentRunDecideRefusal): DecideAgentRunStepOutcome => ({ ok: false, refusal })

@CommandHandler(DecideAgentRunStepCommand)
/**
 * Answers the decision a run waits on, in place on the run page, through the same doors the cards in the chat and the inbox use, so
 * there is one source of truth and the run goes on exactly as it would from there. When the graph asked a group, the open request is
 * settled as the chat card does it (the group's rules and the events that resume the run are the decisions core's); an owner the group
 * did not name, and an item no request was opened for, answer the work item as the inbox does. Only an owner or manager may answer.
 */
export class DecideAgentRunStepHandler extends ICQRSHandler<DecideAgentRunStepCommand, DecideAgentRunStepOutcome> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly access: AgentWorkAccessService,
        private readonly installations: InstallationRecordsService,
        private readonly runs: AgentRunsViewService,
        private readonly items: WorkItemsViewsReadService,
        private readonly graphDecisions: AgentGraphDecisionsService,
        private readonly chat: TeamChatDecisionService,
        private readonly work: WorkDecisionService,
        @Optional() private readonly stops?: RunStopRecordsService,
    ) {
        super(logger)
    }

    protected override async process(command: DecideAgentRunStepCommand): Promise<DecideAgentRunStepOutcome> {
        const { principal, request } = command.params
        await this.access.manager(principal.id, request.workspaceId)
        const waiting = await this.waitingItemOf(request)
        if (waiting === null) return refused("decision_not_found")
        const { itemId } = waiting
        const found = await this.items.find(request.workspaceId, itemId)
        if (found === null) return refused("decision_not_found")
        const item = itemOf(found.item)
        if (item.status !== "waiting_decision") return refused("decision_closed")
        if (!optionsOf(item.action).includes(request.verdict)) return refused("option_not_offered")
        const approves = request.verdict !== "reject"
        // A thread's approval is the owner's alone (the performer refuses anyone else's approval); a manager may still refuse it.
        if (waiting.thread) {
            if (approves && !(await this.isOwner(principal.id, request.workspaceId))) return refused("not_an_approver")
            return this.decideItem(principal.id, request, itemId, approves)
        }
        const asked = await this.graphDecisions.byItem(request.workspaceId, itemId)
        if (asked !== null && !asked.closed && asked.approvalRequestId !== null) {
            const settled = await this.chat.decide(
                request.workspaceId,
                principal.id,
                asked.approvalRequestId,
                approves ? "approve" : "reject",
            )
            if (settled.ok) return TAKEN
            if (settled.refusal !== "not_an_approver") return refused(settled.refusal)
        }
        return this.decideItem(principal.id, request, itemId, approves)
    }

    /**
     * The work item the run waits on. A run on a LangGraph thread names no item on its steps (`waitItemId` is null by design): its open
     * approval STOP (of the named step, else the newest) names the owner's item, which is decided through the inbox's own door. Any
     * other run: the item its waiting step names, else the one the run is about.
     */
    private async waitingItemOf(request: DecideAgentRunStepRequest): Promise<WaitingItem | null> {
        const installation = await this.installations.find(request.workspaceId, request.installationId)
        if (installation?.agentId == null) return null
        const detail = await this.runs.detail(request.workspaceId, installation.agentId, request.runId)
        if (detail === null) return null
        if (detail.engine === "langgraph") {
            const stops = (await this.stops?.ofRun(request.workspaceId, request.runId)) ?? []
            const open = openApprovalItemOf(stops, request.stepKey ?? null)
            return open === null ? null : { itemId: open.workItemId, thread: true }
        }
        const steps = detail.steps.map(stepLineOf)
        const first = steps.find((step) => step.workItemId !== null)?.workItemId ?? null
        const about = first === null ? null : await this.items.find(request.workspaceId, first)
        const itemId = decidingItemIdOf(steps, about === null ? null : itemOf(about.item))
        return itemId === null ? null : { itemId, thread: false }
    }

    /** True for the workspace's owner seat; a manager (or anyone else) is not. */
    private async isOwner(userId: string, workspaceId: string): Promise<boolean> {
        try {
            await this.access.owner(userId, workspaceId)
            return true
        } catch (cause) {
            if (cause instanceof DomainError) return false
            throw cause
        }
    }

    /** The inbox's own door: the owner and manager decide anything, a staff seat only what is assigned to it. */
    private async decideItem(
        userId: string,
        request: DecideAgentRunStepRequest,
        workItemId: string,
        approves: boolean,
    ): Promise<DecideAgentRunStepOutcome> {
        try {
            await this.work.decide(userId, request.workspaceId, {
                workItemId,
                decision: approves ? "approved" : "rejected",
                locale: request.locale,
            })
            return TAKEN
        } catch (cause) {
            if (cause instanceof DecisionsError && cause.code === DecisionsErrorCode.NotAllowed)
                return refused("not_an_approver")
            if (cause instanceof DecisionsError && cause.code === DecisionsErrorCode.NotWaiting)
                return refused("decision_closed")
            throw cause
        }
    }
}
