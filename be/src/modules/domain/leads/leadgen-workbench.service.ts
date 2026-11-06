import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { WorkItemsService } from "@modules/domain/work-items"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import type { LeadGenInstallationId, LeadGenLeadRecord, LeadGenWorkbenchData } from "./leadgen-workbench.contracts"
import { buildLeadGenWorkbench } from "./leadgen-workbench.mapper"
import { LeadEntity } from "./persistence/entities"

/** The most leads the workbench reads. */
const LEAD_LIMIT = 500

/** The most work items the workbench reads. */
const ITEM_LIMIT = 600

const isTestRun = (...names: ReadonlyArray<string | null | undefined>): boolean =>
    names.some((name) => typeof name === "string" && /UAT|DBG/u.test(name))

@Injectable()
/** The Lead Gen workbench over the same lead and work rows the flow already writes. */
export class LeadGenWorkbenchService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectClock() private readonly clock: Clock,
        private readonly members: WorkspaceMembersService,
        private readonly items: WorkItemsService,
    ) {}

    /** Any workspace member may read its prospects; an optional instance limits the page to that agent. */
    async read(
        userId: string,
        workspaceId: string,
        installationId: LeadGenInstallationId,
    ): Promise<LeadGenWorkbenchData> {
        await this.members.require(userId, workspaceId)
        const nowMs = this.clock.now().getTime()
        const [leads, items] = await Promise.all([
            this.leads(workspaceId),
            this.items.listForWorkbench(workspaceId, ITEM_LIMIT),
        ])
        return buildLeadGenWorkbench({ nowMs, installationId: installationId ?? null, leads, items, isTestRun })
    }

    /** Latest leads of the workspace, matching the existing workbench's bounded read. */
    private leads(workspaceId: string): Promise<Array<LeadGenLeadRecord>> {
        return this.entityManager
            .createQueryBuilder(LeadEntity, "l")
            .select("l.id", "id")
            .addSelect("l.contactName", "contact_name")
            .addSelect("l.company", "company")
            .addSelect("l.channel", "channel")
            .addSelect("l.need", "need")
            .addSelect("l.stage", "stage")
            .addSelect("l.installationId", "installation_id")
            .addSelect("to_json(l.created_at) #>> '{}'", "created_at")
            .where("l.workspaceId = :workspaceId", { workspaceId })
            .orderBy("l.created_at", "DESC")
            .limit(LEAD_LIMIT)
            .getRawMany<LeadGenLeadRecord>()
    }
}
