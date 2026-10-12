import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { BookingsError, BookingsErrorCode } from "./errors/bookings.error"
import { SELECT_MEMBER_ROLE } from "./persistence/booking-model.sql"

const MANAGER_ROLES: ReadonlyArray<string> = ["owner", "manager"]

@Injectable()
/** Decides whether a verified caller may read or change the bookings of a workspace, from the workspace membership. */
export class BookingAccessService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** Refuses a caller who is not an active member of the workspace. */
    async requireMember(workspaceId: string, userId: string): Promise<void> {
        await this.roleOf(workspaceId, userId)
    }

    /** Refuses a caller who is not an active owner or manager of the workspace. */
    async requireManager(workspaceId: string, userId: string): Promise<void> {
        const role = await this.roleOf(workspaceId, userId)
        if (!MANAGER_ROLES.includes(role)) throw new BookingsError({ code: BookingsErrorCode.Forbidden })
    }

    private async roleOf(workspaceId: string, userId: string): Promise<string> {
        const [row] = await this.entityManager.query<Array<{ role: string }>>(SELECT_MEMBER_ROLE, [workspaceId, userId])
        if (row === undefined) throw new BookingsError({ code: BookingsErrorCode.Forbidden })
        return row.role
    }
}
