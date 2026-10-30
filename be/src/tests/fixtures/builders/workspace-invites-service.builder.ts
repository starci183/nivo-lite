import type { ObjectLiteral } from "typeorm"
import { inviteRowOf, pendingInviteRow, TOKEN } from "./l2-workspace-invites.builder"

/** A stored invitation as the invitations table holds it. */
export interface StoredInviteRow {
    readonly id: string
    readonly workspaceId: string
    readonly email: string
    readonly role: "manager" | "staff"
    readonly staffId: string | null
    readonly tokenHash: string
    readonly invitedBy: string | null
    readonly createdAt: Date
    readonly updatedAt: Date
    readonly expiresAt: Date
    readonly acceptedAt: Date | null
    readonly acceptedBy: string | null
    readonly revokedAt: Date | null
}

const optionalDate = (iso: string | null): Date | null => (iso === null ? null : new Date(iso))

/** The stored invitation a fixture row describes. */
export const storedInviteOf = (row: ReturnType<typeof inviteRowOf>): StoredInviteRow => ({
    id: row.id,
    workspaceId: row.workspace_id,
    email: row.email,
    role: row.role === "manager" ? "manager" : "staff",
    staffId: row.staff_id,
    tokenHash: "stored-hash",
    invitedBy: null,
    createdAt: new Date("2026-10-12T00:00:00.000Z"),
    updatedAt: new Date("2026-10-12T00:00:00.000Z"),
    expiresAt: new Date(row.expires_at),
    acceptedAt: optionalDate(row.accepted_at),
    acceptedBy: null,
    revokedAt: optionalDate(row.revoked_at),
})

/** The pending invitation the list query returns, as the table holds it. */
export const pendingStoredInvite = (): StoredInviteRow => ({
    ...storedInviteOf(inviteRowOf({ id: pendingInviteRow.id, email: pendingInviteRow.email })),
    role: pendingInviteRow.role === "manager" ? "manager" : "staff",
    staffId: pendingInviteRow.staff_id,
    createdAt: new Date(pendingInviteRow.created_at),
    expiresAt: new Date(pendingInviteRow.expires_at),
})

/** The statement the database mints a uuid with. */
export const MINT_UUID = 'SELECT * FROM "pg_catalog"."gen_random_uuid"()'

/** Two uuids of the database whose joining, dashes removed, is `TOKEN`. */
export const MINTED = [
    [MINT_UUID, [{ gen_random_uuid: TOKEN.slice(0, TOKEN.length / 2) }]],
    [MINT_UUID, [{ gen_random_uuid: TOKEN.slice(TOKEN.length / 2) }]],
] as const

/** The answer of an update that changed one row. */
export const UPDATED = { affected: 1, raw: [], generatedMaps: [] }

/** What a rotation or a revocation answers for `invite-1`. */
export const CHANGED = { id: "invite-1", email: "an@example.test", role: "staff" }

/** The guard of a rotation of `invite-1` in `ws-1`. */
export const ROTATE_WHERE = [
    "id = :inviteId AND workspace_id = :workspaceId AND accepted_at IS NULL AND revoked_at IS NULL",
    { inviteId: "invite-1", workspaceId: "ws-1" },
]

/** The stubs of a manager that finds the invitation (or none) behind a token, mints `TOKEN` and updates one row. */
export const foundStubs = <Entity extends object>(entity: Entity, row: ReturnType<typeof inviteRowOf> | undefined) =>
    ({
        query: MINTED,
        findOne: [entity, row === undefined ? null : storedInviteOf(row)] as const,
        update: [entity, UPDATED] as const,
    }) as const

/** The stubs of a manager whose transaction mints `TOKEN` and inserts one invitation. */
export const createStubs = <Entity extends object>(entity: Entity) => {
    const identifiers: Array<ObjectLiteral> = []
    const generatedMaps: Array<ObjectLiteral> = []
    return {
        query: MINTED,
        insert: [entity, { identifiers, generatedMaps, raw: [] }] as const,
    } as const
}

/** The pending invitation of `ws-1` as the preview read selects it, linking the given staff row (or none). */
export const previewRawOf = (staffId: string | null) => ({
    getRawOne: {
        workspace_id: "ws-1",
        email: "an@example.test",
        role: "staff",
        staff_id: staffId,
        state: "pending",
    },
})
