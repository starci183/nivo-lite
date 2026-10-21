import { childrenNamed, findFirst, parseXml, textAt } from "./xml-tree.policy"
import type { XmlNode } from "./xml-tree.policy"

/** One line of an e-invoice (TT78 `HHDVu`). */
export interface EinvoiceLine {
    /** The description. */
    readonly name: string
    /** The quantity. */
    readonly quantity: number
    /** The amount before VAT, VND. */
    readonly amountVnd: number
    /** The VAT rate in percent, or null for KCT / KKKNT (not subject). */
    readonly vatRate: number | null
}

/** A Vietnamese e-invoice (Circular 78/2021, TT78) read from its XML; the accounting desk's `EinvoiceDraft` shape. */
export interface EinvoiceDraft {
    /** `xml` (deterministic) or `pdf` (LLM extraction). */
    readonly source: "xml" | "pdf"
    /** Mau so, the template (KHMSHDon). */
    readonly template: string
    /** Ky hieu, the series (KHHDon). */
    readonly series: string
    /** So hoa don, the number (SHDon). */
    readonly invoiceNo: string
    /** Ngay lap, the issue date, `YYYY-MM-DD`. */
    readonly issuedOn: string
    /** Seller name. */
    readonly sellerName: string
    /** Seller tax code. */
    readonly sellerTaxCode: string
    /** Buyer name. */
    readonly buyerName: string
    /** Buyer tax code. */
    readonly buyerTaxCode: string
    /** The lines. */
    readonly lines: ReadonlyArray<EinvoiceLine>
    /** Total before VAT (TgTCThue). */
    readonly subtotalVnd: number
    /** VAT total (TgTThue). */
    readonly vatVnd: number
    /** Grand total (TgTTTBSo). */
    readonly totalVnd: number
}

/** An e-invoice, or null when the text is not a TT78 invoice. */
export type OptionalEinvoiceDraft = EinvoiceDraft | null

/** A number written in the XML (dot decimal); 0 when blank or not a number. */
export const amountOf = (value: string): number => {
    const parsed = Number(value.trim())
    return value.trim() === "" || Number.isNaN(parsed) ? 0 : parsed
}

/**
 * A VAT rate as TT78 writes it (`TSuat`): `10%`, `8%`, `5%`, `0%`, `KHAC:3.5%` -> the percent; `KCT` (not subject) and
 * `KKKNT` (not declared) -> null. An unreadable value answers NaN so the checks flag it.
 */
export const vatRateOf = (value: string): number | null => {
    const trimmed = value.trim().toUpperCase()
    if (trimmed === "KCT" || trimmed === "KKKNT" || trimmed === "") return null
    const match = /^(?:KHAC:)?(\d+(?:\.\d+)?)%$/u.exec(trimmed)
    return match?.[1] === undefined ? Number.NaN : Number(match[1])
}

const lineOf = (node: XmlNode): EinvoiceLine => ({
    name: textAt(node, "THHDVu"),
    quantity: amountOf(textAt(node, "SLuong")),
    amountVnd: amountOf(textAt(node, "ThTien")),
    vatRate: vatRateOf(textAt(node, "TSuat")),
})

/**
 * Reads an e-invoice XML of Circular 78/2021/TT-BTC (Decision 1450/QD-TCT layout: `HDon/DLHDon/{TTChung, NDHDon, ...}`),
 * wrapped in a tax-authority message or not. Answers null when the document is not well-formed XML or has no `HDon`.
 */
export const parseEinvoiceXml = (xml: string): OptionalEinvoiceDraft => {
    const tree = parseXml(xml)
    const invoice = tree === null ? null : findFirst(tree, "HDon")
    if (invoice === null) return null
    const general = findFirst(invoice, "TTChung")
    const content = findFirst(invoice, "NDHDon")
    const seller = content === null ? null : findFirst(content, "NBan")
    const buyer = content === null ? null : findFirst(content, "NMua")
    const items = content === null ? null : findFirst(content, "DSHHDVu")
    const totals = content === null ? null : findFirst(content, "TToan")
    return {
        source: "xml",
        template: textAt(general, "KHMSHDon"),
        series: textAt(general, "KHHDon"),
        invoiceNo: textAt(general, "SHDon"),
        issuedOn: textAt(general, "NLap").slice(0, 10),
        sellerName: textAt(seller, "Ten"),
        sellerTaxCode: textAt(seller, "MST"),
        buyerName: textAt(buyer, "Ten"),
        buyerTaxCode: textAt(buyer, "MST"),
        lines: childrenNamed(items, "HHDVu").map(lineOf),
        subtotalVnd: amountOf(textAt(totals, "TgTCThue")),
        vatVnd: amountOf(textAt(totals, "TgTThue")),
        totalVnd: amountOf(textAt(totals, "TgTTTBSo")),
    }
}
