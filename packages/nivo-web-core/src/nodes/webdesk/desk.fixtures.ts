import type { JsonObject } from "@nivo-lite/agent-sdk/schema"

/**
 * The CRM records of the Support steps' worked examples, shared by the split steps so each example reads the same customer,
 * services and tickets the old one did (`intake.node.ts`, `intake-linked.node.ts`).
 */

/** The conversation of the worked examples. */
export const CONVERSATION = "4f5a6b7c-8d9e-4f0a-9b1c-2d3e4f5a6b7c"

/** The lead of the worked examples' conversation. */
export const LEAD = "6a7b8c9d-0000-4000-8000-000000000041"

/** The mail of the mailed-ticket examples. */
export const MAIL = "1b2c3d4e-5f60-4a7b-8c9d-0e1f2a3b4c5d"

/** The name the Support steps write their notes under (the agent's label as the team knows it). */
export const AUTHOR = "Ho tro"

/** The customer's words of the site-error examples. */
export const SITE_ERROR = "Web cong ty minh bi loi 500 tu sang, ten mien example.vn"

/** One service of the example customer, as the CRM's service list answers it. */
export const serviceOf = (code: string, kind: string): JsonObject => ({
    code,
    customerCode: "KH-0001",
    domain: "example.vn",
    serviceClass: kind,
    provider: "manual",
    status: "active",
    startsOn: "2026-03-01",
    expiresOn: "2027-03-01",
    expirySource: "provider",
})

/** The example customer's services: a hosting and a domain. */
export const SERVICES: JsonObject = {
    items: [serviceOf("EXAMPLE-HOST", "hosting"), serviceOf("EXAMPLE-TM", "domain")],
    nextCursor: null,
}

/** The linked customer's services in the conversation examples: the hosting only. */
export const HOSTING_ONLY: JsonObject = { items: [serviceOf("EXAMPLE-HOST", "hosting")], nextCursor: null }

/** A ticket list with nothing open. */
export const NO_TICKETS: JsonObject = { items: [], nextCursor: null }

/** One ticket as a ticket list answers it. */
export const ticketRow = (id: string, status: string, subject: string): JsonObject => ({
    id,
    customerCode: "KH-0001",
    serviceCodes: ["EXAMPLE-HOST"],
    kind: "fault",
    status,
    channel: "zalo",
    sourceRef: null,
    subject,
    openedAt: "2026-11-10T02:00:00.000Z",
    closedAt: null,
})

/** One ticket as the CRM answers a create, an update or a read: the row, the report and its notes. */
export const ticketOf = (id: string, status: string, subject: string, summary: string): JsonObject => ({
    ...ticketRow(id, status, subject),
    summary,
    notes: [],
})

/** The ticket the site-error examples open. */
export const OPENED: JsonObject = ticketOf(
    "TK-0001",
    "open",
    "Web example.vn loi 500",
    "Web example.vn loi 500 tu sang.",
)

/** A list with the site-error ticket still open. */
export const OPEN_TICKET: JsonObject = {
    items: [ticketRow("TK-0001", "in_progress", "Web example.vn loi 500")],
    nextCursor: null,
}
