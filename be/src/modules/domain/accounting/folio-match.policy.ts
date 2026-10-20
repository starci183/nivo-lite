import type { FolioMatch, FolioSnapshot, OptionalTransferCode } from "./accounting-gateway.port"

/** The transfer memo HAKUEN prints on a folio (`transferRef`, hakuen-mcp@1): `HAKUEN` and six letters or digits. */
const TRANSFER_CODE = /\bHAKUEN\s?([A-Z\d]{6})\b/u

/** The folio transfer memo a bank transfer content carries, normalized to `HAKUEN XXXXXX`, or null. */
export const transferCodeOf = (content: string): OptionalTransferCode => {
    const code = TRANSFER_CODE.exec(content.toUpperCase())?.[1]
    return code === undefined ? null : `HAKUEN ${code}`
}

/**
 * How a bank credit stands against a folio: `exact` when it pays the balance due, `partial` below it, `over` above it,
 * `settled` when nothing is due. Only `exact` is recorded without a person (`folio.recordPayment` asks when the amounts differ).
 */
export const matchFolio = (folio: FolioSnapshot, amountVnd: number): FolioMatch => {
    if (folio.balanceVnd <= 0) return "settled"
    if (amountVnd === folio.balanceVnd) return "exact"
    return amountVnd < folio.balanceVnd ? "partial" : "over"
}
