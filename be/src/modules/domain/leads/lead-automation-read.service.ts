import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type {
    AutomationLeadRead,
    AutomationScanLead,
    AutomationScanLeadsQuery,
} from "./lead-automation-read.contracts"
import { LeadEntity } from "./persistence/entities"

@Injectable()
/** The lead reads the automations make: one lead, the leads a scan looks at, and the counts of the day report. */
export class LeadAutomationReadService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** One lead of a workspace, or none. */
    lead(workspaceId: string, leadId: string): Promise<AutomationLeadRead | undefined> {
        return this.entityManager
            .createQueryBuilder(LeadEntity, "l")
            .select([
                "l.id AS id",
                "l.contact_name AS contact_name",
                "l.company AS company",
                "l.channel AS channel",
                "l.need AS need",
                "l.stage AS stage",
                "l.phone AS phone",
                "l.email AS email",
            ])
            .where("l.workspace_id = :workspaceId AND l.id = :leadId", { workspaceId, leadId })
            .limit(1)
            .getRawOne<AutomationLeadRead>()
    }

    /** The leads created after an instant, newest first, bounded by the query. */
    scanLeads(query: AutomationScanLeadsQuery): Promise<Array<AutomationScanLead>> {
        const leads = this.entityManager
            .createQueryBuilder(LeadEntity, "l")
            .select(["l.id AS id", "l.stage AS stage", "l.created_at AS created_at"])
            .where("l.workspace_id = :workspaceId AND l.created_at >= :since", {
                workspaceId: query.workspaceId,
                since: query.since,
            })
        if (query.stages !== null) leads.andWhere("l.stage = ANY(:stages)", { stages: query.stages })
        if (query.except !== null) leads.andWhere("l.stage <> :except", { except: query.except })
        return leads.orderBy("l.created_at", "DESC").limit(query.limit).getRawMany<AutomationScanLead>()
    }

    /** How many leads of the workspace were created from an instant on, read through the transaction of the caller. */
    async countCreatedSince(workspaceId: string, start: string, manager: EntityManager): Promise<number> {
        const row = await manager
            .createQueryBuilder(LeadEntity, "l")
            .select("count(*)::int", "count")
            .where("l.workspace_id = :workspaceId AND l.created_at >= :start", { workspaceId, start })
            .getRawOne<{ count: number }>()
        return row?.count ?? 0
    }

    /** How many of the given leads stand at the won stage, read through the transaction of the caller. */
    async countWonAmong(workspaceId: string, leadIds: ReadonlyArray<string>, manager: EntityManager): Promise<number> {
        if (leadIds.length === 0) return 0
        const row = await manager
            .createQueryBuilder(LeadEntity, "l")
            .select("count(*)::int", "count")
            .where("l.workspace_id = :workspaceId AND l.stage = 'won' AND l.id = ANY(:leadIds::uuid[])", {
                workspaceId,
                leadIds,
            })
            .getRawOne<{ count: number }>()
        return row?.count ?? 0
    }
}
