import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import type { LeadGenInstallationId, LeadGenWorkbenchData } from "./leadgen-workbench.contracts"
import { buildLeadGenWorkbench, conversionSinceIso } from "./leadgen-workbench.mapper"
import type {
    LeadGenConversationRow,
    LeadGenLeadRow,
    LeadGenWorkItemRow,
    LeadGenMessageRow,
} from "./persistence/leadgen-workbench.rows"
import {
    LIST_LEADGEN_CONVERSATIONS,
    LIST_LEADGEN_ITEMS,
    LIST_LEADGEN_LEADS,
    LIST_LEADGEN_MESSAGES,
} from "./persistence/leadgen-workbench.sql"

const isTestRun = (...names: ReadonlyArray<string | null | undefined>): boolean =>
    names.some((name) => typeof name === "string" && /UAT|DBG/u.test(name))

@Injectable()
/** The Lead Gen workbench over the same lead, work and conversation rows the flow already writes. */
export class LeadGenWorkbenchService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectClock() private readonly clock: Clock,
        private readonly members: WorkspaceMembersService,
    ) {}

    /** Any workspace member may read its prospects; an optional instance limits the page to that agent. */
    async read(
        userId: string,
        workspaceId: string,
        installationId: LeadGenInstallationId,
    ): Promise<LeadGenWorkbenchData> {
        await this.members.require(userId, workspaceId)
        const nowMs = this.clock.now().getTime()
        const [leads, items, conversations, messages] = await Promise.all([
            this.entityManager.query<Array<LeadGenLeadRow>>(LIST_LEADGEN_LEADS, [workspaceId]),
            this.entityManager.query<Array<LeadGenWorkItemRow>>(LIST_LEADGEN_ITEMS, [workspaceId]),
            this.entityManager.query<Array<LeadGenConversationRow>>(LIST_LEADGEN_CONVERSATIONS, [workspaceId]),
            this.entityManager.query<Array<LeadGenMessageRow>>(LIST_LEADGEN_MESSAGES, [
                workspaceId,
                conversionSinceIso(nowMs),
            ]),
        ])
        return buildLeadGenWorkbench({
            nowMs,
            installationId: installationId ?? null,
            leads,
            items,
            conversations,
            messages,
            isTestRun,
        })
    }
}
