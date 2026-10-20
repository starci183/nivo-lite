import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { McpGatewayError, McpGatewayErrorCode } from "../errors/mcp-gateway.error"
import type { GatewayConnectorManifest, JsonObject, NativeAdapter } from "../mcp-gateway.contracts"
import { FIND_INVOICE_MAIL, LIST_INVOICE_MAILS } from "../persistence/einvoice-native.sql"
import type { InvoiceMailRow } from "../persistence/einvoice-native.rows"
import { parseEinvoiceXml } from "./einvoice-xml.policy"
import type { Einvoice } from "./einvoice-xml.policy"

const LIMIT_MAX = 50
const LIMIT_DEFAULT = 20
const YMD = /^\d{4}-\d{2}-\d{2}$/u

/** The e-invoice native connector: the TT78 XML invoices that arrived in the workspace's invoice mailbox (data-hub IMAP sync). */
export const EINVOICE_MANIFEST: GatewayConnectorManifest = {
    key: "einvoice",
    name: "Hóa đơn điện tử",
    kind: "native",
    contractVersion: "einvoice-native@1",
    tools: [
        {
            name: "list",
            description: "E-invoices (TT78 XML) received in the invoice mailbox: seller, number, date, totals.",
            scope: "read",
            defaultMode: "auto",
            inputSchema: {
                type: "object",
                properties: {
                    since: { type: "string", format: "date" },
                    limit: { type: "integer", minimum: 1, maximum: LIMIT_MAX },
                },
            },
        },
        {
            name: "get",
            description: "One e-invoice with its lines, by the id einvoice.list answered.",
            scope: "read",
            defaultMode: "auto",
            inputSchema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] },
        },
    ],
}

const isObject = (value: unknown): value is JsonObject =>
    typeof value === "object" && value !== null && !Array.isArray(value)

/** The parsed invoices of one mail row, each with its id `<record>:<attachment index>`. */
const invoicesOf = (row: InvoiceMailRow): ReadonlyArray<{ readonly id: string; readonly invoice: Einvoice }> => {
    const attachments: ReadonlyArray<unknown> = Array.isArray(row.attachments) ? row.attachments : []
    return attachments.flatMap((attachment, index) => {
        const xml = isObject(attachment) && typeof attachment.xml === "string" ? attachment.xml : ""
        const invoice = xml === "" ? null : parseEinvoiceXml(xml)
        return invoice === null ? [] : [{ id: `${row.id}:${String(index)}`, invoice }]
    })
}

const summaryOf = (id: string, invoice: Einvoice): JsonObject => ({
    id,
    sellerTaxCode: invoice.seller.taxCode,
    sellerName: invoice.seller.name,
    number: invoice.number,
    series: invoice.series,
    issuedOn: invoice.issuedOn,
    totalVnd: invoice.totalVnd,
    vatVnd: invoice.vatVnd,
    format: "xml",
})

@Injectable()
/** Runs the e-invoice tools for a workspace, through the gateway like any other connector; parsing is deterministic (TT78). */
export class EinvoiceNativeAdapter implements NativeAdapter {
    readonly manifest = EINVOICE_MANIFEST

    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** Runs one e-invoice tool. */
    async invoke(workspaceId: string, tool: string, args: JsonObject): Promise<JsonObject> {
        if (tool === "list") return this.list(workspaceId, args)
        if (tool === "get") return this.get(workspaceId, args)
        throw new McpGatewayError({ code: McpGatewayErrorCode.UnknownTool, params: { tool } })
    }

    private async list(workspaceId: string, args: JsonObject): Promise<JsonObject> {
        const since = typeof args.since === "string" && YMD.test(args.since) ? args.since : null
        const limit =
            typeof args.limit === "number" && Number.isInteger(args.limit)
                ? Math.min(LIMIT_MAX, Math.max(1, args.limit))
                : LIMIT_DEFAULT
        const rows: ReadonlyArray<InvoiceMailRow> = await this.entityManager.query(LIST_INVOICE_MAILS, [
            workspaceId,
            since,
        ])
        const invoices = rows.flatMap(invoicesOf).slice(0, limit)
        return { invoices: invoices.map((entry) => summaryOf(entry.id, entry.invoice)) }
    }

    private async get(workspaceId: string, args: JsonObject): Promise<JsonObject> {
        const id = typeof args.id === "string" ? args.id : ""
        const recordId = id.split(":")[0] ?? ""
        const rows: ReadonlyArray<InvoiceMailRow> = await this.entityManager.query(FIND_INVOICE_MAIL, [
            workspaceId,
            recordId,
        ])
        const found = rows.flatMap(invoicesOf).find((entry) => entry.id === id)
        if (found === undefined) return { found: false }
        const { invoice } = found
        return { found: true, id, ...invoice, lines: invoice.lines.map((line) => ({ ...line })) }
    }
}
