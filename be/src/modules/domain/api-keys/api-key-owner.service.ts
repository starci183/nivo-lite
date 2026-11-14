import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { AgentDirectoryService } from "@modules/domain/agents"
import { installedChatFrontDoors } from "@modules/domain/installed-plugins"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { kindOfScopes } from "./api-keys.policy"
import { ApiKeysError, ApiKeysErrorCode } from "./errors/api-keys.error"
import { ApiKeyEntity } from "./persistence/entities"

@Injectable()
/**
 * The one answer to "which agent owns the conversations a public API key opens": the agent the key is scoped to while it still exists in the
 * workspace, else the workspace's installed front door of the customer chat, read from the installation (the template agents that answer a
 * customer on a provider channel, a private plugin's template first; never named here), else a refusal. The API has no provider, so the
 * customer-chat front door is the one every conversation of the workspace already has; the key's own id stays the entrance the conversation
 * names (its source).
 */
export class ApiKeyOwnerService {
    constructor(
        private readonly directory: AgentDirectoryService,
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
    ) {}

    /**
     * The owning agent of the conversations of the public API key with this id; null when the id is no public API key of the workspace (so
     * the caller may try another kind of entrance). A key that is one but has no owner (no scope that still holds, and no front door installed)
     * refuses with `AgentMissing`.
     */
    async agentOfKey(workspaceId: string, keyId: string): Promise<string | null> {
        const key = await this.entityManager.findOne(ApiKeyEntity, {
            select: { id: true, agentId: true, scopes: true },
            where: { workspaceId, id: keyId },
        })
        if (key === null || kindOfScopes(key.scopes) !== "public_api") return null
        if (key.agentId !== null && (await this.directory.find(workspaceId, key.agentId)) !== null) return key.agentId
        const front = await this.frontDoorOf(workspaceId)
        if (front === null) throw new ApiKeysError({ code: ApiKeysErrorCode.AgentMissing })
        return front
    }

    /**
     * The agent a public API key is scoped to while that agent still exists in the workspace; null when the id is no public API key, the key
     * names no agent, or its agent is gone (the caller then asks the entrance's own owner). It never falls back to a front door.
     */
    async scopedAgentOf(workspaceId: string, keyId: string): Promise<string | null> {
        const key = await this.entityManager.findOne(ApiKeyEntity, {
            select: { id: true, agentId: true, scopes: true },
            where: { workspaceId, id: keyId },
        })
        if (key === null || kindOfScopes(key.scopes) !== "public_api" || key.agentId === null) return null
        return (await this.directory.find(workspaceId, key.agentId)) === null ? null : key.agentId
    }

    /** The oldest active agent of the first installed customer-chat front door the workspace holds, or null when it holds none. */
    private async frontDoorOf(workspaceId: string): Promise<string | null> {
        for (const module of installedChatFrontDoors()) {
            const found = await this.directory.firstActiveIdOfModule(workspaceId, module)
            if (found !== null) return found
        }
        return null
    }
}
