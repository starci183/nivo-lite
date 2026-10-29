import type { EntityManager } from "typeorm"
import { WorkspaceMemberEntity } from "@modules/domain/workspace-members"
import { AgentConnectionEntity } from "@modules/domain/agent-connections"
import { AgentConversationEntity } from "@modules/domain/agent-conversations"
import { AgentEntity } from "@modules/domain/agents"
import { AutomationPipelineEntity } from "@modules/domain/automation-pipelines"
import { ConnectionEntity } from "@modules/domain/connections"
import { contractsEntities } from "@modules/domain/contracts"
import { leadsEntities } from "@modules/domain/leads"
import { ModuleInstallationEntity } from "@modules/domain/module-installations"
import { WorkspaceEntity } from "@modules/domain/workspaces"

const [ContractEntity] = contractsEntities
const [LeadEntity] = leadsEntities

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
    await tx.insert(WorkspaceEntity, {
        id: identity.workspaceId,
        ownerId: identity.ownerId,
        name: "NIVO renewal proof",
    })
    const owner = await tx.findOne(WorkspaceMemberEntity, {
        where: { workspaceId: identity.workspaceId, userId: identity.ownerId },
        select: { id: true },
    })
    return owner?.id ?? ""
}

/** The accounting agent installed on autopilot and the AI CSKH agent that holds the customer's chat. */
const persistAgents = async (tx: EntityManager, identity: RenewalIdentity, ownerMember: string): Promise<void> => {
    const agent = {
        workspaceId: identity.workspaceId,
        ownerMemberId: ownerMember,
        fallbackMemberId: ownerMember,
        instructions: "Proof agent.",
    }
    await tx.insert(AgentEntity, {
        ...agent,
        id: identity.accountingAgentId,
        module: "accounting",
        name: "Ke toan AI",
        handle: "accounting-renewal-proof",
        role: "Ke toan",
        assignableRooms: ["accounting"],
    })
    await tx.insert(AgentEntity, {
        ...agent,
        id: identity.careAgentId,
        module: "chatbot",
        name: "AI CSKH",
        handle: "care-renewal-proof",
        role: "CSKH",
        assignableRooms: ["care"],
    })
    await tx.insert(ModuleInstallationEntity, {
        workspaceId: identity.workspaceId,
        moduleKey: "accounting",
        agentId: identity.accountingAgentId,
        name: "Ke toan AI",
        status: "live",
        operatingMode: "autopilot",
        liveEnabled: true,
    })
}

/** The live SePay money connection storing the full account number, bound to the accounting agent for its bank feed. */
const persistMoneyConnection = async (tx: EntityManager, world: RenewalWorld): Promise<void> => {
    const { identity, account } = world
    await tx.insert(ConnectionEntity, {
        id: identity.connectionId,
        workspaceId: identity.workspaceId,
        provider: "sepay",
        name: "SePay MB",
        status: "connected",
        environment: "live",
        publicMeta: {
            account_number: account.accountNumber,
            bank_code: account.bankCode,
            account_holder: account.holder,
        },
    })
    await tx.insert(AgentConnectionEntity, {
        agentId: identity.accountingAgentId,
        connectionId: identity.connectionId,
        workspaceId: identity.workspaceId,
        purpose: "bank_feed",
        access: "auto",
    })
}

/** The customer's lead with a Zalo conversation held by AI CSKH. */
const persistCustomer = async (tx: EntityManager, identity: RenewalIdentity): Promise<void> => {
    await tx.insert(LeadEntity, {
        id: identity.leadId,
        workspaceId: identity.workspaceId,
        contactName: "Chi Thao",
        company: "Thao Spa",
        channel: "zalo",
        need: "Spa membership renewal",
        stage: "won",
        phone: "0901234567",
    })
    await tx.insert(AgentConversationEntity, {
        id: identity.conversationId,
        workspaceId: identity.workspaceId,
        agentId: identity.careAgentId,
        kind: "customer",
        channel: "zalo",
        visitorName: "Chi Thao",
        leadId: identity.leadId,
    })
}

/** Persists one active contract of the customer. */
export const persistCustomerContract = async (manager: EntityManager, customer: CustomerContract): Promise<void> => {
    await manager.insert(ContractEntity, {
        id: customer.contractId,
        workspaceId: customer.workspaceId,
        leadId: customer.leadId,
        customerName: "Chi Thao",
        plan: customer.contract.plan,
        startsOn: customer.contract.startsOn,
        endsOn: customer.contract.endsOn,
        amountVnd: customer.contract.amountVnd,
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
        await tx.insert(AutomationPipelineEntity, {
            id: identity.pipelineId,
            workspaceId: identity.workspaceId,
            templateKey: "contract_renewal",
            name: "Contract renewal",
            moduleKey: "sales",
            enabled: true,
        })
        return ownerMember
    })
