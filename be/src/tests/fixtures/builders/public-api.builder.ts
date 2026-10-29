import { createHash } from "node:crypto"
import type { EntityManager } from "typeorm"
import { PublicApiEntity } from "@modules/domain/public-api"
import { AgentConversationEntity } from "@modules/domain/agent-conversations"
import { AgentEntity } from "@modules/domain/agents"
import { ApiKeyEntity } from "@modules/domain/api-keys"
import { AuthorityRuleEntity } from "@modules/domain/authority-rules"
import { inboundEventsEntities } from "@modules/domain/inbound-events"
import { leadsEntities } from "@modules/domain/leads"
import { workspacesEntities } from "@modules/domain/workspaces"

const [WorkspaceEntity] = workspacesEntities

const [InboundEventEntity] = inboundEventsEntities
const [LeadEntity] = leadsEntities

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
        await tx.insert(AuthorityRuleEntity, {
            workspaceId: identity.workspaceId,
            department: "chatbot",
            action: "reply_customer",
            mode: "auto",
        })
        await tx.insert(AuthorityRuleEntity, {
            workspaceId: identity.workspaceId,
            department: "chatbot",
            action: "handoff_lead",
            mode: "auto",
            requiredFields: ["contact_name", "need"],
        })
    })
}

/** An existing customer's need is intentionally more meaningful than the admission default. */
export const persistPublicApiLead = async (manager: EntityManager, workspaceId: string, id: string): Promise<void> => {
    await manager.insert(LeadEntity, {
        id,
        workspaceId: workspaceId,
        contactName: "Existing API customer",
        company: "Existing API company",
        channel: "API",
        need: "Retain the annual service contract",
        email: `${id}@example.test`,
    })
}

/** Every message scenario gets its own conversation and customer. */
export const persistPublicApiConversation = async (
    manager: EntityManager,
    identity: PublicApiIdentity,
    conversationId: string,
    leadId: string,
): Promise<void> => {
    await persistPublicApiLead(manager, identity.workspaceId, leadId)
    await manager.insert(AgentConversationEntity, {
        id: conversationId,
        workspaceId: identity.workspaceId,
        agentId: identity.agentId,
        kind: "customer",
        leadId: leadId,
    })
}

/** A historical source already admitted by the API before the request ledger existed. */
export interface PublicApiSourceFixture {
    readonly id: string
    readonly workspace_id: string
    readonly kind: "text"
    readonly title: string
    readonly content: string
}

/** Retains the inbound identity and optional linked customer of an historical admission. */
export interface PublicApiInboundFixture {
    readonly id: string
    readonly workspaceId: string
    readonly channel: "manual"
    readonly kind: "lead"
    readonly senderName: string
    readonly body: string
    readonly externalRef: string
    readonly eventId: string
    readonly dedupeKey: string
    readonly leadId?: string
}

/** Creates a historical text source under the scenario's existing workspace. */
export const persistPublicApiSource = async (manager: EntityManager, source: PublicApiSourceFixture): Promise<void> => {
    await manager.insert("public.knowledge_sources", source)
}

/** Creates an historical inbound row without inventing another domain identity during delivery. */
export const persistPublicApiInbound = async (
    manager: EntityManager,
    inbound: PublicApiInboundFixture,
): Promise<void> => {
    await manager.insert(InboundEventEntity, inbound)
}

/** Reproduces an old admitted lead whose producer had no need-presence column. */
export const markPublicApiBacklog = async (
    manager: EntityManager,
    workspaceId: string,
    requestId: string,
): Promise<void> => {
    await manager
        .createQueryBuilder(PublicApiEntity, "t")
        .update()
        .set({ needSupplied: null, payload: () => "payload - 'needSupplied'" })
        .where("workspace_id = :workspaceId AND id = :requestId", { workspaceId, requestId })
        .execute()
}
