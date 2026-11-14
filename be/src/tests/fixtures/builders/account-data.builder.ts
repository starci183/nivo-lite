import type { EntityManager } from "typeorm"
import { accountDataEntities } from "@modules/domain/account-data"
import { connectionsEntities } from "@modules/domain/connections"
import { workspacesEntities } from "@modules/domain/workspaces"
import { entityOf } from "./entity.builder"

const AccountDataEntity: (typeof accountDataEntities)[0] = accountDataEntities[0]
type AccountDataEntity = InstanceType<typeof AccountDataEntity>
const [ConnectionEntity] = connectionsEntities
const [WorkspaceEntity] = workspacesEntities

/** A pending `telegram.update` row of connection c-1 of the Telegram account, holding an empty update. */
export const accountDataOf: (overrides?: Partial<AccountDataEntity>) => AccountDataEntity = entityOf(AccountDataEntity, {
    id: "account-row-1",
    type: "telegram.update",
    typeVersion: 1,
    provider: "telegram",
    connectionId: "c-1",
    workspaceId: "w-1",
    key: "77",
    value: { updateId: "77", raw: {} },
    processedAt: null,
})

/** The identities of one provider account a receipt proof persists: its owner, its workspace and its connection. */
export interface ReceiptAccountIdentity {
    /** The owner of the workspace. */
    readonly userId: string
    /** The workspace the connection belongs to. */
    readonly workspaceId: string
    /** The connection (the account) the deliveries arrive on. */
    readonly connectionId: string
    /** The provider of the connection, as `connections.provider` names it. */
    readonly provider: string
    /** The public facts the connection is found by (a Meta page id), when the door looks it up. */
    readonly publicMeta?: Readonly<Record<string, string>>
}

/** Persists the live connection of an existing workspace a door resolves at receipt. */
export const persistReceiptConnection = async (
    manager: EntityManager,
    identity: Omit<ReceiptAccountIdentity, "userId">,
): Promise<void> => {
    await manager.insert(ConnectionEntity, {
        id: identity.connectionId,
        workspaceId: identity.workspaceId,
        provider: identity.provider,
        name: "Receipt proof",
        status: "connected",
        environment: "test",
        publicMeta: { ...identity.publicMeta },
    })
}

/**
 * Persists the owner, the workspace and the live connection a door resolves at receipt: an account row needs both, a delivery for a
 * connection nobody holds keeps nothing.
 */
export const persistReceiptAccount = async (manager: EntityManager, identity: ReceiptAccountIdentity): Promise<void> => {
    await manager.transaction(async (tx) => {
        await tx.insert("auth.users", { id: identity.userId })
        await tx.insert(WorkspaceEntity, { id: identity.workspaceId, ownerId: identity.userId, name: "Receipt proof" })
        await persistReceiptConnection(tx, identity)
    })
}

/** One stored row a proof persists straight through the entity, past the intake's checks: what the database alone holds it to. */
export interface PersistedAccountRow {
    /** The declared type: the partition. */
    readonly type: string
    /** The provider of the connection. */
    readonly provider: string
    /** The account the row belongs to. */
    readonly connectionId: string
    /** The workspace of the account. */
    readonly workspaceId: string
    /** The row key. */
    readonly key: string
    /** The value, exactly as stored. */
    readonly value: object
    /** How long ago it happened on the database clock (a Postgres interval, e.g. "1 hour"); now when omitted. */
    readonly ago?: string
}

/**
 * Persists account rows of version 1 through the entity, in one statement: a read proof seeds the rows it reads, and a constraint proof
 * shows what the database refuses even when no code checks the value.
 */
export const persistAccountRows = async (
    manager: EntityManager,
    rows: ReadonlyArray<PersistedAccountRow>,
): Promise<void> => {
    await manager.insert(
        AccountDataEntity,
        rows.map(({ ago, ...row }) => ({
            ...row,
            typeVersion: 1,
            occurredAt: () => (ago === undefined ? "now()" : `now() - interval '${ago}'`),
        })),
    )
}
