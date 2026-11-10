import { Optional } from "@nestjs/common"
import { CommandHandler } from "@nestjs/cqrs"
import { AgentRunsViewService } from "@modules/domain/agent-runs"
import { RunStopRecordsService, openApprovalItemOf } from "@modules/domain/agent-threads"
import { AgentWorkAccessService } from "@modules/domain/agent-work"
import { DecisionsError, DecisionsErrorCode, WorkDecisionService } from "@modules/domain/decisions"
import { InstallationRecordsService } from "@modules/domain/module-installations"
import { WorkItemsViewsReadService } from "@modules/domain/work-items"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { DomainError } from "@modules/platform/errors"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { optionsOf } from "./agent-run-decision.policy"
import { itemOf } from "./agent-runs-view.policy"
import { DecideAgentRunStepCommand } from "./decide-agent-run-step.command"
import type {
    AgentRunDecideRefusal,
    DecideAgentRunStepOutcome,
    DecideAgentRunStepRequest,
} from "./decide-agent-run-step.contracts"

const TAKEN: DecideAgentRunStepOutcome = { ok: true, refusal: null }

const refused = (refusal: AgentRunDecideRefusal): DecideAgentRunStepOutcome => ({ ok: false, refusal })

@CommandHandler(DecideAgentRunStepCommand)
/**
 * Answers the approval a thread run waits on, in place on the run page, through the inbox's own door, so there is one source of truth
 * and the run goes on exactly as it would from the inbox or the chat card. Only an owner or manager may answer, and only the owner may
 * approve (the performer refuses anyone else's approval); a manager may refuse. A run of the deleted old engine has nothing to decide.
 */
export class DecideAgentRunStepHandler extends ICQRSHandler<DecideAgentRunStepCommand, DecideAgentRunStepOutcome> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly access: AgentWorkAccessService,
        private readonly installations: InstallationRecordsService,
        private readonly runs: AgentRunsViewService,
        private readonly items: WorkItemsViewsReadService,
        private readonly work: WorkDecisionService,
        @Optional() private readonly stops?: RunStopRecordsService,
    ) {
        super(logger)
    }

    protected override async process(command: DecideAgentRunStepCommand): Promise<DecideAgentRunStepOutcome> {
        const { principal, request } = command.params
        await this.access.manager(principal.id, request.workspaceId)
        const itemId = await this.waitingItemOf(request)
        if (itemId === null) return refused("decision_not_found")
        const found = await this.items.find(request.workspaceId, itemId)
        if (found === null) return refused("decision_not_found")
        const item = itemOf(found.item)
        if (item.status !== "waiting_decision") return refused("decision_closed")
        if (!optionsOf(item.action).includes(request.verdict)) return refused("option_not_offered")
        const approves = request.verdict !== "reject"
        // A thread's approval is the owner's alone (the performer refuses anyone else's approval); a manager may still refuse it.
        if (approves && !(await this.isOwner(principal.id, request.workspaceId))) return refused("not_an_approver")
        return this.decideItem(principal.id, request, itemId, approves)
    }

    /**
     * The work item the run waits on. A run on a LangGraph thread names no item on its steps (`waitItemId` is null by design): its open
     * approval STOP (of the named step, else the newest) names the owner's item, which is decided through the inbox's own door. A run of
     * the old engine (history) waits on nothing.
     */
    private async waitingItemOf(request: DecideAgentRunStepRequest): Promise<string | null> {
        const installation = await this.installations.find(request.workspaceId, request.installationId)
        if (installation?.agentId == null) return null
        const detail = await this.runs.detail(request.workspaceId, installation.agentId, request.runId)
        if (detail === null || detail.engine !== "langgraph") return null
        const stops = (await this.stops?.ofRun(request.workspaceId, request.runId)) ?? []
        return openApprovalItemOf(stops, request.stepKey ?? null)?.workItemId ?? null
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
