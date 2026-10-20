/** One line of an e-invoice. */
export interface EinvoiceLine {
    readonly name: string
    readonly qty: number
    readonly unitPriceVnd: number
    readonly vatRate: string
    readonly amountVnd: number
}

/** A Vietnamese e-invoice (Circular 78/2021, TT78) read from its XML. */
export interface Einvoice {
    readonly number: string
    readonly series: string
    readonly issuedOn: string
    readonly seller: { readonly taxCode: string; readonly name: string }
    readonly buyer: { readonly taxCode: string; readonly name: string }
    readonly lines: ReadonlyArray<EinvoiceLine>
    readonly totalVnd: number
    readonly vatVnd: number
}

const decode = (text: string): string =>
    text
        .replaceAll("&lt;", "<")
        .replaceAll("&gt;", ">")
        .replaceAll("&quot;", '"')
        .replaceAll("&apos;", "'")
        .replaceAll("&amp;", "&")
        .trim()

/** The text of the first `<tag>` inside a fragment, or empty. */
const tagText = (xml: string, tag: string): string => {
    const match = new RegExp(`<${tag}(?:\\s[^>]*)?>([^<]*)</${tag}>`, "u").exec(xml)
    return match?.[1] === undefined ? "" : decode(match[1])
}

/** The inner fragment of the first `<tag>…</tag>`, or empty. */
const block = (xml: string, tag: string): string => {
    const match = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, "u").exec(xml)
    return match?.[1] ?? ""
}

/** Every inner fragment of `<tag>…</tag>`. */
const blocks = (xml: string, tag: string): ReadonlyArray<string> =>
    [...xml.matchAll(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, "gu"))].map((match) => match[1] ?? "")

const amount = (text: string): number => {
    const number = Number(text.replaceAll(",", ""))
    return Number.isFinite(number) ? Math.round(number) : 0
}

/**
 * Reads a TT78 e-invoice deterministically (no model): number `SHDon`, series `KHHDon`, date `NLap`, seller `NBan` and buyer `NMua`
 * (`Ten`, `MST`), lines `HHDVu` (`THHDVu`, `SLuong`, `DGia`, `TSuat`, `ThTien`), totals `TgTTTBSo` and `TgTThue`. Null when the text
 * is not a TT78 invoice (no `HDon`/`DLHDon` root or no number).
 */
export const parseEinvoiceXml = (xml: string): Einvoice | null => {
    const data = block(xml, "DLHDon")
    if (data === "") return null
    const general = block(data, "TTChung")
    const number = tagText(general, "SHDon")
    if (number === "") return null
    const content = block(data, "NDHDon")
    const seller = block(content, "NBan")
    const buyer = block(content, "NMua")
    const totals = block(content, "TToan")
    return {
        number,
        series: tagText(general, "KHHDon"),
        issuedOn: tagText(general, "NLap"),
        seller: { taxCode: tagText(seller, "MST"), name: tagText(seller, "Ten") },
        buyer: { taxCode: tagText(buyer, "MST"), name: tagText(buyer, "Ten") },
        lines: blocks(block(content, "DSHHDVu"), "HHDVu").map((line) => ({
            name: tagText(line, "THHDVu"),
            qty: Number(tagText(line, "SLuong")) || 0,
            unitPriceVnd: amount(tagText(line, "DGia")),
            vatRate: tagText(line, "TSuat"),
            amountVnd: amount(tagText(line, "ThTien")),
        })),
        totalVnd: amount(tagText(totals, "TgTTTBSo")),
        vatVnd: amount(tagText(totals, "TgTThue")),
    }
}
