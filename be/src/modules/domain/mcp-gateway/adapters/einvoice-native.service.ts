import { Injectable } from "@nestjs/common"
import { DataRecordsReadService } from "@modules/domain/data-records"
import type { MailAttachments } from "@modules/domain/data-records"
import { McpGatewayError, McpGatewayErrorCode } from "../errors/mcp-gateway.error"
import type { GatewayJson, NativeAdapter, NativeConnectorManifest } from "../mcp-gateway.contracts"
import {
    EINVOICE_GET_INPUT_SCHEMA,
    EINVOICE_LIST_INPUT_SCHEMA,
    EinvoiceGetSchema,
    EinvoiceListSchema,
} from "./einvoice-native.schema"
import { parseEinvoiceXml } from "./einvoice-xml.policy"
import type { EinvoiceDraft } from "./einvoice-xml.policy"

/** The e-invoice native connector: the TT78 XML invoices that arrived in the workspace's invoice mailbox (data-hub IMAP sync). */
export const EINVOICE_MANIFEST: NativeConnectorManifest = {
    key: "einvoice",
    name: "E-invoices (TT78)",
    kind: "native",
    contractVersion: "einvoice-native@1",
    tools: [
        {
            name: "list",
            description: "E-invoices (TT78 XML) received in the invoice mailbox: seller, number, date, totals.",
            scope: "read",
            defaultMode: "auto",
            role: "invoice.list",
            inputSchema: EINVOICE_LIST_INPUT_SCHEMA,
            argumentSchema: EinvoiceListSchema,
        },
        {
            name: "get",
            description: "One e-invoice with its lines, by the id einvoice.list answered.",
            scope: "read",
            defaultMode: "auto",
            inputSchema: EINVOICE_GET_INPUT_SCHEMA,
            argumentSchema: EinvoiceGetSchema,
        },
    ],
}

/** The most mails one `einvoice.list` reads. */
const MAIL_LIMIT = 200

/** One parsed invoice of a mail, with its id `<record>:<attachment index>`. */
interface MailInvoice {
    /** The id. */
    readonly id: string
    /** The invoice. */
    readonly invoice: EinvoiceDraft
}

const isObject = (value: unknown): value is GatewayJson =>
    typeof value === "object" && value !== null && !Array.isArray(value)

/** The parsed invoices of one mail row. */
const invoicesOf = (row: MailAttachments): ReadonlyArray<MailInvoice> => {
    const attachments: ReadonlyArray<unknown> = Array.isArray(row.attachments) ? row.attachments : []
    return attachments.flatMap((attachment, index) => {
        const xml = isObject(attachment) && typeof attachment.xml === "string" ? attachment.xml : ""
        const invoice = xml === "" ? null : parseEinvoiceXml(xml)
        return invoice === null ? [] : [{ id: `${row.id}:${String(index)}`, invoice }]
    })
}

/** The invoice as JSON: every field the TT78 reader gave (the accounting desk reads it as its `EinvoiceDraft`). */
const draftJsonOf = (invoice: EinvoiceDraft): GatewayJson => ({
    ...invoice,
    lines: invoice.lines.map((line) => ({ ...line })),
})

const summaryOf = (entry: MailInvoice): GatewayJson => ({
    id: entry.id,
    sellerTaxCode: entry.invoice.sellerTaxCode,
    sellerName: entry.invoice.sellerName,
    number: entry.invoice.invoiceNo,
    series: entry.invoice.series,
    issuedOn: entry.invoice.issuedOn,
    totalVnd: entry.invoice.totalVnd,
    vatVnd: entry.invoice.vatVnd,
    format: "xml",
    draft: draftJsonOf(entry.invoice),
})

/** A TT78 VAT rate as text: `10%`, or `KCT` when the line is not subject to VAT. */
const vatRateText = (rate: number | null): string => (rate === null ? "KCT" : `${String(rate)}%`)

/** One invoice in full, as einvoice.get answers it. */
const detailOf = (entry: MailInvoice): GatewayJson => {
    const { invoice } = entry
    return {
        found: true,
        id: entry.id,
        seller: { taxCode: invoice.sellerTaxCode, name: invoice.sellerName },
        buyer: { taxCode: invoice.buyerTaxCode, name: invoice.buyerName },
        number: invoice.invoiceNo,
        series: invoice.series,
        issuedOn: invoice.issuedOn,
        lines: invoice.lines.map((line) => ({
            name: line.name,
            qty: line.quantity,
            unitPriceVnd: line.quantity === 0 ? 0 : Math.round(line.amountVnd / line.quantity),
            vatRate: vatRateText(line.vatRate),
            amountVnd: line.amountVnd,
        })),
        subtotalVnd: invoice.subtotalVnd,
        totalVnd: invoice.totalVnd,
        vatVnd: invoice.vatVnd,
    }
}

@Injectable()
/** Runs the e-invoice tools for a workspace, through the gateway like any other connector; parsing is deterministic (TT78). */
export class EinvoiceNativeService implements NativeAdapter {
    readonly manifest = EINVOICE_MANIFEST

    constructor(private readonly mails: DataRecordsReadService) {}

    /** Runs one e-invoice tool. */
    async invoke(workspaceId: string, tool: string, args: GatewayJson): Promise<GatewayJson> {
        if (tool === "list") return this.list(workspaceId, args)
        if (tool === "get") return this.get(workspaceId, args)
        throw new McpGatewayError({ code: McpGatewayErrorCode.UnknownTool, params: { tool } })
    }

    private async list(workspaceId: string, args: GatewayJson): Promise<GatewayJson> {
        const parsed = EinvoiceListSchema.safeParse(args)
        if (!parsed.success) {
            throw new McpGatewayError({ code: McpGatewayErrorCode.InvalidArguments, params: { tool: "list" } })
        }
        const { since, limit } = parsed.data
        const rows = await this.mails.mailsWithXml(workspaceId, since, MAIL_LIMIT)
        return { invoices: rows.flatMap(invoicesOf).slice(0, limit).map(summaryOf) }
    }

    private async get(workspaceId: string, args: GatewayJson): Promise<GatewayJson> {
        const parsed = EinvoiceGetSchema.safeParse(args)
        if (!parsed.success) {
            throw new McpGatewayError({ code: McpGatewayErrorCode.InvalidArguments, params: { tool: "get" } })
        }
        const { id } = parsed.data
        const recordId = id.split(":", 1).join("")
        const mail = await this.mails.mailAttachments(workspaceId, recordId)
        const found = (mail === undefined ? [] : invoicesOf(mail)).find((entry) => entry.id === id)
        return found === undefined ? { found: false } : detailOf(found)
    }
}
