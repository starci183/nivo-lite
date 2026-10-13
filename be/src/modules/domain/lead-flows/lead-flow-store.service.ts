import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { LeadFlowsError, LeadFlowsErrorCode } from "./errors/lead-flows.error"
import { saveParams, toLeadFlow } from "./lead-flow.mapper"
import type {
    Identity,
    LeadFlow,
    LeadFlowPatch,
    NewLeadFlow,
    OptionalLeadFlow,
    OptionalText,
} from "./lead-flows.contracts"
import type { LeadFlowRow } from "./persistence/lead-flows.rows"
import { FIND_FLOW_BY_LEAD, FIND_FLOW_CANDIDATES, INSERT_FLOW, SAVE_FLOW } from "./persistence/lead-flows.sql"

@Injectable()
/** The only writer of public.lead_flows: one row per prospect that came in through Facebook or Instagram. */
export class LeadFlowStoreService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** The flow of a lead of the workspace, or null. */
    async byLead(workspaceId: string, leadId: OptionalText): Promise<OptionalLeadFlow> {
        if (leadId === null) return null
        const [row] = await this.entityManager.query<Array<LeadFlowRow>>(FIND_FLOW_BY_LEAD, [workspaceId, leadId])
        return row === undefined ? null : toLeadFlow(row)
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
        const rows = await this.entityManager.query<Array<LeadFlowRow>>(FIND_FLOW_CANDIDATES, [
            workspaceId,
            id.psid,
            id.igsid,
            id.phone,
            id.email,
        ])
        return rows.map(toLeadFlow)
    }

    /** Opens a flow; null when the same person was opened at the same moment (a unique key is taken). */
    async open(flow: NewLeadFlow): Promise<OptionalLeadFlow> {
        const [row] = await this.entityManager.query<Array<LeadFlowRow>>(INSERT_FLOW, [
            flow.workspaceId,
            flow.leadId,
            flow.connectionId,
            flow.platform,
            flow.identity.psid,
            flow.identity.igsid,
            flow.identity.phone,
            flow.identity.email,
            flow.name,
            JSON.stringify(flow.source),
            JSON.stringify([flow.source]),
            flow.lastUserAt,
            flow.lastUserText,
        ])
        return row === undefined ? null : toLeadFlow(row)
    }

    /** Applies a change to a flow and answers the stored row. */
    async patch(flow: LeadFlow, patch: LeadFlowPatch): Promise<LeadFlow> {
        const [row] = await this.entityManager.query<Array<LeadFlowRow>>(SAVE_FLOW, saveParams({ ...flow, ...patch }))
        if (row === undefined) throw new LeadFlowsError({ code: LeadFlowsErrorCode.NotStored })
        return toLeadFlow(row)
    }
}
