import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { InboundEventFeedRow } from "./persistence/inbound-events.rows"
import { LIST_INBOUND_EVENTS } from "./persistence/inbound-events.sql"

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
        return this.entityManager.query<Array<InboundEventFeedRow>>(LIST_INBOUND_EVENTS, [
            workspaceId,
            Math.max(1, Math.min(100, Math.trunc(limit))),
        ])
    }
}
