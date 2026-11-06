import type { EntityManager } from "typeorm"
import { workspacesEntities } from "@modules/domain/workspaces"

const [WorkspaceEntity] = workspacesEntities

/** The ids and the name of a workspace a seed run finds by name. */
export interface SeedShopIdentity {
    readonly workspaceId: string
    readonly ownerId: string
    readonly name: string
}

/** A workspace with its owner account, as the stack seed finds the NIVO workspace by its name. */
export const persistSeedShop = async (manager: EntityManager, shop: SeedShopIdentity): Promise<void> => {
    await manager.transaction(async (tx) => {
        await tx.insert("auth.users", { id: shop.ownerId })
        await tx.insert(WorkspaceEntity, { id: shop.workspaceId, ownerId: shop.ownerId, name: shop.name })
    })
}
