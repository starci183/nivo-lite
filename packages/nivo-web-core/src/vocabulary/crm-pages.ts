import { type DeskOfModule, DATA_PAGE_WORDS } from "@nivo-lite/blocks-core"
import type { SpecText } from "@nivo-lite/agent-sdk/schema"
import type { SpecNode, SpecParam } from "@nivo-lite/agent-sdk/spec"
import { CRM_NIVOWEB } from "../crm/nivoweb/api.generated"

/*
 * The data pages of the NIVO Web agents' desks: the CRM's own records, read through the OpenAPI provider's interface reads
 * (`openapi:<api read>`: the one name `nivo.api.crm.nivoweb.<method>.<path>` the CRM document gives, `CRM_NIVOWEB`), drawn
 * by the generic table and detail. No read, port or table of the plugin: the pinned document's GET operation is the read. Paths and members are the CRM document's (the answer the provider hands the
 * screen is the operation's body). A money amount the CRM leaves null draws an empty cell (`core.table` / `core.detail`), never 0.
 */

/** The param a data page's table marks its chosen row with, which its detail reads. */
export const ROW_PARAM = "row"

/** The params every NIVO Web desk with a data page adds. */
export const DATA_PAGE_PARAMS: Readonly<Record<string, SpecParam>> = { [ROW_PARAM]: { type: "string", url: ROW_PARAM } }

/** One API read of the CRM. */
type ApiRead = (typeof CRM_NIVOWEB)[keyof typeof CRM_NIVOWEB]

/** The provider read of a CRM operation: its API read, never a tool a node calls. */
const readOf = (read: ApiRead): string => `openapi:${read}`

/** One column of a data page's table. */
interface Column {
    readonly term: SpecText
    readonly path: string
    readonly format?: "text" | "number" | "money" | "date" | "day" | "dateTime" | "badge"
    readonly subPath?: string
    readonly align?: "start" | "end"
}

/** One fact of a data page's detail. */
interface Fact {
    readonly term: SpecText
    readonly path: string
    readonly format?: "text" | "number" | "money" | "date" | "day" | "dateTime" | "badge"
}

const t = (vi: string, en: string): SpecText => ({ vi, en })

/** A data page's table over a CRM list, paged by the read's cursor; with `selects` its rows mark the chosen one for a detail. */
const tableOf = (id: string, label: SpecText, read: ApiRead, idPath: string, columns: ReadonlyArray<Column>, selects: boolean): SpecNode => ({
    id,
    block: "core.table",
    props: {
        label,
        empty: DATA_PAGE_WORDS.empty,
        idPath,
        columns: columns.map((column) => ({ ...column })),
        currency: "VND",
        ...(selects ? { selectParam: ROW_PARAM } : {}),
    },
    bind: { rows: { read: readOf(read) } },
})

/** A data page's detail of the chosen row, read by its own CRM read with the row's key. */
const detailOf = (id: string, label: SpecText, read: ApiRead, key: string, facts: ReadonlyArray<Fact>): SpecNode => ({
    id,
    block: "core.detail",
    props: { label, idle: DATA_PAGE_WORDS.idle, items: facts.map((fact) => ({ ...fact })), currency: "VND", closeParam: ROW_PARAM },
    bind: { record: { read: readOf(read), variables: { [key]: `$${ROW_PARAM}` } } },
})

/** A data page: the table and, when the CRM reads one row by its key, the chosen row beside it. */
const pageOf = (table: SpecNode, detail: SpecNode | null): SpecNode =>
    detail === null
        ? table
        : {
              id: `${table.id}-page`,
              block: "core.master-detail",
              props: { emptyTitle: DATA_PAGE_WORDS.idle, emptyBody: DATA_PAGE_WORDS.idle },
              children: [table, detail],
          }

const CUSTOMER = t("Kh\u00e1ch", "Customer")
const STATE = t("Tr\u1ea1ng th\u00e1i", "State")
const PROVIDER = t("Nh\u00e0 cung c\u1ea5p", "Provider")
const TOTAL = t("T\u1ed5ng", "Total")

/** Services ending soon (`service.expiring.list`), each with its status (`service.status.get` by the service code). */
const servicesEnding: SpecNode = pageOf(
    tableOf(
        "services-ending",
        t("D\u1ecbch v\u1ee5 s\u1eafp h\u1ebft h\u1ea1n", "Services ending soon"),
        CRM_NIVOWEB.get_services_expiring,
        "code",
        [
            { term: t("D\u1ecbch v\u1ee5", "Service"), path: "domain", subPath: "code" },
            { term: CUSTOMER, path: "customerCode" },
            { term: t("Lo\u1ea1i", "Class"), path: "serviceClass" },
            { term: t("H\u1ebft h\u1ea1n", "Ends"), path: "expiresOn", format: "day" },
            { term: t("C\u00f2n (ng\u00e0y)", "Days left"), path: "daysLeft", format: "number", align: "end" },
            { term: STATE, path: "status" },
        ],
        true,
    ),
    detailOf("service-status", t("Tr\u1ea1ng th\u00e1i d\u1ecbch v\u1ee5", "Service status"), CRM_NIVOWEB.get_services_code_status, "code", [
        { term: t("D\u1ecbch v\u1ee5", "Service"), path: "serviceCode" },
        { term: STATE, path: "state" },
        { term: t("H\u1ebft h\u1ea1n", "Ends"), path: "expiresOn", format: "day" },
        { term: t("Ki\u1ec3m tra b\u1edfi", "Checked by"), path: "checkedBy" },
        { term: t("Ghi ch\u00fa", "Note"), path: "note" },
    ]),
)

/** The open renewal requests (`renewal.open.list`), each read by its id (`renewal.get`). */
const renewalsOpen: SpecNode = pageOf(
    tableOf(
        "renewals-open",
        t("Y\u00eau c\u1ea7u gia h\u1ea1n \u0111ang m\u1edf", "Open renewal requests"),
        CRM_NIVOWEB.get_renewals_open,
        "id",
        [
            { term: t("D\u1ecbch v\u1ee5", "Service"), path: "serviceCode" },
            { term: CUSTOMER, path: "customerCode" },
            { term: PROVIDER, path: "provider" },
            { term: STATE, path: "state" },
            { term: TOTAL, path: "totalVnd", format: "money", align: "end" },
            { term: t("M\u00e3 thanh to\u00e1n", "Payment code"), path: "paymentCode" },
        ],
        true,
    ),
    detailOf("renewal", t("Y\u00eau c\u1ea7u gia h\u1ea1n", "Renewal request"), CRM_NIVOWEB.get_renewals_id, "id", [
        { term: t("D\u1ecbch v\u1ee5", "Service"), path: "serviceCode" },
        { term: CUSTOMER, path: "customerCode" },
        { term: PROVIDER, path: "provider" },
        { term: t("S\u1ed1 th\u00e1ng", "Months"), path: "termMonths", format: "number" },
        { term: STATE, path: "state" },
        { term: t("Tr\u01b0\u1edbc thu\u1ebf", "Net"), path: "netVnd", format: "money" },
        { term: t("Thu\u1ebf", "VAT"), path: "vatVnd", format: "money" },
        { term: TOTAL, path: "totalVnd", format: "money" },
        { term: t("M\u00e3 thanh to\u00e1n", "Payment code"), path: "paymentCode" },
        { term: t("H\u1ebft h\u1ea1n m\u1edbi", "New end"), path: "newExpiresOn", format: "day" },
        { term: t("\u0110\u00e3 tr\u1ea3 l\u00fac", "Paid at"), path: "paidAt", format: "dateTime" },
    ]),
)

/** The overdue project receivables (`receivable.overdue.list`); the CRM reads none by its key, so the page is the table alone. */
const receivablesOverdue: SpecNode = tableOf(
    "receivables-overdue",
    t("Ph\u1ea3i thu qu\u00e1 h\u1ea1n", "Overdue receivables"),
    CRM_NIVOWEB.get_receivables_overdue,
    "projectCode",
    [
        { term: t("D\u1ef1 \u00e1n", "Project"), path: "projectCode", subPath: "contractRef" },
        { term: CUSTOMER, path: "customerCode" },
        { term: t("\u0110\u1ebfn h\u1ea1n", "Due"), path: "dueOn", format: "day" },
        { term: TOTAL, path: "totalVnd", format: "money", align: "end" },
        { term: t("C\u00f2n ph\u1ea3i thu", "Remaining"), path: "remainingVnd", format: "money", align: "end" },
        { term: t("L\u1ea7n nh\u1eafc", "Notices"), path: "noticeCount", format: "number", align: "end" },
    ],
    false,
)

/** The payables (`payable.list`); the CRM reads none by its key, so the page is the table alone. */
const payables: SpecNode = tableOf(
    "payables",
    t("Ph\u1ea3i tr\u1ea3", "Payables"),
    CRM_NIVOWEB.get_payables,
    "partyCode",
    [
        { term: t("Nh\u00e0 cung c\u1ea5p", "Supplier"), path: "partyName", subPath: "partyCode" },
        { term: t("D\u01b0 c\u00f3", "Credit"), path: "closingCreditVnd", format: "money", align: "end" },
        { term: t("D\u01b0 n\u1ee3", "Debit"), path: "closingDebitVnd", format: "money", align: "end" },
        { term: t("Ghi ch\u00fa", "Notes"), path: "noteCount", format: "number", align: "end" },
        { term: t("Ho\u00e1 \u0111\u01a1n ghi ch\u00fa g\u1ea7n nh\u1ea5t", "Last noted invoice"), path: "lastNoteInvoiceNo" },
    ],
    false,
)

/**
 * The tickets (`ticket.list`). The page is the table alone: the plugin declares `ticket.get` with `ticketId`, the CRM document reads the
 * ticket by `id`, so a detail bound by the declaration would send a member the document does not take.
 */
const tickets: SpecNode = tableOf(
    "tickets",
    t("Phi\u1ebfu h\u1ed7 tr\u1ee3", "Tickets"),
    CRM_NIVOWEB.get_tickets,
    "id",
    [
        { term: t("N\u1ed9i dung", "Subject"), path: "subject" },
        { term: CUSTOMER, path: "customerCode" },
        { term: t("Lo\u1ea1i", "Kind"), path: "kind" },
        { term: STATE, path: "status" },
        { term: t("K\u00eanh", "Channel"), path: "channel" },
        { term: t("M\u1edf l\u00fac", "Opened"), path: "openedAt", format: "dateTime" },
    ],
    false,
)

/** The invoices the company issued, every customer (`invoice.list`, an interface read); the CRM reads none by number, so a table alone. */
const invoices: SpecNode = tableOf(
    "invoices",
    t("Ho\u00e1 \u0111\u01a1n", "Invoices"),
    CRM_NIVOWEB.get_invoices,
    "invoiceNo",
    [
        { term: t("S\u1ed1 ho\u00e1 \u0111\u01a1n", "Invoice no."), path: "invoiceNo" },
        { term: CUSTOMER, path: "customerCode" },
        { term: t("Ng\u00e0y xu\u1ea5t", "Issued"), path: "issuedOn", format: "day" },
        { term: TOTAL, path: "amountVnd", format: "money", align: "end" },
    ],
    false,
)

/** The company's contracts, every customer (`contract.list`, an interface read); a table alone. */
const contracts: SpecNode = tableOf(
    "contracts",
    t("H\u1ee3p \u0111\u1ed3ng", "Contracts"),
    CRM_NIVOWEB.get_contracts,
    "contractNo",
    [
        { term: t("S\u1ed1 h\u1ee3p \u0111\u1ed3ng", "Contract no."), path: "contractNo", subPath: "kind" },
        { term: t("\u0110\u1ed1i t\u00e1c", "Partner"), path: "partnerName" },
        { term: t("Ng\u00e0y k\u00fd", "Signed"), path: "signedOn", format: "day" },
        { term: t("H\u1ebft h\u1ea1n", "Ends"), path: "expiresOn", format: "day" },
        { term: t("Gi\u00e1 tr\u1ecb", "Value"), path: "valueVnd", format: "money", align: "end" },
        { term: STATE, path: "statusText" },
    ],
    false,
)

/** The ONE read that counts every NIVO Web desk's sets: the CRM's counts (`summary.count.get`, an interface read). */
const COUNTS = { read: `openapi:${CRM_NIVOWEB.get_summary_counts}` }

/** The renewal states the open renewals page lists (`renewal.open.list`), as the CRM counts them per state. */
const OPEN_RENEWAL_STATES: ReadonlyArray<string> = ["awaiting_payment", "paid", "pending_person"]

/**
 * The Renewal agent's desk: services ending soon and the open renewal requests. Counts from the CRM's counts (`summary.count.get`): the
 * open renewals are the sum over their open states; services are counted per status, none of which is "ending soon", so no count.
 */
export const WEBRENEW_DESK: DeskOfModule = {
    dataSets: [
        { set: "services-ending", label: t("D\u1ecbch v\u1ee5 s\u1eafp h\u1ebft h\u1ea1n", "Services ending soon") },
        {
            set: "renewals-open",
            label: t("Y\u00eau c\u1ea7u gia h\u1ea1n", "Renewal requests"),
            countRows: { path: "renewals", value: "count", by: "state", keys: OPEN_RENEWAL_STATES },
        },
    ],
    counts: COUNTS,
    pages: { "services-ending": servicesEnding, "renewals-open": renewalsOpen },
    params: DATA_PAGE_PARAMS,
}

/**
 * The Accounting agent's desk: invoices (the workspace-wide `invoice.list`, an interface read), overdue receivables and payables.
 * Counts: invoices and payables from the CRM's counts; overdue receivables none (the counts hold OPEN receivables, not overdue ones).
 */
export const WEBBOOKS_DESK: DeskOfModule = {
    dataSets: [
        { set: "invoices", label: t("Ho\u00e1 \u0111\u01a1n", "Invoices"), countPath: "invoices" },
        { set: "receivables-overdue", label: t("Ph\u1ea3i thu qu\u00e1 h\u1ea1n", "Overdue receivables") },
        { set: "payables", label: t("Ph\u1ea3i tr\u1ea3", "Payables"), countPath: "payables" },
    ],
    counts: COUNTS,
    pages: { invoices, "receivables-overdue": receivablesOverdue, payables },
}

/** The Support agent's desk: the tickets, counted over every state. Service status is left out: `service.status.get` reads one service by code; no list exists. */
export const WEBDESK_DESK: DeskOfModule = {
    dataSets: [{ set: "tickets", label: t("Phi\u1ebfu h\u1ed7 tr\u1ee3", "Tickets"), countRows: { path: "tickets", value: "count" } }],
    counts: COUNTS,
    pages: { tickets },
}

/**
 * The Documents agent's desk: the contracts (the workspace-wide `contract.list`, an interface read), counted by the CRM's counts.
 * Documents are left out: the CRM's document holds no workspace-wide document list (`customer.document.list` is per customer).
 */
export const WEBDOCS_DESK: DeskOfModule = {
    dataSets: [{ set: "contracts", label: t("H\u1ee3p \u0111\u1ed3ng", "Contracts"), countPath: "contracts" }],
    counts: COUNTS,
    pages: { contracts },
}

/** The open purchases of new customers (`purchase.open.list`), each read by its id (`purchase.get`). */
const purchasesOpen: SpecNode = pageOf(
    tableOf(
        "purchases-open",
        t("Y\u00eau c\u1ea7u mua m\u1edbi", "New purchases"),
        CRM_NIVOWEB.get_purchases_open,
        "id",
        [
            { term: t("M\u00e3", "Code"), path: "code" },
            { term: CUSTOMER, path: "customerCode" },
            { term: STATE, path: "state" },
            { term: t("K\u00eanh", "Channel"), path: "channel" },
            { term: t("B\u00e1o gi\u00e1 ng\u00e0y", "Quoted"), path: "quotedOn", format: "day" },
            { term: t("Gi\u1eef \u0111\u1ebfn", "Holds until"), path: "validUntil", format: "day" },
            { term: t("L\u1ea7n nh\u1eafc", "Follow-ups"), path: "followUpCount", format: "number", align: "end" },
        ],
        true,
    ),
    detailOf("purchase", t("Y\u00eau c\u1ea7u mua", "Purchase"), CRM_NIVOWEB.get_purchases_id, "id", [
        { term: t("M\u00e3", "Code"), path: "code" },
        { term: STATE, path: "state" },
        { term: t("Nhu c\u1ea7u", "Need"), path: "need" },
        { term: t("Ng\u01b0\u1eddi li\u00ean h\u1ec7", "Contact"), path: "contactName" },
        { term: t("\u0110i\u1ec7n tho\u1ea1i", "Phone"), path: "phone" },
        { term: t("Th\u01b0", "Mail"), path: "email" },
        { term: CUSTOMER, path: "customerCode" },
        { term: t("Tr\u01b0\u1edbc thu\u1ebf", "Net"), path: "quote.netVnd", format: "money" },
        { term: t("Thu\u1ebf", "VAT"), path: "quote.vatVnd", format: "money" },
        { term: TOTAL, path: "quote.totalVnd", format: "money" },
        { term: t("Gi\u1eef \u0111\u1ebfn", "Holds until"), path: "quote.validUntil", format: "day" },
        { term: t("M\u00e3 thanh to\u00e1n", "Payment code"), path: "paymentCode" },
        { term: t("S\u1ed1 h\u1ee3p \u0111\u1ed3ng", "Contract no."), path: "contractNo" },
    ]),
)

/** The price list (`price.list`): what the company sells and renews, as the CRM holds it; a table alone. */
const prices: SpecNode = tableOf(
    "prices",
    t("B\u1ea3ng gi\u00e1", "Price list"),
    CRM_NIVOWEB.get_prices,
    "priceCode",
    [
        { term: t("G\u00f3i", "Item"), path: "name", subPath: "priceCode" },
        { term: t("Lo\u1ea1i", "Kind"), path: "kind" },
        { term: t("S\u1ed1 th\u00e1ng", "Months"), path: "termMonths", format: "number", align: "end" },
        { term: t("Tr\u01b0\u1edbc thu\u1ebf", "Net"), path: "netVnd", format: "money", align: "end" },
        { term: TOTAL, path: "totalVnd", format: "money", align: "end" },
        { term: t("Ngu\u1ed3n gi\u00e1", "Price source"), path: "priceSource" },
    ],
    false,
)

/**
 * The Sales agent's desk: the open purchases of new customers (counted over every state by the CRM's counts) and the price list.
 * Customers are left out: the CRM lists customers only by a search (`customer.find` needs `q`), so no table can be bound to it.
 */
export const WEBSALES_DESK: DeskOfModule = {
    dataSets: [
        { set: "purchases-open", label: t("Y\u00eau c\u1ea7u mua m\u1edbi", "New purchases"), countRows: { path: "purchases", value: "count" } },
        { set: "prices", label: t("B\u1ea3ng gi\u00e1", "Price list") },
    ],
    counts: COUNTS,
    pages: { "purchases-open": purchasesOpen, prices },
    params: DATA_PAGE_PARAMS,
}

/** The Mailbox agent's desk: it works on no CRM data; block 6 is hidden. */
export const WEBMAIL_DESK: DeskOfModule = { dataSets: [], pages: {} }
