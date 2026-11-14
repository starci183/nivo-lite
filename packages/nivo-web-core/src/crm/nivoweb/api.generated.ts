// GENERATED from the OpenAPI document beside this file (crm codegen); do not edit. The CRM id is the package's provider template's.
// The operations of the CRM `nivoweb` (base path `/v1`): `nivo.api.crm.nivoweb.<method>.<path>`, ONE name a node
// calls and an interface reads.

/** Every operation of the CRM `nivoweb`, by its method and path. */
export const CRM_NIVOWEB = {
    get_contracts: "nivo.api.crm.nivoweb.get.contracts",
    get_customers: "nivo.api.crm.nivoweb.get.customers",
    get_customers_code: "nivo.api.crm.nivoweb.get.customers.code",
    get_customers_code_balance: "nivo.api.crm.nivoweb.get.customers.code.balance",
    get_customers_code_contracts: "nivo.api.crm.nivoweb.get.customers.code.contracts",
    get_customers_code_documents: "nivo.api.crm.nivoweb.get.customers.code.documents",
    get_customers_code_documents_link: "nivo.api.crm.nivoweb.get.customers.code.documents.link",
    get_customers_code_invoices: "nivo.api.crm.nivoweb.get.customers.code.invoices",
    get_customers_code_services: "nivo.api.crm.nivoweb.get.customers.code.services",
    get_invoice_drafts_id: "nivo.api.crm.nivoweb.get.invoice-drafts.id",
    get_invoices: "nivo.api.crm.nivoweb.get.invoices",
    get_payables: "nivo.api.crm.nivoweb.get.payables",
    get_prices: "nivo.api.crm.nivoweb.get.prices",
    get_purchases_id: "nivo.api.crm.nivoweb.get.purchases.id",
    get_purchases_open: "nivo.api.crm.nivoweb.get.purchases.open",
    get_receivables_overdue: "nivo.api.crm.nivoweb.get.receivables.overdue",
    get_renewals_id: "nivo.api.crm.nivoweb.get.renewals.id",
    get_renewals_open: "nivo.api.crm.nivoweb.get.renewals.open",
    get_services_code_status: "nivo.api.crm.nivoweb.get.services.code.status",
    get_services_expiring: "nivo.api.crm.nivoweb.get.services.expiring",
    get_summary_counts: "nivo.api.crm.nivoweb.get.summary.counts",
    get_tickets: "nivo.api.crm.nivoweb.get.tickets",
    get_tickets_id: "nivo.api.crm.nivoweb.get.tickets.id",
    patch_purchases_id: "nivo.api.crm.nivoweb.patch.purchases.id",
    patch_tickets_id: "nivo.api.crm.nivoweb.patch.tickets.id",
    post_customers: "nivo.api.crm.nivoweb.post.customers",
    post_customers_code_contacts: "nivo.api.crm.nivoweb.post.customers.code.contacts",
    post_invoice_drafts: "nivo.api.crm.nivoweb.post.invoice-drafts",
    post_invoice_drafts_id_invoice: "nivo.api.crm.nivoweb.post.invoice-drafts.id.invoice",
    post_payables_party_code_notes: "nivo.api.crm.nivoweb.post.payables.party-code.notes",
    post_purchases: "nivo.api.crm.nivoweb.post.purchases",
    post_purchases_id_acceptance: "nivo.api.crm.nivoweb.post.purchases.id.acceptance",
    post_purchases_id_followups: "nivo.api.crm.nivoweb.post.purchases.id.followups",
    post_purchases_id_outcome: "nivo.api.crm.nivoweb.post.purchases.id.outcome",
    post_purchases_id_payments: "nivo.api.crm.nivoweb.post.purchases.id.payments",
    post_purchases_id_quotes: "nivo.api.crm.nivoweb.post.purchases.id.quotes",
    post_receivables_code_notices: "nivo.api.crm.nivoweb.post.receivables.code.notices",
    post_receivables_code_payments: "nivo.api.crm.nivoweb.post.receivables.code.payments",
    post_renewals: "nivo.api.crm.nivoweb.post.renewals",
    post_renewals_id_outcome: "nivo.api.crm.nivoweb.post.renewals.id.outcome",
    post_renewals_id_payments: "nivo.api.crm.nivoweb.post.renewals.id.payments",
    post_services_code_reminders: "nivo.api.crm.nivoweb.post.services.code.reminders",
    post_tickets: "nivo.api.crm.nivoweb.post.tickets",
} as const

/** The provider key a node lists for these operations (`PROVIDER.crm("nivoweb")`). */
export const CRM_NIVOWEB_PROVIDER = "crm.nivoweb" as const

declare module "@nivo-lite/agent-sdk/names" {
    interface ToolNames {
        "nivo.api.crm.nivoweb.get.contracts": ToolSignature
        "nivo.api.crm.nivoweb.get.customers": ToolSignature
        "nivo.api.crm.nivoweb.get.customers.code": ToolSignature
        "nivo.api.crm.nivoweb.get.customers.code.balance": ToolSignature
        "nivo.api.crm.nivoweb.get.customers.code.contracts": ToolSignature
        "nivo.api.crm.nivoweb.get.customers.code.documents": ToolSignature
        "nivo.api.crm.nivoweb.get.customers.code.documents.link": ToolSignature
        "nivo.api.crm.nivoweb.get.customers.code.invoices": ToolSignature
        "nivo.api.crm.nivoweb.get.customers.code.services": ToolSignature
        "nivo.api.crm.nivoweb.get.invoice-drafts.id": ToolSignature
        "nivo.api.crm.nivoweb.get.invoices": ToolSignature
        "nivo.api.crm.nivoweb.get.payables": ToolSignature
        "nivo.api.crm.nivoweb.get.prices": ToolSignature
        "nivo.api.crm.nivoweb.get.purchases.id": ToolSignature
        "nivo.api.crm.nivoweb.get.purchases.open": ToolSignature
        "nivo.api.crm.nivoweb.get.receivables.overdue": ToolSignature
        "nivo.api.crm.nivoweb.get.renewals.id": ToolSignature
        "nivo.api.crm.nivoweb.get.renewals.open": ToolSignature
        "nivo.api.crm.nivoweb.get.services.code.status": ToolSignature
        "nivo.api.crm.nivoweb.get.services.expiring": ToolSignature
        "nivo.api.crm.nivoweb.get.summary.counts": ToolSignature
        "nivo.api.crm.nivoweb.get.tickets": ToolSignature
        "nivo.api.crm.nivoweb.get.tickets.id": ToolSignature
        "nivo.api.crm.nivoweb.patch.purchases.id": Asking
        "nivo.api.crm.nivoweb.patch.tickets.id": Asking
        "nivo.api.crm.nivoweb.post.customers": Asking
        "nivo.api.crm.nivoweb.post.customers.code.contacts": Asking
        "nivo.api.crm.nivoweb.post.invoice-drafts": Asking
        "nivo.api.crm.nivoweb.post.invoice-drafts.id.invoice": Asking
        "nivo.api.crm.nivoweb.post.payables.party-code.notes": Asking
        "nivo.api.crm.nivoweb.post.purchases": Asking
        "nivo.api.crm.nivoweb.post.purchases.id.acceptance": Asking
        "nivo.api.crm.nivoweb.post.purchases.id.followups": Asking
        "nivo.api.crm.nivoweb.post.purchases.id.outcome": Asking
        "nivo.api.crm.nivoweb.post.purchases.id.payments": Asking
        "nivo.api.crm.nivoweb.post.purchases.id.quotes": Asking
        "nivo.api.crm.nivoweb.post.receivables.code.notices": Asking
        "nivo.api.crm.nivoweb.post.receivables.code.payments": Asking
        "nivo.api.crm.nivoweb.post.renewals": Asking
        "nivo.api.crm.nivoweb.post.renewals.id.outcome": Asking
        "nivo.api.crm.nivoweb.post.renewals.id.payments": Asking
        "nivo.api.crm.nivoweb.post.services.code.reminders": Asking
        "nivo.api.crm.nivoweb.post.tickets": Asking
    }
    interface ApiNames {
        "nivo.api.crm.nivoweb.get.contracts": ApiSignature
        "nivo.api.crm.nivoweb.get.customers": ApiSignature
        "nivo.api.crm.nivoweb.get.customers.code": ApiSignature
        "nivo.api.crm.nivoweb.get.customers.code.balance": ApiSignature
        "nivo.api.crm.nivoweb.get.customers.code.contracts": ApiSignature
        "nivo.api.crm.nivoweb.get.customers.code.documents": ApiSignature
        "nivo.api.crm.nivoweb.get.customers.code.documents.link": ApiSignature
        "nivo.api.crm.nivoweb.get.customers.code.invoices": ApiSignature
        "nivo.api.crm.nivoweb.get.customers.code.services": ApiSignature
        "nivo.api.crm.nivoweb.get.invoice-drafts.id": ApiSignature
        "nivo.api.crm.nivoweb.get.invoices": ApiSignature
        "nivo.api.crm.nivoweb.get.payables": ApiSignature
        "nivo.api.crm.nivoweb.get.prices": ApiSignature
        "nivo.api.crm.nivoweb.get.purchases.id": ApiSignature
        "nivo.api.crm.nivoweb.get.purchases.open": ApiSignature
        "nivo.api.crm.nivoweb.get.receivables.overdue": ApiSignature
        "nivo.api.crm.nivoweb.get.renewals.id": ApiSignature
        "nivo.api.crm.nivoweb.get.renewals.open": ApiSignature
        "nivo.api.crm.nivoweb.get.services.code.status": ApiSignature
        "nivo.api.crm.nivoweb.get.services.expiring": ApiSignature
        "nivo.api.crm.nivoweb.get.summary.counts": ApiSignature
        "nivo.api.crm.nivoweb.get.tickets": ApiSignature
        "nivo.api.crm.nivoweb.get.tickets.id": ApiSignature
        "nivo.api.crm.nivoweb.patch.purchases.id": ApiSignature
        "nivo.api.crm.nivoweb.patch.tickets.id": ApiSignature
        "nivo.api.crm.nivoweb.post.customers": ApiSignature
        "nivo.api.crm.nivoweb.post.customers.code.contacts": ApiSignature
        "nivo.api.crm.nivoweb.post.invoice-drafts": ApiSignature
        "nivo.api.crm.nivoweb.post.invoice-drafts.id.invoice": ApiSignature
        "nivo.api.crm.nivoweb.post.payables.party-code.notes": ApiSignature
        "nivo.api.crm.nivoweb.post.purchases": ApiSignature
        "nivo.api.crm.nivoweb.post.purchases.id.acceptance": ApiSignature
        "nivo.api.crm.nivoweb.post.purchases.id.followups": ApiSignature
        "nivo.api.crm.nivoweb.post.purchases.id.outcome": ApiSignature
        "nivo.api.crm.nivoweb.post.purchases.id.payments": ApiSignature
        "nivo.api.crm.nivoweb.post.purchases.id.quotes": ApiSignature
        "nivo.api.crm.nivoweb.post.receivables.code.notices": ApiSignature
        "nivo.api.crm.nivoweb.post.receivables.code.payments": ApiSignature
        "nivo.api.crm.nivoweb.post.renewals": ApiSignature
        "nivo.api.crm.nivoweb.post.renewals.id.outcome": ApiSignature
        "nivo.api.crm.nivoweb.post.renewals.id.payments": ApiSignature
        "nivo.api.crm.nivoweb.post.services.code.reminders": ApiSignature
        "nivo.api.crm.nivoweb.post.tickets": ApiSignature
    }
    interface ProviderNames {
        "crm.nivoweb": true
    }
}
