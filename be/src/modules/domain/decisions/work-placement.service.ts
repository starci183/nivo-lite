import { Injectable } from "@nestjs/common"
import { StaffDirectoryService } from "@modules/domain/staff"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { WorkspaceMembersService, canDecide } from "@modules/domain/workspace-members"
import type { WorkspaceRole } from "@modules/domain/workspace-members"
import { InjectMessageCatalog } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { WorkItemsService } from "@modules/domain/work-items"
import type { WorkContext, WorkItem } from "./decisions.contracts"
import { DecisionsService } from "./decisions.service"
import { DecisionsError, DecisionsErrorCode } from "./errors/decisions.error"
import { EvidenceService } from "./evidence.service"
import type { AssignWorkRequest, HoldWorkRequest } from "./work-decision.contracts"
import { assigneeOf } from "./work-decision.policy"

/** The roles that govern who an item belongs to. */
const MANAGERS: ReadonlyArray<WorkspaceRole> = ["owner", "manager"]

@Injectable()
/** Holds a waiting item, or gives it to a staff member, without deciding it. */
export class WorkPlacementService {
    constructor(
        @InjectMessageCatalog() private readonly catalog: MessageCatalog,
        private readonly members: WorkspaceMembersService,
        private readonly decisions: DecisionsService,
        private readonly evidence: EvidenceService,
        private readonly items: WorkItemsService,
        private readonly staff: StaffDirectoryService,
        @InjectClock() private readonly clock: Clock,
    ) {}

    /**
     * Keeps a waiting item waiting and records why there is not enough basis yet. The item stays `waiting_decision`.
     * Owner and manager may hold anything; staff only what is assigned to them.
     */
    async hold(principalId: string, workspaceId: string, request: HoldWorkRequest): Promise<WorkItem> {
        const item = await this.decisions.getWorkItem(principalId, workspaceId, request.workItemId)
        const member = await this.members.require(principalId, workspaceId)
        if (!canDecide(member, assigneeOf(item))) throw new DecisionsError({ code: DecisionsErrorCode.NotAllowed })
        const note = request.note.trim().replace(/\s+/g, " ")
        if (note === "") throw new DecisionsError({ code: DecisionsErrorCode.HoldNoteRequired })
        if (item.status !== "waiting_decision") throw new DecisionsError({ code: DecisionsErrorCode.NotWaiting })
        const proposal = {
            ...item.proposal,
            fields: {
                ...item.proposal.fields,
                hold_note: note,
                hold_by: member.displayName,
                hold_at: this.clock.now().toISOString(),
            },
        }
        const kept = await this.items.hold(workspaceId, item.id, proposal)
        if (!kept) throw new DecisionsError({ code: DecisionsErrorCode.NotWaiting })
        const ctx: WorkContext = { workspaceId, actor: member.displayName, locale: request.locale }
        await this.evidence.log(ctx, {
            lead_id: item.lead_id,
            work_item_id: item.id,
            kind: "work.held",
            actor: member.displayName,
            summary: this.catalog.get("decision.holdEvidence", { note }, request.locale),
            evidence: note,
        })
        return this.decisions.getWorkItem(principalId, workspaceId, item.id)
    }

    /** Gives an item to a staff member, or takes the assignment back. Owner and manager only. */
    async assign(principalId: string, workspaceId: string, request: AssignWorkRequest): Promise<WorkItem> {
        const member = await this.members.require(principalId, workspaceId, MANAGERS)
        const item = await this.decisions.getWorkItem(principalId, workspaceId, request.workItemId)
        const staffId = request.staffId ?? null
        const staffName = await this.staffName(workspaceId, staffId)
        const assigned = await this.items.assign(workspaceId, item.id, staffId)
        if (!assigned) throw new DecisionsError({ code: DecisionsErrorCode.NotFound })
        const ctx: WorkContext = { workspaceId, actor: member.displayName, locale: request.locale }
        const summary =
            staffName === null
                ? this.catalog.get("decision.unassigned", {}, request.locale)
                : this.catalog.get("decision.assigned", { name: staffName }, request.locale)
        await this.evidence.log(ctx, {
            lead_id: item.lead_id,
            work_item_id: item.id,
            kind: "work.assigned",
            actor: member.displayName,
            summary,
        })
        return this.decisions.getWorkItem(principalId, workspaceId, item.id)
    }

    private async staffName(workspaceId: string, staffId: string | null): Promise<string | null> {
        if (staffId === null) return null
        const [person] = await this.staff.namesOf(workspaceId, [staffId])
        if (person === undefined) throw new DecisionsError({ code: DecisionsErrorCode.StaffNotFound })
        return person.name
    }
}
