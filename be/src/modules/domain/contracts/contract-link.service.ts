import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { AgentConversationsService } from "@modules/domain/agent-conversations"
import { ConnectionEntity } from "@modules/domain/connections"
import { DataRecordEntity } from "@modules/domain/data-records"
import { LeadRecordsService } from "@modules/domain/leads"
import type { LeadRecordRow } from "@modules/domain/leads"
import { advisoryXactLock, InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectMessageCatalog } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { eachInOrder } from "@modules/platform/primitives"
import { customerRecordOf, indexCustomers, linkedCustomersOf, matchCustomer, planLink } from "./contract-link.policy"
import type {
    ContractLinkRead,
    CustomerIndex,
    CustomerRecord,
    CustomerRecordRead,
    LinkLead,
    LinkPlan,
    LinkStep,
} from "./contract-link.policy"
import type { LinkedCustomers } from "./contracts.contracts"
import { ContractEntity } from "./persistence/entities"

/** True when a raw row holds the text fields of a contract read. */
const isContractLinkRead = (value: unknown): value is ContractLinkRead =>
    typeof value === "object" &&
    value !== null &&
    ["id", "customerName", "plan", "note"].every((field) => typeof Reflect.get(value, field) === "string")

/** True when a raw row holds the text fields of a customer record read. */
const isCustomerRecordRead = (value: unknown): value is CustomerRecordRead =>
    typeof value === "object" &&
    value !== null &&
    ["externalId", "title"].every((field) => typeof Reflect.get(value, field) === "string")

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
            await advisoryXactLock(tx, `contracts.link:${workspaceId}`)
            const contracts = await this.contractsToLink(tx, workspaceId)
            const records = await this.customerRecords(tx, workspaceId)
            const index = indexCustomers(records.map(customerRecordOf))
            const steps: Array<LinkStep> = []
            await eachInOrder(contracts, async (contract) => {
                steps.push(await this.linkContract(tx, workspaceId, contract, index))
            })
            return linkedCustomersOf(steps)
        })
    }

    private async contractsToLink(tx: EntityManager, workspaceId: string): Promise<Array<ContractLinkRead>> {
        const rows: ReadonlyArray<unknown> = await tx
            .createQueryBuilder(ContractEntity, "c")
            .select("c.id", "id")
            .addSelect("c.leadId", "leadId")
            .addSelect("c.customerName", "customerName")
            .addSelect("c.plan", "plan")
            .addSelect("c.note", "note")
            .addSelect("l.phone", "leadPhone")
            .addSelect("l.email", "leadEmail")
            .leftJoin("leads", "l", "l.workspace_id = c.workspace_id AND l.id = c.lead_id")
            .where("c.workspaceId = :workspaceId", { workspaceId })
            .orderBy("c.createdAt", "ASC")
            .addOrderBy("c.id", "ASC")
            .limit(2000)
            .getRawMany()
        return rows.filter(isContractLinkRead)
    }

    private async customerRecords(tx: EntityManager, workspaceId: string): Promise<Array<CustomerRecordRead>> {
        const rows: ReadonlyArray<unknown> = await tx
            .createQueryBuilder(DataRecordEntity, "r")
            .select("r.external_id", "externalId")
            .addSelect("r.title", "title")
            .addSelect("r.data", "data")
            .addSelect("s.name", "source")
            .leftJoin(ConnectionEntity, "s", "s.workspace_id = r.workspace_id AND s.id = r.connection_id")
            .where("r.workspace_id = :workspaceId AND r.entity = 'customer'", { workspaceId })
            .orderBy("r.synced_at", "DESC")
            .addOrderBy("r.id", "ASC")
            .limit(5000)
            .getRawMany()
        return rows.filter(isCustomerRecordRead)
    }

    private async linkContract(
        tx: EntityManager,
        workspaceId: string,
        contract: ContractLinkRead,
        index: CustomerIndex,
    ): Promise<LinkStep> {
        const match = matchCustomer({ customerName: contract.customerName, note: contract.note }, index)
        if (match.kind === "unmatched") {
            if (contract.leadPhone !== null || contract.leadEmail !== null) return KEPT
            const unmatched = { contractId: contract.id, customerName: contract.customerName, reason: match.reason }
            return { kind: "unmatched", contract: unmatched }
        }
        const { customer } = match
        const found = await this.leads.matchAllByContact(workspaceId, customer, tx)
        const own = { id: contract.leadId ?? "", phone: contract.leadPhone, email: contract.leadEmail }
        const leads = contract.leadId === null || found.some((lead) => lead.id === own.id) ? found : [own, ...found]
        const linkLeads = await Promise.all(
            leads.map(async (lead) =>
                linkLeadOf(lead, (await this.conversations.latestOfLead(workspaceId, lead.id, null)) !== null),
            ),
        )
        const current = linkLeads.find((lead) => lead.id === contract.leadId) ?? null
        return this.applyLink(tx, workspaceId, contract, customer, planLink(current, linkLeads, customer))
    }

    private async applyLink(
        tx: EntityManager,
        workspaceId: string,
        contract: ContractLinkRead,
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
        const moved = await tx
            .createQueryBuilder(ContractEntity, "c")
            .update()
            .set({ leadId, updatedAt: () => "now()" })
            .where(
                "workspace_id = :workspaceId AND id = :contractId AND lead_id IS NOT DISTINCT FROM :readLeadId::uuid AND EXISTS (SELECT 1 FROM public.leads WHERE workspace_id = :workspaceId AND id = :leadId::uuid)",
                { workspaceId, contractId: contract.id, readLeadId: contract.leadId, leadId },
            )
            .returning("id")
            .execute()
        if (!Array.isArray(moved.raw) || moved.raw.length === 0) return KEPT
        if (plan.kind === "create") return { kind: "created" }
        await this.leads.fillContact({ ...contact, leadId }, tx)
        return LINKED
    }

    private async captureCustomer(
        tx: EntityManager,
        workspaceId: string,
        contract: ContractLinkRead,
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
