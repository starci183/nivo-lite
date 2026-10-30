import { builder, fakeTransaction, mockEntityManager } from "@starci/jest-preset"
import type { WorkspaceRole } from "@modules/domain/workspace-members"
import { fakeQueryBuilder } from "./entity-query-builder-fake.builder"

/** A stored seat as the members table holds it. */
export interface SeatRow {
    readonly id: string
    readonly workspaceId: string
    readonly userId: string
    readonly role: WorkspaceRole
    readonly staffId: string | null
    readonly displayName: string
    readonly status: "active" | "disabled"
    readonly createdAt: Date
}

const baseSeat = builder<SeatRow>({
    id: "member-1",
    workspaceId: "ws-1",
    userId: "user-1",
    role: "staff",
    staffId: null,
    displayName: "An",
    status: "active",
    createdAt: new Date("2026-10-01T00:00:00.000Z"),
})

/** A seat of the first workspace: the staff seat of user-1 named An, active; each argument changes one fact of it. */
export const seatRowOf = (
    role: WorkspaceRole = "staff",
    status: SeatRow["status"] = "active",
    userId = "user-1",
    displayName = "An",
    staffId: string | null = null,
): SeatRow => baseSeat({ role, status, userId, displayName, staffId })

/** The owner Chu who changes seats. */
export const CHU_OWNER_SEAT = seatRowOf("owner", "active", "user-1", "Chu")

/** The staff member Binh whose seat is changed. */
export const BINH_STAFF_SEAT = seatRowOf("staff", "active", "user-2", "Binh")

/** The two reads of a seat change in order: the actor, then the target. */
export const seatChangeReads = <Entity extends object>(entity: Entity) =>
    [
        [entity, CHU_OWNER_SEAT],
        [entity, BINH_STAFF_SEAT],
    ] as const

/** The account Auth answers for user-1. */
export const accountOf = () => ({
    id: "user-1",
    email: "an@example.test",
    lastSignInAt: "2026-10-01T00:00:00.000Z",
    avatarUrl: null,
    displayName: "An",
})

/** The staff row the staff service answers after a save. */
export const SAVED_STAFF = {
    id: "staff-2",
    workspace_id: "ws-1",
    name: "Binh",
    role: "Sales",
    email: "binh@example.test",
    active: false,
    created_at: "2026-10-01T00:00:00.000Z",
}

/** The console fields of that staff row. */
export const STAFF_OPTION = {
    id: SAVED_STAFF.id,
    name: SAVED_STAFF.name,
    role: SAVED_STAFF.role,
    email: SAVED_STAFF.email,
    active: SAVED_STAFF.active,
}

/** The statement `callDbFunction` sends for the member pictures. */
export const MEMBER_AVATARS = 'SELECT * FROM "be_access"."workspace_member_avatars"($1, $2)'

/** A manager-or-staff viewer who lists one member (the viewer) whose picture the avatars door answers. */
export const listWorld = (
    entity: new () => SeatRow,
    viewer: SeatRow,
    avatars: ReadonlyArray<{ id: string; avatar_url: string | null }>,
) => {
    const em = mockEntityManager({
        findOne: [entity, viewer],
        query: [MEMBER_AVATARS, avatars],
    })
    const list = fakeQueryBuilder({ getMany: [viewer] })
    em.createQueryBuilder.mockReturnValue(list.builder)
    return { em, list }
}

/** The options a seat lookup of one account in one workspace passes to `findOne`. */
export const seatLookup = (workspaceId: string, userId: string) => ({ where: { workspaceId, userId } })

/** A manager whose join runs in a transaction of two statements: the insert that ignores a seat that exists, then the update. */
export const joinWorld = () => {
    const em = mockEntityManager()
    const insert = fakeQueryBuilder({ execute: {} })
    const update = fakeQueryBuilder({ execute: {} })
    em.createQueryBuilder.mockReturnValueOnce(insert.builder).mockReturnValueOnce(update.builder)
    return { em, insert, update, transaction: fakeTransaction(em) }
}
