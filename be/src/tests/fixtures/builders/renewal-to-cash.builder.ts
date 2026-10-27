import type { EntityManager } from "typeorm"
import { sql } from "@modules/platform/database"

/** The member id of the owner the workspace trigger seated ($1 workspace, $2 user). */
const OWNER_MEMBER = sql`SELECT id FROM public.workspace_members WHERE workspace_id = $1 AND user_id = $2 LIMIT 1`

/** The explicit identities of one renewal-to-cash scenario, supplied by the world. */
export interface RenewalIdentity {
    readonly workspaceId: string
    readonly ownerId: string
    readonly accountingAgentId: string
    readonly careAgentId: string
    readonly connectionId: string
    readonly leadId: string
    readonly conversationId: string
    readonly contractId: string
    readonly pipelineId: string
}

/** The bank account the workspace's SePay feed stores in full: what the VietQR link must transfer into. */
export interface RenewalAccount {
    readonly accountNumber: string
    readonly bankCode: string
    readonly holder: string
}

/** One contract term of the scenario, ending inside the renewal window. */
export interface RenewalContract {
    readonly startsOn: string
    readonly endsOn: string
    readonly amountVnd: number
    readonly plan: string
}

/** Everything the scenario persists before the renewal runs. */
export interface RenewalWorld {
    readonly identity: RenewalIdentity
    readonly account: RenewalAccount
    readonly contract: RenewalContract
}

/** One active contract of the scenario's customer. */
export interface CustomerContract {
    readonly workspaceId: string
    readonly contractId: string
    readonly leadId: string
    readonly contract: RenewalContract
}

/** The owner (seated by the workspace trigger) and the workspace; answers the owner's member id. */
const persistOwner = async (tx: EntityManager, identity: RenewalIdentity): Promise<string> => {
    await tx.insert("auth.users", { id: identity.ownerId })
    await tx.insert("public.workspaces", {
        id: identity.workspaceId,
        owner_id: identity.ownerId,
        name: "NIVO renewal proof",
    })
    const [owner] = await tx.query<Array<{ id: string }>>(OWNER_MEMBER, [identity.workspaceId, identity.ownerId])
    return owner?.id ?? ""
}

/** The accounting agent installed on autopilot and the AI CSKH agent that holds the customer's chat. */
const persistAgents = async (tx: EntityManager, identity: RenewalIdentity, ownerMember: string): Promise<void> => {
    const agent = {
        workspace_id: identity.workspaceId,
        owner_member_id: ownerMember,
        fallback_member_id: ownerMember,
        instructions: "Proof agent.",
    }
    await tx.insert("public.agents", {
        ...agent,
        id: identity.accountingAgentId,
        module: "accounting",
        name: "Ke toan AI",
        handle: "accounting-renewal-proof",
        role: "Ke toan",
        assignable_rooms: ["accounting"],
    })
    await tx.insert("public.agents", {
        ...agent,
        id: identity.careAgentId,
        module: "chatbot",
        name: "AI CSKH",
        handle: "care-renewal-proof",
        role: "CSKH",
        assignable_rooms: ["care"],
    })
    await tx.insert("public.module_installations", {
        workspace_id: identity.workspaceId,
        module_key: "accounting",
        agent_id: identity.accountingAgentId,
        name: "Ke toan AI",
        status: "live",
        operating_mode: "autopilot",
        live_enabled: true,
    })
}

/** The live SePay money connection storing the full account number, bound to the accounting agent for its bank feed. */
const persistMoneyConnection = async (tx: EntityManager, world: RenewalWorld): Promise<void> => {
    const { identity, account } = world
    await tx.insert("public.connections", {
        id: identity.connectionId,
        workspace_id: identity.workspaceId,
        provider: "sepay",
        name: "SePay MB",
        status: "connected",
        environment: "live",
        public_meta: {
            account_number: account.accountNumber,
            bank_code: account.bankCode,
            account_holder: account.holder,
        },
    })
    await tx.insert("public.agent_connections", {
        agent_id: identity.accountingAgentId,
        connection_id: identity.connectionId,
        workspace_id: identity.workspaceId,
        purpose: "bank_feed",
        access: "auto",
    })
}

/** The customer's lead with a Zalo conversation held by AI CSKH. */
const persistCustomer = async (tx: EntityManager, identity: RenewalIdentity): Promise<void> => {
    await tx.insert("public.leads", {
        id: identity.leadId,
        workspace_id: identity.workspaceId,
        contact_name: "Chi Thao",
        company: "Thao Spa",
        channel: "zalo",
        need: "Spa membership renewal",
        stage: "won",
        phone: "0901234567",
    })
    await tx.insert("public.agent_conversations", {
        id: identity.conversationId,
        workspace_id: identity.workspaceId,
        agent_id: identity.careAgentId,
        kind: "customer",
        channel: "zalo",
        visitor_name: "Chi Thao",
        lead_id: identity.leadId,
    })
}

/** Persists one active contract of the customer. */
export const persistCustomerContract = async (manager: EntityManager, customer: CustomerContract): Promise<void> => {
    await manager.insert("public.contracts", {
        id: customer.contractId,
        workspace_id: customer.workspaceId,
        lead_id: customer.leadId,
        customer_name: "Chi Thao",
        plan: customer.contract.plan,
        starts_on: customer.contract.startsOn,
        ends_on: customer.contract.endsOn,
        amount_vnd: customer.contract.amountVnd,
        status: "active",
    })
}

/**
 * Persists the shop of the demo loop: the owner, the accounting agent installed on autopilot, a live SePay money connection that
 * stores the full account number and is bound to that agent for its bank feed (auto access), the customer's lead with a Zalo
 * conversation, an active contract of the lead ending soon, and the contract renewal pipeline switched on (standard wording, the
 * owner decides each message). Answers the owner's member id.
 */
export const persistRenewalWorld = (manager: EntityManager, world: RenewalWorld): Promise<string> =>
    manager.transaction(async (tx) => {
        const { identity } = world
        const ownerMember = await persistOwner(tx, identity)
        await persistAgents(tx, identity, ownerMember)
        await persistMoneyConnection(tx, world)
        await persistCustomer(tx, identity)
        await persistCustomerContract(tx, {
            workspaceId: identity.workspaceId,
            contractId: identity.contractId,
            leadId: identity.leadId,
            contract: world.contract,
        })
        await tx.insert("public.automation_pipelines", {
            id: identity.pipelineId,
            workspace_id: identity.workspaceId,
            template_key: "contract_renewal",
            name: "Contract renewal",
            module_key: "sales",
            enabled: true,
        })
        return ownerMember
    })
