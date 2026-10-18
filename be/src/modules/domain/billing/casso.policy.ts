import { createHmac } from "node:crypto"
import { sameText } from "./channel-secret.policy"

/** One Casso transaction as the webhook carries it; Casso names the id `id`, `tid` or `reference` depending on the version. */
interface CassoTransaction {
    readonly id?: number | string
    readonly tid?: string
    readonly reference?: string
    readonly description?: string
    readonly amount?: number | string
    readonly bankName?: string
}

/** What the door proves: the signature header (V2) or the legacy secure token (V1), and the integration's secret key. */
export interface CassoProof {
    /** The parsed JSON body. */
    readonly body: Readonly<Record<string, unknown>>
    /** The `X-Casso-Signature` header (`t=<ms>,v1=<hex>`), when sent. */
    readonly signature: string | undefined
    /** The `secure-token` header of webhook V1, when sent. */
    readonly secureToken: string | undefined
    /** The integration's secret key ("Key bao mat"). */
    readonly key: string
}

/** One credit a Casso delivery announces. */
export interface CassoCredit {
    /** The credited amount in VND, always positive. */
    readonly amount: number
    /** The transfer content. */
    readonly content: string
    /** The stored inbound event id: `casso:<Casso transaction id>`. */
    readonly eventId: string
    /** The bank the credit came through, or Casso itself. */
    readonly bankName: string
}

const SIGNATURE_HEADER = /t=(\d+),\s*v1=([a-f0-9]+)/i

// Arrays count as nested objects too, exactly as in Casso's sample.
const isNested = (value: unknown): value is Readonly<Record<string, unknown>> =>
    typeof value === "object" && value !== null

// Same as Casso's published sample (CassoHQ/casso-webhook-v2-verify-signature): keys sorted A-Z at every level.
const sortKeys = (data: Readonly<Record<string, unknown>>): Record<string, unknown> => {
    const sorted: Record<string, unknown> = {}
    for (const name of Object.keys(data).sort((left, right) => (left < right ? -1 : Number(left > right)))) {
        const value = data[name]
        sorted[name] = isNested(value) ? sortKeys(value) : value
    }
    return sorted
}

/** HMAC-SHA512 (hex) of `<t>.<body with keys sorted>` with the integration's key: Casso webhook V2. */
export const cassoSignature = (body: Readonly<Record<string, unknown>>, timestamp: string, key: string): string =>
    createHmac("sha512", key)
        .update(`${timestamp}.${JSON.stringify(sortKeys(body))}`)
        .digest("hex")

/**
 * True when the delivery proves the integration's key: a V2 signature over the sorted body, or, only when no V2 signature header
 * is present, the V1 `secure-token` equal to the key. Both compare in constant time. An empty key proves nothing.
 */
export const isCassoAuthentic = (proof: CassoProof): boolean => {
    if (!proof.key) return false
    const matched = SIGNATURE_HEADER.exec(proof.signature ?? "")
    if (matched) return sameText(cassoSignature(proof.body, `${matched[1]}`, proof.key), `${matched[2]}`.toLowerCase())
    return proof.secureToken !== undefined && proof.secureToken !== "" && sameText(proof.secureToken, proof.key)
}

/** True when Casso reports an error for this delivery (`error` other than 0): acknowledged and ignored. */
export const isCassoError = (body: Readonly<Record<string, unknown>>): boolean => Number(body.error ?? 0) !== 0

/** The credits of a delivery: positive amounts with an id; V1 sends an array in `data`, V2 one object. */
export const cassoCredits = (body: Readonly<Record<string, unknown>>): Array<CassoCredit> => {
    const rows = (Array.isArray(body.data) ? body.data : [body.data]).filter(
        (row): row is CassoTransaction => typeof row === "object" && row !== null,
    )
    return rows.flatMap((row) => {
        const amount = Number(row.amount ?? 0)
        const id = row.id ?? row.tid ?? row.reference
        if (!Number.isFinite(amount) || amount <= 0 || id === undefined || id === "") return []
        return [
            {
                amount,
                content: (row.description ?? "").trim(),
                eventId: `casso:${id}`,
                bankName: row.bankName ?? "Casso",
            },
        ]
    })
}
