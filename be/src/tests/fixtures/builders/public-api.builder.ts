import { createHash } from "node:crypto"
import type { EntityManager } from "typeorm"
import { agentConversationsEntities } from "@modules/domain/agent-conversations"
import { agentsEntities } from "@modules/domain/agents"
import { apiKeysEntities } from "@modules/domain/api-keys"
import { authorityRulesEntities } from "@modules/domain/authority-rules"
import { knowledgeSourcesEntities } from "@modules/domain/knowledge-sources"
import { workspacesEntities } from "@modules/domain/workspaces"

const [AgentEntity] = agentsEntities
const [AgentConversationEntity] = agentConversationsEntities
const [AuthorityRuleEntity] = authorityRulesEntities

const [WorkspaceEntity] = workspacesEntities
const [ApiKeyEntity] = apiKeysEntities

const [KnowledgeSourceEntity] = knowledgeSourcesEntities

/** A new workspace already holds the default rules of the stable modules, so a proof sets its own rule over the default. */
const RULE_KEY = ["workspaceId", "department", "action"]

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
        await tx.insert(ApiKeyEntity, {
            id: identity.keyId,
            workspaceId: identity.workspaceId,
            name: "Public API proof",
            keyPrefix: "nvk_proof",
            keyHash: createHash("sha256").update(identity.key).digest("hex"),
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
        await tx.upsert(
            AuthorityRuleEntity,
            {
                workspaceId: identity.workspaceId,
                department: "chatbot",
                action: "reply_customer",
                mode: "auto",
            },
            RULE_KEY,
        )
        await tx.upsert(
            AuthorityRuleEntity,
            {
                workspaceId: identity.workspaceId,
                department: "chatbot",
                action: "handoff_lead",
                mode: "auto",
                requiredFields: ["contact_name", "need"],
            },
            RULE_KEY,
        )
    })
}

/** Every message scenario gets its own conversation. */
export const persistPublicApiConversation = async (
    manager: EntityManager,
    identity: PublicApiIdentity,
    conversationId: string,
): Promise<void> => {
    await manager.insert(AgentConversationEntity, {
        id: conversationId,
        workspaceId: identity.workspaceId,
        agentId: identity.agentId,
        kind: "customer",
    })
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
