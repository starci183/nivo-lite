import { GoogleError, GoogleErrorCode } from "./errors/google.error"
import { GOOGLE_MESSAGES } from "./messages/google.messages"
import type { SheetCell, SheetConfig, SheetEventIn, SheetEventResult, SheetsApi } from "./google.contracts"

/** The money column format: thousands separators and the dong sign. */
export const MONEY_PATTERN = '#,##0" ₫"'

const TEXT = GOOGLE_MESSAGES.vi

const ORDER_COLUMNS = ["date", "code", "customer", "service", "amount", "status", "paid", "channel", "owner"] as const
const LEAD_COLUMNS = ["date", "name", "company", "need", "phone", "email", "channel"] as const

/** One text of the sheet product copy, with `{{name}}` placeholders filled. */
export const sheetText = (key: string, params: Readonly<Record<string, string | number>> = {}): string =>
    (TEXT[key] ?? key).replace(/\{\{(\w+)\}\}/gu, (_, name: string) => String(params[name] ?? ""))

/** The orders tab title. */
export const ordersTab = (): string => sheetText("sheet.ordersTab")

/** The new-customers tab title. */
export const leadsTab = (): string => sheetText("sheet.leadsTab")

/** The orders header row. */
export const orderHeader = (): ReadonlyArray<string> =>
    ORDER_COLUMNS.map((column) => sheetText(`sheet.orderHeader.${column}`))

/** The new-customers header row. */
export const leadHeader = (): ReadonlyArray<string> =>
    LEAD_COLUMNS.map((column) => sheetText(`sheet.leadHeader.${column}`))

/** dd/MM/yyyy HH:mm in Vietnam time (the current time when `iso` is not a date). */
export const formatVnTime = (iso: string, now: Date): string => {
    const parsed = new Date(iso)
    const date = Number.isNaN(parsed.getTime()) ? now : parsed
    const parts = Object.fromEntries(
        new Intl.DateTimeFormat("en-GB", {
            timeZone: "Asia/Ho_Chi_Minh",
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            hourCycle: "h23",
        })
            .formatToParts(date)
            .map((part) => [part.type, part.value]),
    )
    return `${parts.day}/${parts.month}/${parts.year} ${parts.hour}:${parts.minute}`
}

/** An amount of dong with vi-VN grouping and the dong sign. */
export const formatVnd = (amount: number): string => `${new Intl.NumberFormat("vi-VN").format(Math.round(amount))} ₫`

/** The code a row of a won deal carries before any order number exists. */
export const leadKey = (leadId: string): string => `KH-${leadId.replace(/-/gu, "").slice(0, 8)}`

const textCell = (value: string, bold = false) => ({
    userEnteredValue: { stringValue: value },
    ...(bold ? { userEnteredFormat: { textFormat: { bold: true } } } : {}),
})

const valueCell = (value: SheetCell) =>
    typeof value === "number" ? { userEnteredValue: { numberValue: value } } : textCell(value)

const columnSizes = (pixels: ReadonlyArray<number>) => pixels.map((pixelSize) => ({ pixelSize }))

/** The body of spreadsheets.create: two tabs, bold frozen header rows, column widths and the sample row. */
export const buildCreateBody = (title: string, now: Date) => {
    const sample: ReadonlyArray<SheetCell> = [
        formatVnTime(now.toISOString(), now),
        "MAU-001",
        sheetText("sheet.sampleMark"),
        sheetText("sheet.sampleService"),
        500000,
        sheetText("sheet.statusWon"),
        "",
        sheetText("sheet.sampleChannel"),
        sheetText("sheet.sampleOwner"),
    ]
    return {
        properties: { title, locale: "vi_VN", timeZone: "Asia/Ho_Chi_Minh" },
        sheets: [
            {
                properties: {
                    sheetId: 0,
                    title: ordersTab(),
                    index: 0,
                    gridProperties: { frozenRowCount: 1, rowCount: 1000, columnCount: ORDER_COLUMNS.length },
                },
                data: [
                    {
                        startRow: 0,
                        startColumn: 0,
                        columnMetadata: columnSizes([130, 110, 190, 220, 120, 130, 230, 100, 150]),
                        rowData: [
                            { values: orderHeader().map((header) => textCell(header, true)) },
                            { values: sample.map(valueCell) },
                        ],
                    },
                ],
            },
            {
                properties: {
                    sheetId: 1,
                    title: leadsTab(),
                    index: 1,
                    gridProperties: { frozenRowCount: 1, rowCount: 1000, columnCount: LEAD_COLUMNS.length },
                },
                data: [
                    {
                        startRow: 0,
                        startColumn: 0,
                        columnMetadata: columnSizes([130, 170, 170, 260, 130, 200, 100]),
                        rowData: [{ values: leadHeader().map((header) => textCell(header, true)) }],
                    },
                ],
            },
        ],
    }
}

/** The follow-up batchUpdate: the money column (E) shows thousands separators and the dong sign for every row below the header. */
export const buildFormatBody = () => ({
    requests: [
        {
            repeatCell: {
                range: { sheetId: 0, startRowIndex: 1, startColumnIndex: 4, endColumnIndex: 5 },
                cell: {
                    userEnteredFormat: {
                        numberFormat: { type: "NUMBER", pattern: MONEY_PATTERN },
                        horizontalAlignment: "RIGHT",
                    },
                },
                fields: "userEnteredFormat.numberFormat,userEnteredFormat.horizontalAlignment",
            },
        },
    ],
})

const asText = (value: unknown): string => {
    if (typeof value === "string") return value.trim()
    return typeof value === "number" && Number.isFinite(value) ? String(value) : ""
}

const asNumber = (value: unknown): number =>
    typeof value === "number" && Number.isFinite(value) ? value : Number(value) || 0

const nameOf = (item: unknown): string => {
    if (typeof item === "string") return item
    if (typeof item !== "object" || item === null) return ""
    const record = item as Record<string, unknown>
    return asText(record.name ?? record.title)
}

const itemsText = (value: unknown): string =>
    Array.isArray(value) ? value.map(nameOf).filter(Boolean).join(", ") : asText(value)

const flagOn = (config: SheetConfig, key: string): boolean => config[key] === true || config[key] === "true"

const skipped = (why: string): SheetEventResult => ({
    evidence: sheetText("evidence.skipped", { why: sheetText(why) }),
    skipped: true,
})

/**
 * Applies one NIVO event to the shop's sheet through the sheet operations. Idempotent: an order code appears once (a repeat
 * updates or is a no-op). Throws GOOGLE_SHEET_MISSING when the config names no spreadsheet; any API failure propagates so the caller retries.
 */
export const applySheetEvent = async (
    api: SheetsApi,
    config: SheetConfig,
    event: SheetEventIn,
    now: Date,
): Promise<SheetEventResult> => {
    const id = asText(config.spreadsheetId)
    if (!id) throw new GoogleError({ code: GoogleErrorCode.SheetMissing })
    const data = event.data
    const at = formatVnTime(event.occurredAt, now)
    const where = (row: number, what: string) => sheetText("evidence.where", { id, row, what })
    const orderNo = asText(data.order_no)
    const leadCode = asText(data.lead_id) ? leadKey(asText(data.lead_id)) : ""

    if (event.event === "lead.created") {
        if (!flagOn(config, "recordLeads")) return skipped("evidence.why.leadsOff")
        const row = await api.appendRow(id, leadsTab(), LEAD_COLUMNS.length, [
            at,
            asText(data.name),
            asText(data.company),
            asText(data.need),
            asText(data.phone),
            asText(data.email),
            asText(data.channel),
        ])
        const name = asText(data.name) || sheetText("evidence.noName")
        return { evidence: where(row, sheetText("evidence.leadNew", { name })) }
    }

    if (event.event === "payment.received") {
        if (!flagOn(config, "markPaid")) return skipped("evidence.why.paidOff")
        const amount = asNumber(data.amount_vnd)
        const paidText = sheetText("sheet.paidNote", {
            amount: formatVnd(amount),
            at: formatVnTime(asText(data.paid_at) || event.occurredAt, now),
        })
        const found = await api.findRow(id, [orderNo, leadCode])
        if (found) {
            await api.updateCells(id, found.row, { F: sheetText("sheet.statusPaid"), G: paidText })
            return { evidence: where(found.row, sheetText("evidence.markedPaid", { code: found.code })) }
        }
        const code = orderNo || asText(data.invoice_no) || leadCode
        const added = await api.appendRow(id, ordersTab(), ORDER_COLUMNS.length, [
            at,
            code,
            asText(data.customer),
            "",
            amount,
            sheetText("sheet.statusPaid"),
            paidText,
            "",
            "",
        ])
        return { evidence: where(added, sheetText("evidence.addedPaid", { code })) }
    }

    // order.confirmed | deal.won
    if (!flagOn(config, "recordOrders")) return skipped("evidence.why.ordersOff")
    const code = orderNo || leadCode
    const have = await api.findRow(id, [orderNo, leadCode])
    if (event.event === "deal.won") {
        if (have) return { evidence: where(have.row, sheetText("evidence.rowKept", { code: have.code })) }
        const row = await api.appendRow(id, ordersTab(), ORDER_COLUMNS.length, [
            at,
            code,
            asText(data.name) || asText(data.company),
            asText(data.need),
            "",
            sheetText("sheet.statusWon"),
            "",
            asText(data.channel),
            "",
        ])
        return { evidence: where(row, sheetText("evidence.dealWon", { code })) }
    }
    if (have) {
        // A row from deal.won (keyed by the lead) becomes the order's row; a row that already has the order code is left as it is.
        if (!orderNo || have.code === orderNo) {
            return { evidence: where(have.row, sheetText("evidence.rowKept", { code: have.code })) }
        }
        const cells: Record<string, SheetCell> = {
            B: orderNo,
            D: itemsText(data.items),
            E: asNumber(data.amount_vnd),
            F: sheetText("sheet.statusWon"),
        }
        if (asText(data.confirmed_by)) cells.I = asText(data.confirmed_by)
        await api.updateCells(id, have.row, cells)
        return { evidence: where(have.row, sheetText("evidence.rowUpdated", { code: have.code, order: orderNo })) }
    }
    const row = await api.appendRow(id, ordersTab(), ORDER_COLUMNS.length, [
        at,
        code,
        asText(data.customer),
        itemsText(data.items),
        asNumber(data.amount_vnd),
        sheetText("sheet.statusWon"),
        "",
        asText(data.channel),
        asText(data.confirmed_by),
    ])
    return { evidence: where(row, sheetText("evidence.orderWritten", { code })) }
}
