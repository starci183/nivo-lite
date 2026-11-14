import { Injectable, Optional } from "@nestjs/common"
import { AgentRunsViewService } from "@modules/domain/agent-runs"
import {
    RunStopRecordsService,
    ThreadApprovalsService,
    ThreadResumeRequestsService,
    openApprovalItemOf,
} from "@modules/domain/agent-threads"
import { AgentWorkAccessService, itemOf, verdictOf } from "@modules/domain/agent-work"
import type { InstallationRecord } from "@modules/domain/module-installations"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { WorkItemsViewsReadService } from "@modules/domain/work-items"
import { DomainError } from "@modules/platform/errors"
import type { Locale } from "@modules/platform/i18n"
import type { OptionalText } from "./agent-pages.contracts"
import type {
    AgentRunDecideRefusal,
    AgentRunVerdict,
    DecideAgentRunStepOutcome,
} from "./agent-run-decisions.contracts"

const TAKEN: DecideAgentRunStepOutcome = { ok: true, refusal: null, accepted: null }

const refused = (refusal: AgentRunDecideRefusal): DecideAgentRunStepOutcome => ({ ok: false, refusal, accepted: null })

@Injectable()
/**
 * Answers the approval a thread run waits on, in place on the run page, through the thread approvals' one door, so there is one source
 * of truth and the run goes on exactly as it would from the chat card. Only an owner or manager may answer, and only the owner may
 * approve (the door refuses anyone else's approval); a manager may refuse. A verdict the waiting item does not offer (a `retry`
 * on a permission request, any other word) is refused with the verdicts it takes, and nothing is written. A run of the deleted old
 * engine has nothing to decide.
 */
export class AgentRunDecisionsService {
    constructor(
        private readonly access: AgentWorkAccessService,
        private readonly runs: AgentRunsViewService,
        private readonly items: WorkItemsViewsReadService,
        private readonly members: WorkspaceMembersService,
        @Optional() private readonly stops?: RunStopRecordsService,
        @Optional() private readonly approvals?: ThreadApprovalsService,
        @Optional() private readonly threads?: ThreadResumeRequestsService,
    ) {}

    /** Answers the decision the run of an agent instance waits on, as an owner or manager of the workspace. */
    async decide(
        userId: string,
        workspaceId: string,
        installationId: string,
        runId: string,
        stepKey: OptionalText,
        verdictWord: AgentRunVerdict,
        locale: Locale,
    ): Promise<DecideAgentRunStepOutcome> {
        const installation = await this.access.managedInstallation(userId, workspaceId, installationId)
        const itemId = await this.waitingItemOf(workspaceId, installation, runId, stepKey ?? null)
        if (itemId === null) return refused("decision_not_found")
        const found = await this.items.find(workspaceId, itemId)
        if (found === null) return refused("decision_not_found")
        const item = itemOf(found.item)
        if (item.status !== "waiting_decision") return refused("decision_closed")
        // The verdict is read against the closed set the item offers, before anything is written: no other word is an approval.
        const verdict = verdictOf(item.action, verdictWord)
        if (verdict.kind === "not_offered") return { ok: false, refusal: "option_not_offered", accepted: verdict.accepted }
        const approves = verdict.kind === "approve"
        // A thread's approval is the owner's alone (the door refuses anyone else's approval); a manager may still refuse it.
        const owner = await this.isOwner(userId, workspaceId)
        if (approves && !owner) return refused("not_an_approver")
        return this.decideItem(userId, workspaceId, itemId, approves, owner, locale)
    }

    /**
     * The work item the run waits on. A run on a LangGraph thread names no item on its steps (`waitItemId` is null by design): its open
     * approval STOP (of the named step, else the newest) names the owner's item, which is decided through the approvals' door. A run
     * of the old engine (history) waits on nothing.
     */
    private async waitingItemOf(
        workspaceId: string,
        installation: InstallationRecord | null,
        runId: string,
        stepKey: string | null,
    ): Promise<string | null> {
        if (installation?.agentId == null) return null
        const detail = await this.runs.detail(workspaceId, installation.agentId, runId)
        if (detail?.engine !== "langgraph") return null
        const stops = (await this.stops?.ofRun(workspaceId, runId)) ?? []
        return openApprovalItemOf(stops, stepKey)?.workItemId ?? null
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

    /** The thread approvals' door, as the member: the item taken, the verdict handed to the run's stop, the item closed. */
    private async decideItem(
        userId: string,
        workspaceId: string,
        workItemId: string,
        approves: boolean,
        owner: boolean,
        locale: Locale,
    ): Promise<DecideAgentRunStepOutcome> {
        if (this.approvals === undefined || this.threads === undefined) return refused("decision_not_found")
        const outcome = await this.approvals.verdict(
            {
                workspaceId,
                workItemId,
                verdict: approves ? "approved" : "refused",
                by: await this.members.idOf(userId, workspaceId),
                owner,
                locale,
            },
            this.threads,
        )
        if (outcome.kind === "decided") return TAKEN
        if (outcome.code === "not_owner") return refused("not_an_approver")
        if (outcome.code === "not_found") return refused("decision_not_found")
        return refused("decision_closed")
    }
}
