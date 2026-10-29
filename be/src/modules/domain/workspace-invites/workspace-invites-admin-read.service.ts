import { Injectable } from "@nestjs/common"
import { IsNull } from "typeorm"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { WorkspaceInviteEntity } from "./persistence/entities"

/** A pending invitation as the console lists it. */
export interface PendingInviteRow {
    /** The invitation id. */
    readonly id: string
    /** The invited address. */
    readonly email: string
    /** The role offered. */
    readonly role: string
    /** When it was sent. */
    readonly createdAt: Date
    /** When it lapses. */
    readonly expiresAt: Date
}

@Injectable()
/** Invitation reads for the platform team console. */
export class WorkspaceInvitesAdminReadService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** The invitations of a workspace that are neither accepted nor revoked, newest first, at most `limit`. */
    async pendingOf(workspaceId: string, limit: number): Promise<Array<PendingInviteRow>> {
        const rows = await this.entityManager.find(WorkspaceInviteEntity, {
            select: { id: true, email: true, role: true, createdAt: true, expiresAt: true },
            where: { workspaceId, acceptedAt: IsNull(), revokedAt: IsNull() },
            order: { createdAt: "DESC" },
            take: limit,
        })
        return rows.map(({ id, email, role, createdAt, expiresAt }) => ({ id, email, role, createdAt, expiresAt }))
    }
}
