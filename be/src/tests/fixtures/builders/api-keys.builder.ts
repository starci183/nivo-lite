import { builder } from "@starci/jest-preset"
import { apiKeysEntities } from "@modules/domain/api-keys"

const ApiKeyRowEntity: (typeof apiKeysEntities)[0] = apiKeysEntities[0]
type ApiKeyEntity = InstanceType<typeof ApiKeyRowEntity>

/** A stored key of the workspace, with the fields a spec rarely changes filled. */
export const keyOf: (overrides?: Partial<ApiKeyEntity>) => ApiKeyEntity = builder<ApiKeyEntity>({
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
    updatedAt: new Date("2026-10-12T10:00:00.000Z"),
})

/** The public view of {@link keyOf}, its holder not named (no active seat answered for it). */
export const keyView = {
    id: "key-2",
    name: "Daily sync",
    prefix: "nvk_stored12",
    kind: "public_api",
    holderId: "principal-1",
    holderName: null,
    createdAt: "2026-10-12T10:00:00.000Z",
    lastUsedAt: null,
    revokedAt: null,
    inactiveReason: null,
    agentId: null,
    endpointUrl: null,
}

/** An MCP key of its holder `principal-1`, scoped to agent `agent-1`. */
export const agentScopedMcpKey = (): ApiKeyEntity => keyOf({ agentId: "agent-1", scopes: ["mcp"] })
