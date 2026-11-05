import { In } from "typeorm"
import type { EntityManager } from "typeorm"
import { entityEngineEntities } from "@modules/domain/entity-engine"
import { workspacesEntities } from "@modules/domain/workspaces"

const [RecordEntity] = entityEngineEntities

const [WorkspaceEntity] = workspacesEntities

/** The entity the proofs seed: a declared flow-F entity with a real partition. */
const SEEDED_ENTITY = "sales.lead"

/** The ids of one workspace and the two records it holds. */
export interface EngineTenantIds {
    readonly userId: string
    readonly workspaceId: string
    readonly recordId: string
    readonly otherRecordId: string
}

/** Two workspaces, A and B. */
export interface EngineTenants {
    readonly a: EngineTenantIds
    readonly b: EngineTenantIds
}

/** Names the ids of both workspaces from the ids of the suite's world. */
export const engineTenantIds = (next: () => string): EngineTenants => {
    const tenant = (): EngineTenantIds => ({
        userId: next(),
        workspaceId: next(),
        recordId: next(),
        otherRecordId: next(),
    })
    return { a: tenant(), b: tenant() }
}

const persistTenant = async (manager: EntityManager, tenant: EngineTenantIds, label: string): Promise<void> => {
    await manager.insert("auth.users", { id: tenant.userId })
    await manager.insert(WorkspaceEntity, { id: tenant.workspaceId, ownerId: tenant.userId, name: `Engine ${label}` })
    const lead = (id: string, name: string) => ({
        entity: SEEDED_ENTITY,
        id,
        workspaceId: tenant.workspaceId,
        data: { contactName: name, channel: "zalo", stage: "new" },
    })
    await manager.insert(RecordEntity, lead(tenant.recordId, `Nguyen ${label}`))
    await manager.insert(RecordEntity, lead(tenant.otherRecordId, `Second ${label}`))
}

/**
 * Writes workspaces A and B, each with two sales leads, as the world's superuser (the seed bypasses RLS on purpose),
 * and removes them when the suite ends: the records go with their workspace.
 */
export const persistEngineTenants = async (
    manager: EntityManager,
    tenants: EngineTenants,
    onClose: (work: () => Promise<void>) => void,
): Promise<void> => {
    onClose(async () => {
        await manager.delete(WorkspaceEntity, { id: In([tenants.a.workspaceId, tenants.b.workspaceId]) })
        await manager.delete("auth.users", { id: In([tenants.a.userId, tenants.b.userId]) })
    })
    await persistTenant(manager, tenants.a, "A")
    await persistTenant(manager, tenants.b, "B")
}
