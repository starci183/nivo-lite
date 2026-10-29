import { builder } from "@starci/jest-preset"
import { apiKeysEntities } from "@modules/domain/api-keys"

const [ApiKeyRowEntity] = apiKeysEntities
type ApiKeyEntity = InstanceType<typeof ApiKeyRowEntity>

/** A stored key of the workspace, with the fields a spec rarely changes filled. */
export const keyOf = builder<ApiKeyEntity>({
    id: "key-2",
    workspaceId: "workspace-1",
    name: "Daily sync",
    keyPrefix: "nvk_stored12",
    keyHash: "hash",
    scopes: ["leads:read"],
    createdBy: "principal-1",
    createdAt: new Date("2026-10-12T10:00:00.000Z"),
    lastUsedAt: null,
    revokedAt: null,
    agentId: null,
})

/** The public view of {@link keyOf}. */
export const keyView = {
    id: "key-2",
    name: "Daily sync",
    prefix: "nvk_stored12",
    createdAt: "2026-10-12T10:00:00.000Z",
    lastUsedAt: null,
    revokedAt: null,
    agentId: null,
}

/** The loyalty till's key, scoped to read loyalty data. */
export const loyaltyTillKey = (): ApiKeyEntity =>
    keyOf({ id: "key-1", workspaceId: "ws-1", name: "Till", scopes: ["loyalty:read"] })

/** A key of workspace `ws-1` that keeps the default name and scopes. */
export const defaultKeyOfWorkspaceWs1 = (): ApiKeyEntity => keyOf({ id: "key-1", workspaceId: "ws-1" })

/** A stored row that lost its id. */
export const keyWithoutId = (): ApiKeyEntity => keyOf({ id: "" })

/** A stored row that lost its workspace. */
export const keyWithoutWorkspace = (): ApiKeyEntity => keyOf({ workspaceId: "" })

/** A key revoked at the default timestamp. */
export const revokedKey = (): ApiKeyEntity => keyOf({ revokedAt: new Date("2026-10-12T10:00:00.000Z") })

/** A key whose calls act as agent `agent-1`, so an agent door can be proven with a key alone. */
export const agentBoundKey = (): ApiKeyEntity => keyOf({ agentId: "agent-1" })
