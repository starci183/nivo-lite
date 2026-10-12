import { Injectable } from "@nestjs/common"
import { ExecutionsService } from "@modules/domain/executions"
import type { ExecutionRow } from "@modules/domain/executions"
import { WorkspaceMembersService, canDecide } from "@modules/domain/workspace-members"
import type { WorkspaceMember } from "@modules/domain/workspace-members"
import { InjectMessageCatalog } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import type { WorkContext, WorkItem } from "./decisions.contracts"
import { DecisionsService } from "./decisions.service"
import { DecisionsError, DecisionsErrorCode } from "./errors/decisions.error"
import { EvidenceService } from "./evidence.service"
import type { DecideExecutionRequest, DecideWorkRequest } from "./work-decision.contracts"
import { BASIS_MIN_CHARS, assigneeOf, basisMissing, cleanBasis, decisionNote, deciderOf } from "./work-decision.policy"
import { WorkEngineService } from "./work-engine.service"

/** The status of a card nobody decided yet. */
const PENDING_CARD = "pending_approval"

@Injectable()
/** A person's decision on a waiting work item or on its approval card: proves membership and the right to decide, then resumes the work. */
export class WorkDecisionService {
    constructor(
        @InjectMessageCatalog() private readonly catalog: MessageCatalog,
        private readonly members: WorkspaceMembersService,
        private readonly decisions: DecisionsService,
        private readonly engine: WorkEngineService,
        private readonly executions: ExecutionsService,
        private readonly evidence: EvidenceService,
    ) {}

    /**
     * Approves (optionally edited) or rejects a waiting work item. Owner and manager decide anything, staff only what is
     * assigned to them. A payment reconciliation cannot be approved without a written basis, which is kept in the decision
     * note and the evidence log.
     */
    async decide(principalId: string, workspaceId: string, request: DecideWorkRequest): Promise<WorkItem> {
        const item = await this.decisions.getWorkItem(principalId, workspaceId, request.workItemId)
        const member = await this.members.require(principalId, workspaceId)
        return this.resume(member, item, request)
    }

    /**
     * Approves (optionally with an edited draft) or rejects the approval card of a follow-up draft: the work item behind the
     * card is decided and the card is settled. A card somebody decided already answers a typed refusal.
     */
    async decideExecution(
        principalId: string,
        workspaceId: string,
        request: DecideExecutionRequest,
    ): Promise<ExecutionRow> {
        const member = await this.members.require(principalId, workspaceId)
        const card = await this.executions.find(workspaceId, request.executionId)
        if (card === null || card.work_item_id === null) {
            throw new DecisionsError({ code: DecisionsErrorCode.NotFound })
        }
        if (card.status !== PENDING_CARD) throw new DecisionsError({ code: DecisionsErrorCode.NotWaiting })
        const item = await this.decisions.getWorkItem(principalId, workspaceId, card.work_item_id)
        const editedDraft = request.editedDraft
        await this.resume(member, item, {
            workItemId: item.id,
            decision: request.decision,
            edits: editedDraft === null ? {} : { draft: editedDraft },
            note: null,
            basis: null,
            locale: request.locale,
        })
        const settled = await this.executions.settle({
            workspaceId,
            executionId: card.id,
            decision: request.decision,
            decidedBy: member.displayName,
            editedDraft,
        })
        return settled ?? { ...card, status: request.decision, draft: editedDraft ?? card.draft }
    }

    private async resume(member: WorkspaceMember, item: WorkItem, request: DecideWorkRequest): Promise<WorkItem> {
        if (!canDecide(member, assigneeOf(item))) throw new DecisionsError({ code: DecisionsErrorCode.NotAllowed })
        const basis = request.decision === "approved" ? cleanBasis(request.basis) : ""
        if (request.decision === "approved" && basisMissing(item.action, basis)) {
            throw new DecisionsError({
                code: DecisionsErrorCode.BasisRequired,
                params: { n: BASIS_MIN_CHARS },
            })
        }
        const ctx: WorkContext = { workspaceId: item.workspace_id, actor: member.displayName, locale: request.locale }
        const basisLine = basis === "" ? "" : this.catalog.get("decision.basisNote", { basis }, request.locale)
        const by = deciderOf(member)
        const done = await this.engine.resumeWork(
            ctx,
            item.id,
            request.decision,
            request.edits,
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
