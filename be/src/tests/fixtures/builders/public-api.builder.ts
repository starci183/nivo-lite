import { createHash } from "node:crypto"
import type { EntityManager } from "typeorm"
import { sql } from "@modules/platform/database"

const MARK_BACKLOG = sql`UPDATE public.public_api SET need_supplied = NULL,
payload = payload - 'needSupplied' WHERE workspace_id = $1::uuid AND id = $2::uuid`

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
        await tx.insert("public.workspaces", {
            id: identity.workspaceId,
            owner_id: identity.userId,
            name: "Public API proof",
        })
        await tx.insert("public.api_keys", {
            id: identity.keyId,
            workspace_id: identity.workspaceId,
            name: "Public API proof",
            key_prefix: "nvk_proof",
            key_hash: createHash("sha256").update(identity.key).digest("hex"),
        })
        await tx.insert("public.agents", {
            id: identity.agentId,
            workspace_id: identity.workspaceId,
            module: "chatbot",
            name: "Public API chatbot",
            handle: "public-api-proof",
            role: "chatbot",
            instructions: "Local integration proof",
        })
        await tx.insert("public.authority_rules", {
            workspace_id: identity.workspaceId,
            department: "chatbot",
            action: "reply_customer",
            mode: "auto",
        })
        await tx.insert("public.authority_rules", {
            workspace_id: identity.workspaceId,
            department: "chatbot",
            action: "handoff_lead",
            mode: "auto",
            required_fields: ["contact_name", "need"],
        })
    })
}

/** An existing customer's need is intentionally more meaningful than the admission default. */
export const persistPublicApiLead = async (manager: EntityManager, workspaceId: string, id: string): Promise<void> => {
    await manager.insert("public.leads", {
        id,
        workspace_id: workspaceId,
        contact_name: "Existing API customer",
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
    await manager.insert("public.agent_conversations", {
        id: conversationId,
        workspace_id: identity.workspaceId,
        agent_id: identity.agentId,
        kind: "customer",
        lead_id: leadId,
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
    readonly workspace_id: string
    readonly channel: "manual"
    readonly kind: "lead"
    readonly sender_name: string
    readonly body: string
    readonly external_ref: string
    readonly event_id: string
    readonly dedupe_key: string
    readonly lead_id?: string
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
    await manager.insert("public.inbound_events", inbound)
}

/** Reproduces an old admitted lead whose producer had no need-presence column. */
export const markPublicApiBacklog = async (
    manager: EntityManager,
    workspaceId: string,
    requestId: string,
): Promise<void> => {
    await manager.query(MARK_BACKLOG, [workspaceId, requestId])
}
