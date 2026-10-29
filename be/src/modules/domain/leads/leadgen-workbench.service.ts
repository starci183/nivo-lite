import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import type {
    LeadGenConversationRecord,
    LeadGenInstallationId,
    LeadGenLeadRecord,
    LeadGenMessageRecord,
    LeadGenWorkbenchData,
    LeadGenWorkItemRecord,
} from "./leadgen-workbench.contracts"
import { buildLeadGenWorkbench, conversionSinceIso } from "./leadgen-workbench.mapper"
import { LeadEntity } from "./persistence/entities"

/** The most leads the workbench reads. */
const LEAD_LIMIT = 500

/** The most work items the workbench reads. */
const ITEM_LIMIT = 600

/** The most conversations the workbench reads. */
const CONVERSATION_LIMIT = 1000

/** The most messages the workbench reads. */
const MESSAGE_LIMIT = 8000

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
            this.leads(workspaceId),
            this.items(workspaceId),
            this.conversations(workspaceId),
            this.messages(workspaceId, conversionSinceIso(nowMs)),
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

    /** Capture, scoring, public-comment and sales-handoff records in their original newest-first order. */
    private items(workspaceId: string): Promise<Array<LeadGenWorkItemRecord>> {
        return this.entityManager
            .createQueryBuilder()
            .select("w.id", "id")
            .addSelect("w.department", "department")
            .addSelect("w.action", "action")
            .addSelect("w.lead_id", "lead_id")
            .addSelect("w.installation_id", "installation_id")
            .addSelect("w.status", "status")
            .addSelect("w.proposal", "proposal")
            .addSelect("to_json(w.created_at) #>> '{}'", "created_at")
            .addSelect("to_json(w.completed_at) #>> '{}'", "completed_at")
            .from("public.work_items", "w")
            .where("w.workspace_id = :workspaceId", { workspaceId })
            .orderBy("w.created_at", "DESC")
            .limit(ITEM_LIMIT)
            .getRawMany<LeadGenWorkItemRecord>()
    }

    /** Conversations with a captured customer; only these contribute last messages and reply times. */
    private conversations(workspaceId: string): Promise<Array<LeadGenConversationRecord>> {
        return this.entityManager
            .createQueryBuilder()
            .select("c.id", "id")
            .addSelect("c.lead_id", "lead_id")
            .from("public.agent_conversations", "c")
            .where("c.workspace_id = :workspaceId AND c.kind = 'customer' AND c.lead_id IS NOT NULL", { workspaceId })
            .limit(CONVERSATION_LIMIT)
            .getRawMany<LeadGenConversationRecord>()
    }

    /** Messages in the conversion window, oldest first. */
    private messages(workspaceId: string, sinceIso: string): Promise<Array<LeadGenMessageRecord>> {
        return this.entityManager
            .createQueryBuilder()
            .select("m.conversation_id", "conversation_id")
            .addSelect("m.role", "role")
            .addSelect("m.body", "body")
            .addSelect("to_json(m.created_at) #>> '{}'", "created_at")
            .from("public.agent_messages", "m")
            .where("m.workspace_id = :workspaceId AND m.created_at >= CAST(:since AS timestamptz)", {
                workspaceId,
                since: sinceIso,
            })
            .orderBy("m.created_at", "ASC")
            .limit(MESSAGE_LIMIT)
            .getRawMany<LeadGenMessageRecord>()
    }
}
