import { Injectable, Optional } from "@nestjs/common"
import { InjectWorkBranchDecider, type WorkBranchDecider } from "@modules/domain/authority-rules"
import {
    WorkspaceMembersService,
    canDecide,
    type WorkspaceMember,
    type WorkspaceRole,
} from "@modules/domain/workspace-members"
import { InjectMessageCatalog, type Locale, type MessageCatalog } from "@modules/platform/i18n"
import { CLAIM_LEASE_SECONDS } from "@modules/domain/work-items"
import { CommandBusService } from "./command-bus.service"
import type { CommandResult, WorkContext, WorkItem } from "./decisions.contracts"
import { DecisionsService } from "./decisions.service"
import { DecisionsError, DecisionsErrorCode } from "./errors/decisions.error"
import { EvidenceService } from "./evidence.service"
import type { WorkDecisionRequest, SendOwnerCommandRequest, QueuedWorkIntent } from "./work-decision.contracts"
import { BASIS_MIN_CHARS, assigneeOf, basisMissing, cleanBasis, decisionNote, deciderOf } from "./work-decision.policy"
import { commandPayloadOf, workEditsOf } from "./work-wire.mapper"
import { WorkEngineService } from "./work-engine.service"

/** The roles that govern: only they command the agents. */
const MANAGERS: ReadonlyArray<WorkspaceRole> = ["owner", "manager"]

@Injectable()
/** A person's decision on a waiting work item: proves membership and the right to decide, then resumes the work. */
export class WorkDecisionService {
    constructor(
        @InjectMessageCatalog() private readonly catalog: MessageCatalog,
        private readonly members: WorkspaceMembersService,
        private readonly decisions: DecisionsService,
        private readonly bus: CommandBusService,
        private readonly engine: WorkEngineService,
        private readonly evidence: EvidenceService,
        @Optional() @InjectWorkBranchDecider() private readonly branches?: WorkBranchDecider,
    ) {}

    /** Proves the caller may act on the queued item before draining the workspace's gated steps. */
    async runQueued(
        principalId: string,
        workspaceId: string,
        workItemId: string,
        locale: Locale,
        intent: QueuedWorkIntent,
    ): Promise<void> {
        const item = await this.decisions.getWorkItem(principalId, workspaceId, workItemId)
        const member = await this.members.require(principalId, workspaceId)
        if (intent === "retry" && !canDecide(member, assigneeOf(item)))
            throw new DecisionsError({ code: DecisionsErrorCode.NotAllowed })
        if (intent === "handoff" && (item.action !== "issue_invoice" || item.subject_type !== "order")) {
            throw new DecisionsError({ code: DecisionsErrorCode.NotAllowed })
        }
        if (item.status !== "queued") return
        const ctx = { workspaceId, actor: member.displayName, locale }
        const processed = await this.engine.runQueuedItem(ctx, item.id)
        if (processed === null) {
            const current = await this.decisions.getWorkItem(principalId, workspaceId, item.id)
            if (current.status === "queued")
                throw new DecisionsError({
                    code: DecisionsErrorCode.WorkBusy,
                    params: { retryAfterSeconds: CLAIM_LEASE_SECONDS },
                })
        }
        await this.engine.runQueued(ctx, 3)
    }

    /**
     * Approves (optionally edited) or rejects a waiting work item. Owner and manager decide anything, staff only what is
     * assigned to them. A payment reconciliation cannot be approved without a written basis, which is kept in the decision
     * note and the evidence log.
     */
    async decide(principalId: string, workspaceId: string, request: WorkDecisionRequest): Promise<WorkItem> {
        const item = await this.decisions.getWorkItem(principalId, workspaceId, request.workItemId)
        const member = await this.members.require(principalId, workspaceId)
        return this.resume(member, await this.members.idOf(principalId, workspaceId), item, request)
    }

    /** Sends a command to an agent as the owner; owner and manager only. A refusal is answered, not thrown. */
    async sendCommand(
        principalId: string,
        workspaceId: string,
        request: SendOwnerCommandRequest,
    ): Promise<CommandResult> {
        const member = await this.members.require(principalId, workspaceId, MANAGERS)
        const ctx: WorkContext = { workspaceId, actor: member.displayName, locale: request.locale }
        return this.bus.sendCommand(ctx, {
            from: "owner",
            to: request.to,
            command: request.command,
            payload: commandPayloadOf(request),
            reason: request.reason,
        })
    }

    private async resume(
        member: WorkspaceMember,
        memberId: string,
        item: WorkItem,
        request: WorkDecisionRequest,
    ): Promise<WorkItem> {
        if (!canDecide(member, assigneeOf(item))) throw new DecisionsError({ code: DecisionsErrorCode.NotAllowed })
        const named = await this.branches?.mayDecide({
            workspaceId: item.workspace_id,
            workItemId: item.id,
            memberId,
            isOwner: member.role === "owner",
        })
        if (named === false) throw new DecisionsError({ code: DecisionsErrorCode.NotAllowed })
        const basis = request.decision === "approved" ? cleanBasis(request.basis) : ""
        if (request.decision === "approved" && basisMissing(item.action, basis)) {
            throw new DecisionsError({
                code: DecisionsErrorCode.BasisRequired,
                params: { n: BASIS_MIN_CHARS },
            })
        }
        const ctx: WorkContext = { workspaceId: item.workspace_id, actor: member.displayName, locale: request.locale }
        const basisLine = basis === "" ? "" : this.catalog.get("decision.basisNote", { basis }, request.locale)
        const by = deciderOf(member, memberId)
        const done = await this.engine.resumeWork(
            ctx,
            item.id,
            request.decision,
            workEditsOf(request.edits),
            by,
            decisionNote(basisLine, request.note),
        )
        if (basis !== "") {
            await this.evidence.log(ctx, {
                lead_id: done.lead_id,
                work_item_id: done.id,
                kind: "decision.basis",
                actor: by.name,
                summary: basisLine,
                evidence: basis,
            })
        }
        return done
    }
}
