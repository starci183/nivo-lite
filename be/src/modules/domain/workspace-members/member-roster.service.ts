import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { WorkspaceMemberEntity } from "./persistence/entities"

/** A member of a workspace as a roster lists it. */
export interface RosterMember {
    /** The member account. */
    readonly userId: string
    /** The role. */
    readonly role: string
    /** The name shown. */
    readonly displayName: string
    /** The status. */
    readonly status: string
    /** When the member joined. */
    readonly createdAt: Date
}

@Injectable()
/** The member roster of a workspace for readers that prove access themselves (the platform team console). */
export class MemberRosterService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** The members of a workspace, oldest first, at most `limit`. */
    async oldestOf(workspaceId: string, limit: number): Promise<Array<RosterMember>> {
        const rows = await this.entityManager.find(WorkspaceMemberEntity, {
            select: { userId: true, role: true, displayName: true, status: true, createdAt: true },
            where: { workspaceId },
            order: { createdAt: "ASC" },
            take: limit,
        })
        return rows.map(({ userId, role, displayName, status, createdAt }) => ({
            userId,
            role,
            displayName,
            status,
            createdAt,
        }))
    }
}
