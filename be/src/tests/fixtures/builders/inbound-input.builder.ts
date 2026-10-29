import type { EntityManager } from "typeorm"
import { workspacesEntities } from "@modules/domain/workspaces"

const [WorkspaceEntity] = workspacesEntities

/** A fresh workspace and account owned by one inbound-input proof. */
export interface InboundInputIdentity {
    /** The workspace where inputs are recorded. */
    readonly workspaceId: string
    /** The account that owns the workspace. */
    readonly ownerId: string
}

/** Persists the parent rows that permit a real inbound event insert. */
export const persistInboundInputWorkspace = (manager: EntityManager, identity: InboundInputIdentity): Promise<void> =>
    manager.transaction(async (tx) => {
        await tx.insert("auth.users", { id: identity.ownerId })
        await tx.insert(WorkspaceEntity, {
            id: identity.workspaceId,
            ownerId: identity.ownerId,
            name: "Inbound input proof",
        })
    })
