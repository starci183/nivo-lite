import assert from "node:assert/strict"
import type { EntityManager } from "typeorm"
import { agentsEntities } from "@modules/domain/agents"
import { ContactsService } from "@modules/domain/contacts"
import { CustomerRoutesService } from "@modules/domain/customer-routes"
import { apiKeysEntities } from "@modules/domain/api-keys"
import { apiKeySecretSha256, parseApiKey } from "@modules/integrations/passport"
import { knowledgeSourcesEntities } from "@modules/domain/knowledge-sources"
import { workspacesEntities } from "@modules/domain/workspaces"
import type { LiteWorld } from "../../world/lite-world.service"

const [AgentEntity] = agentsEntities

const [WorkspaceEntity] = workspacesEntities
const [ApiKeyEntity] = apiKeysEntities

const [KnowledgeSourceEntity] = knowledgeSourcesEntities

/** All identities are supplied by the suite's isolated local world. */
export interface PublicApiIdentity {
    readonly workspaceId: string
    readonly userId: string
    readonly keyId: string
    readonly agentId: string
    readonly key: string
}

/** A real key and chatbot conversation owner, without borrowing a production account. */
export const persistPublicApiWorkspace = async (manager: EntityManager, identity: PublicApiIdentity): Promise<void> => {
    await manager.transaction(async (tx) => {
        await tx.insert("auth.users", { id: identity.userId })
        await tx.insert(WorkspaceEntity, {
            id: identity.workspaceId,
            ownerId: identity.userId,
            name: "Public API proof",
        })
        const presented = parseApiKey(identity.key, "nvk_")
        assert(presented !== null && presented.keyId === identity.keyId, "the proof key reads nvk_<keyId>.<secret>")
        await tx.insert(ApiKeyEntity, {
            id: identity.keyId,
            workspaceId: identity.workspaceId,
            name: "Public API proof",
            keyPrefix: "nvk_proof",
            keyHash: apiKeySecretSha256(presented.secret),
        })
        await tx.insert(AgentEntity, {
            id: identity.agentId,
            workspaceId: identity.workspaceId,
            module: "chatbot",
            name: "Public API chatbot",
            handle: "public-api-proof",
            role: "chatbot",
            instructions: "Local integration proof",
        })
    })
}

/**
 * Every message scenario gets its own conversation, opened as the chatbot opens one; the answer is its id. The key is the entrance
 * (`connectionId`, the source); the records are written as its owning agent: the key is scoped to none, so the workspace's installed
 * front door answers, here the chatbot agent `persistPublicApiWorkspace` inserts.
 */
export const persistPublicApiConversation = async (world: LiteWorld, identity: PublicApiIdentity, customerId: string): Promise<string> => {
    const contactId = await world
        .resolve(ContactsService)
        .meetChannel(identity.workspaceId, { channel: "website", account: identity.keyId, userId: customerId, name: "Public API customer" })
    const route = await world
        .resolve(CustomerRoutesService)
        .ensure(identity.workspaceId, { contactId, channel: "website", accountId: identity.keyId })
    return route.routeId
}

/** A historical source already admitted by the API before the request ledger existed. */
export interface PublicApiSourceFixture {
    readonly id: string
    readonly workspaceId: string
    readonly kind: "text"
    readonly title: string
    readonly content: string
}

/** Creates a historical text source under the scenario's existing workspace. */
export const persistPublicApiSource = async (manager: EntityManager, source: PublicApiSourceFixture): Promise<void> => {
    await manager.insert(KnowledgeSourceEntity, source)
}
