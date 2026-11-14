import { PROVIDER, type ProviderKey, type ToolId } from "@nivo-lite/agent-sdk/names"
import { CRM_NIVOWEB, CRM_NIVOWEB_PROVIDER } from "../../crm/nivoweb/api.generated"

/** The CRM reads of the chat turn (`webbooks.team-answer`, converted by the factory's worker): listed here for the graph only. */
export const TEAM_ANSWER_READS: ReadonlyArray<ToolId> = [
    CRM_NIVOWEB.get_customers,
    CRM_NIVOWEB.get_customers_code,
    CRM_NIVOWEB.get_customers_code_invoices,
    CRM_NIVOWEB.get_invoices,
    CRM_NIVOWEB.get_invoice_drafts_id,
    CRM_NIVOWEB.get_customers_code_balance,
    CRM_NIVOWEB.get_receivables_overdue,
    CRM_NIVOWEB.get_payables,
    CRM_NIVOWEB.get_renewals_open,
    CRM_NIVOWEB.get_purchases_open,
]

/**
 * Every provider the Accounting agent works with, in the order the agent template attaches them (census §7 as amended): the CRM,
 * the bank feeds (SePay, then Casso), the sending mailbox. No customer channel: the Renewal and Sales agents talk to the
 * customer.
 */
export const WEBBOOKS_PROVIDERS: ReadonlyArray<ProviderKey> = [
    CRM_NIVOWEB_PROVIDER,
    PROVIDER.sepay,
    PROVIDER.casso,
    PROVIDER.smtp,
]
