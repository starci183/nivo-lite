import { Injectable } from "@nestjs/common"
import type { EntityManager, FindOptionsWhere } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { LeadFlowsError, LeadFlowsErrorCode } from "./errors/lead-flows.error"
import { saveValues, toLeadFlow } from "./lead-flow.mapper"
import type {
    Identity,
    LeadFlow,
    LeadFlowPatch,
    NewLeadFlow,
    OptionalLeadFlow,
    OptionalText,
} from "./lead-flows.contracts"
import { LeadFlowEntity } from "./persistence/entities"
import { NOW, leadFlowOfRaw } from "./persistence/lead-flow.projection"

/** The most flows an identity can match. */
const CANDIDATES_MAX = 20

@Injectable()
/** The only writer of public.lead_flows: one row per prospect that came in through Facebook or Instagram. */
export class LeadFlowStoreService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** The flow of a lead of the workspace, or null. */
    async byLead(workspaceId: string, leadId: OptionalText): Promise<OptionalLeadFlow> {
        if (leadId === null) return null
        const row = await this.entityManager.findOne(LeadFlowEntity, { where: { workspaceId, leadId } })
        return row === null ? null : toLeadFlow(row)
    }

    /** The flow of a lead; a lead without one is an error of the step that asked. */
    async requireByLead(workspaceId: string, leadId: OptionalText): Promise<LeadFlow> {
        const flow = await this.byLead(workspaceId, leadId)
        if (flow === null) throw new LeadFlowsError({ code: LeadFlowsErrorCode.NoFlow })
        return flow
    }

    /** The flows any key of the identity matches; `matchFlow` picks the strongest. */
    async candidates(workspaceId: string, id: Identity): Promise<ReadonlyArray<LeadFlow>> {
        if (id.psid === null && id.igsid === null && id.phone === null && id.email === null) return []
        const keys: Array<FindOptionsWhere<LeadFlowEntity>> = []
        if (id.psid !== null) keys.push({ workspaceId, psid: id.psid })
        if (id.igsid !== null) keys.push({ workspaceId, igsid: id.igsid })
        if (id.phone !== null) keys.push({ workspaceId, phone: id.phone })
        if (id.email !== null) keys.push({ workspaceId, email: id.email })
        const rows = await this.entityManager.find(LeadFlowEntity, {
            where: keys,
            order: { createdAt: "ASC" },
            take: CANDIDATES_MAX,
        })
        return rows.map(toLeadFlow)
    }

    /** Opens a flow; null when the same person was opened at the same moment (a unique key is taken). */
    async open(flow: NewLeadFlow): Promise<OptionalLeadFlow> {
        const inserted = await this.entityManager
            .createQueryBuilder(LeadFlowEntity, "lf")
            .insert()
            .values({
                workspaceId: flow.workspaceId,
                leadId: flow.leadId,
                connectionId: flow.connectionId,
                platform: flow.platform,
                psid: flow.identity.psid,
                igsid: flow.identity.igsid,
                phone: flow.identity.phone,
                email: flow.identity.email,
                name: flow.name,
                source: flow.source,
                touches: [flow.source],
                lastUserAt: flow.lastUserAt === null ? null : new Date(flow.lastUserAt),
                lastUserText: flow.lastUserText,
            })
            .orIgnore()
            .returning("*")
            .execute()
        const row = leadFlowOfRaw(inserted.raw)
        return row === undefined ? null : toLeadFlow(row)
    }

    /** Applies a change to a flow and answers the stored row. */
    async patch(flow: LeadFlow, patch: LeadFlowPatch): Promise<LeadFlow> {
        const saved = await this.entityManager
            .createQueryBuilder(LeadFlowEntity, "lf")
            .update()
            .set({ ...saveValues({ ...flow, ...patch }), updatedAt: NOW })
            .where({ id: flow.id, workspaceId: flow.workspace_id })
            .returning("*")
            .execute()
        const row = leadFlowOfRaw(saved.raw)
        if (row === undefined) throw new LeadFlowsError({ code: LeadFlowsErrorCode.NotStored })
        return toLeadFlow(row)
    }
}
