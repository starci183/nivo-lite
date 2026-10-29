import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { InboundEventFeedRow } from "./inbound-events.contracts"
import { InboundEventEntity } from "./persistence/entities"

/** The creation time as UTC ISO text with milliseconds, the shape the feed always answered. */
const CREATED_AT_TEXT = `to_char(e.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`

@Injectable()
/** Reads inbox feeds only after proving the caller's active workspace membership. */
export class InboxFeedService {
    constructor(
        private readonly members: WorkspaceMembersService,
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
    ) {}

    /** Lists a bounded feed from the verified member's selected workspace. */
    async list(userId: string, workspaceId: string, limit: number): Promise<ReadonlyArray<InboundEventFeedRow>> {
        await this.members.require(userId, workspaceId)
        return this.entityManager
            .createQueryBuilder(InboundEventEntity, "e")
            .select("e.id", "id")
            .addSelect("e.workspaceId", "workspace_id")
            .addSelect("e.channel", "channel")
            .addSelect("e.kind", "kind")
            .addSelect("e.senderName", "sender_name")
            .addSelect("e.senderContact", "sender_contact")
            .addSelect("e.body", "body")
            .addSelect("e.amount_vnd::float8", "amount_vnd")
            .addSelect("e.externalRef", "external_ref")
            .addSelect("e.eventId", "event_id")
            .addSelect("e.leadId", "lead_id")
            .addSelect("e.status", "status")
            .addSelect("e.duplicateCount", "duplicate_count")
            .addSelect(CREATED_AT_TEXT, "created_at")
            .where("e.workspaceId = :workspaceId", { workspaceId })
            .orderBy("e.createdAt", "DESC")
            .addOrderBy("e.id", "DESC")
            .limit(Math.max(1, Math.min(100, Math.trunc(limit))))
            .getRawMany<InboundEventFeedRow>()
    }
}
