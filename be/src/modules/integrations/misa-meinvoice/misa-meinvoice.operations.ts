import type { ProviderOperation } from "@modules/integrations/provider-http"

/** The provider segment of the MISA meInvoice level-1 names (`apiSegmentOf` of the provider key). */
const SEGMENT = "nivo.api.misa-meinvoice"

/** What was searched for the official documentation and what was found: every operation below is `docs-missing`. */
const DOCS_MISSING =
    "docs-missing: the official integration documentation is doc.meinvoice.vn (found by search: an indexed page " +
    "`https://doc.meinvoice.vn/api/Document/InvoiceStatus.html` naming " +
    "`https://testapi.meinvoice.vn/api/v3/itg/invoicepublished/invoicestatus` and Bearer auth), but every page of " +
    "doc.meinvoice.vn answered 404 to a plain read (2026-11-13), so no request or response member could be read; " +
    "third-party pages (an MCP listing, an ERP connector) say MISA hands each customer a private API and " +
    "credentials, and that publishing needs the seller's signing token: none of it is official, none of it is used."

/** The operations of the table, by name. */
type MisaMeinvoiceOperationName =
    | "authToken"
    | "invoicePublish"
    | "invoiceStatusGet"
    | "invoiceDownload"
    | "invoiceCancel"

/**
 * Every MISA meInvoice operation a generic purpose needs, NAMED and not built (`DOCS_MISSING` says why). Each adapter method refuses
 * `not_available` until the documentation is read; then each entry gets its method, path and documentation URL.
 */
export const MISA_MEINVOICE_OPERATIONS: Readonly<Record<MisaMeinvoiceOperationName, ProviderOperation>> = {
    authToken: {
        api: `${SEGMENT}.auth.token`,
        method: null,
        path: null,
        docs: DOCS_MISSING,
        status: "docs-missing",
        serves: null,
    },
    invoicePublish: {
        api: `${SEGMENT}.invoice.publish`,
        method: null,
        path: null,
        docs: DOCS_MISSING,
        status: "docs-missing",
        serves: "nivo.tool.invoice.create",
    },
    invoiceStatusGet: {
        api: `${SEGMENT}.invoice.status.get`,
        method: null,
        path: null,
        docs: DOCS_MISSING,
        status: "docs-missing",
        serves: "nivo.tool.invoice.get",
    },
    invoiceDownload: {
        api: `${SEGMENT}.invoice.download`,
        method: null,
        path: null,
        docs: DOCS_MISSING,
        status: "docs-missing",
        serves: "nivo.tool.invoice.file.get",
    },
    invoiceCancel: {
        api: `${SEGMENT}.invoice.cancel`,
        method: null,
        path: null,
        docs: DOCS_MISSING,
        status: "docs-missing",
        serves: "nivo.tool.invoice.cancel",
    },
} as const satisfies Readonly<Record<string, ProviderOperation>>
