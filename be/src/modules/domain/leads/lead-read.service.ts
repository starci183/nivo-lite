import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { LeadsError, LeadsErrorCode } from "./errors/leads.error"
import type { LeadView } from "./lead-read.contracts"
import { FIND_LEAD_VIEW, LIST_LEAD_VIEWS, LIST_LEAD_VIEWS_BY_IDS } from "./persistence/lead-read.sql"

@Injectable()
/** Workspace-scoped lead reads used after the caller's membership has been proved. */
export class LeadReadService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** The recent leads of the workspace, newest first. */
    list(workspaceId: string): Promise<Array<LeadView>> {
        return this.entityManager.query<Array<LeadView>>(LIST_LEAD_VIEWS, [workspaceId])
    }

    /** Reads the customer references of a bounded work-item listing, including older leads outside the board's window. */
    listByIds(workspaceId: string, leadIds: ReadonlyArray<string>): Promise<Array<LeadView>> {
        if (leadIds.length === 0) return Promise.resolve([])
        return this.entityManager.query<Array<LeadView>>(LIST_LEAD_VIEWS_BY_IDS, [workspaceId, leadIds])
    }

    /** One lead of the workspace; an unknown or foreign id raises the same not-found error. */
    async require(workspaceId: string, leadId: string): Promise<LeadView> {
        const [lead] = await this.entityManager.query<Array<LeadView>>(FIND_LEAD_VIEW, [workspaceId, leadId])
        if (lead === undefined) throw new LeadsError({ code: LeadsErrorCode.NotFound, params: { id: leadId } })
        return lead
    }
}
