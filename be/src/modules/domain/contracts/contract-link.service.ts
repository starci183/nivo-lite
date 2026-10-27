import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { AgentConversationsService } from "@modules/domain/agent-conversations"
import { LeadRecordsService } from "@modules/domain/leads"
import type { LeadRecordRow } from "@modules/domain/leads"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectMessageCatalog } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { eachInOrder } from "@modules/platform/primitives"
import { customerRecordOf, indexCustomers, linkedCustomersOf, matchCustomer, planLink } from "./contract-link.policy"
import type { CustomerIndex, CustomerRecord, LinkLead, LinkPlan, LinkStep } from "./contract-link.policy"
import type { LinkedCustomers } from "./contracts.contracts"
import type { ContractLinkRow, CustomerRecordRow } from "./persistence/contracts.rows"
import {
    LIST_CONTRACTS_TO_LINK,
    LIST_CUSTOMER_RECORDS,
    LOCK_CONTRACT_LINKING,
    RELINK_CONTRACT_LEAD,
} from "./persistence/contracts.sql"

/** The locale of the lead a link creates: the workspace owners read it in Vietnamese. */
const RECORD_LOCALE = "vi"
/** The company of a customer that is a person. */
const NO_COMPANY = "\u2014"
/** The stage of a lead created for a customer who already holds a contract: the renewal is an open deal. */
const RENEWAL_STAGE = "qualified"
const KEPT: LinkStep = { kind: "kept" }
const LINKED: LinkStep = { kind: "linked" }

const linkLeadOf = (lead: Pick<LeadRecordRow, "id" | "phone" | "email">, reachable: boolean): LinkLead => ({
    id: lead.id,
    phone: lead.phone,
    email: lead.email,
    reachable,
})

@Injectable()
/**
 * Ties the contracts of a workspace to the leads their customers are reached through, so the renewal finds a conversation: the
 * only writer of `contracts.lead_id` for imported contracts, capturing a customer through the leads capability when no lead holds
 * the customer's phone or email.
 */
export class ContractLinkService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectMessageCatalog() private readonly catalog: MessageCatalog,
        private readonly leads: LeadRecordsService,
        private readonly conversations: AgentConversationsService,
    ) {}

    /**
     * Links every contract of the workspace to a lead the renewal can reach, on the system's behalf (after an import, or asked for):
     * the contract's customer is found among the data-hub customer records by code or by name, and the contract goes to the lead
     * that holds the customer's phone or email (the one a customer conversation reaches first), or to its own lead that gains the
     * contact, or to a lead created for the customer. One run per workspace at a time, in one transaction; a repeat changes nothing.
     */
    linkCustomers(workspaceId: string): Promise<LinkedCustomers> {
        return this.entityManager.transaction(async (tx) => {
            await tx.query(LOCK_CONTRACT_LINKING, [workspaceId])
            const contracts = await tx.query<Array<ContractLinkRow>>(LIST_CONTRACTS_TO_LINK, [workspaceId])
            const records = await tx.query<Array<CustomerRecordRow>>(LIST_CUSTOMER_RECORDS, [workspaceId])
            const index = indexCustomers(records.map(customerRecordOf))
            const steps: Array<LinkStep> = []
            await eachInOrder(contracts, async (contract) => {
                steps.push(await this.linkContract(tx, workspaceId, contract, index))
            })
            return linkedCustomersOf(steps)
        })
    }

    private async linkContract(
        tx: EntityManager,
        workspaceId: string,
        contract: ContractLinkRow,
        index: CustomerIndex,
    ): Promise<LinkStep> {
        const match = matchCustomer({ customerName: contract.customer_name, note: contract.note }, index)
        if (match.kind === "unmatched") {
            if (contract.lead_phone !== null || contract.lead_email !== null) return KEPT
            const unmatched = { contractId: contract.id, customerName: contract.customer_name, reason: match.reason }
            return { kind: "unmatched", contract: unmatched }
        }
        const { customer } = match
        const found = await this.leads.matchAllByContact(workspaceId, customer, tx)
        const own = { id: contract.lead_id ?? "", phone: contract.lead_phone, email: contract.lead_email }
        const leads = contract.lead_id === null || found.some((lead) => lead.id === own.id) ? found : [own, ...found]
        const linkLeads = await Promise.all(
            leads.map(async (lead) =>
                linkLeadOf(lead, (await this.conversations.latestOfLead(workspaceId, lead.id, null)) !== null),
            ),
        )
        const current = linkLeads.find((lead) => lead.id === contract.lead_id) ?? null
        return this.applyLink(tx, workspaceId, contract, customer, planLink(current, linkLeads, customer))
    }

    private async applyLink(
        tx: EntityManager,
        workspaceId: string,
        contract: ContractLinkRow,
        customer: CustomerRecord,
        plan: LinkPlan,
    ): Promise<LinkStep> {
        if (plan.kind === "keep") return KEPT
        const contact = { workspaceId, phone: customer.phone, email: customer.email }
        if (plan.kind === "fill") {
            await this.leads.fillContact({ ...contact, leadId: plan.leadId }, tx)
            return LINKED
        }
        const leadId = plan.kind === "move" ? plan.leadId : await this.captureCustomer(tx, workspaceId, contract, customer)
        const moved = await tx.query<Array<{ id: string }>>(RELINK_CONTRACT_LEAD, [
            workspaceId,
            contract.id,
            contract.lead_id,
            leadId,
        ])
        if (moved.length === 0) return KEPT
        if (plan.kind === "create") return { kind: "created" }
        await this.leads.fillContact({ ...contact, leadId }, tx)
        return LINKED
    }

    private async captureCustomer(
        tx: EntityManager,
        workspaceId: string,
        contract: ContractLinkRow,
        customer: CustomerRecord,
    ): Promise<string> {
        const lead = await this.leads.capture(
            {
                workspaceId,
                contactName: customer.name,
                company: customer.company ? customer.name : NO_COMPANY,
                channel: customer.source || this.catalog.get("contracts.linkChannel", {}, RECORD_LOCALE),
                need: this.catalog.get("contracts.linkNeed", { plan: contract.plan }, RECORD_LOCALE),
                phone: customer.phone,
                email: customer.email,
            },
            tx,
        )
        await this.leads.classify({ workspaceId, leadId: lead.id, stage: RENEWAL_STAGE, contextSummary: null }, tx)
        return lead.id
    }
}
