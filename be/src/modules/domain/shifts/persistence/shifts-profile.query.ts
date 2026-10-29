import type { EntityManager } from "typeorm"
import { ShiftsStaffEntity } from "./entities"

/**
 * The shifts profile of a member: linked directly by account, or through the member's staff row. The oldest active one wins; null when
 * the member has none. A member without a staff row matches by account only.
 */
export const profileIdOfMember = async (
    manager: EntityManager,
    workspaceId: string,
    userId: string,
    staffRowId: string | null,
): Promise<string | null> => {
    const own = { workspaceId, active: true }
    const row = await manager.findOne(ShiftsStaffEntity, {
        select: { id: true },
        where: [{ ...own, userId }, ...(staffRowId === null ? [] : [{ ...own, staffId: staffRowId }])],
        order: { createdAt: "ASC" },
    })
    return row?.id ?? null
}
