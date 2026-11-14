import { createHmac } from "node:crypto"
import { Injectable } from "@nestjs/common"
import { cutDetail, statusClassOf } from "@modules/integrations/provider-http"
import { InjectHttpClient, type HttpClient, type HttpRequest, type HttpResponse } from "@modules/platform/http"
import { fieldNumberOf, isRecord } from "@modules/platform/primitives"
import { PayosError, PayosErrorCode } from "./errors/payos.error"
import type { PayosCall, PayosCreated, PayosCredential, PayosData, PayosInfo } from "./payos.contracts"
import { InjectPayosOptions } from "./payos.decorators"
import { PAYOS_OPS, type PayosOperation } from "./payos.operations"
import type { PayosOptions } from "./payos.options"

/** The result code payOS gives a success (https://payos.vn/docs/api/ : `code: "00"`, `desc: "success"`). */
const SUCCESS_CODE = "00"

/** The members the create signature covers, in the order the docs list them: https://payos.vn/docs/api/ (`amount=$amount&cancelUrl=$cancelUrl&description=$description&orderCode=$orderCode&returnUrl=$returnUrl`). */
const CREATE_SIGNED = ["amount", "cancelUrl", "description", "orderCode", "returnUrl"] as const

/** A member as the signature page's samples print it: a null or undefined member is an empty value. */
const signedText = (value: unknown): string => {
    if (value === null || value === undefined) return ""
    return typeof value === "string" ? value : JSON.stringify(value)
}

/**
 * The signature of `data`: HMAC-SHA256, hex, under the channel's checksum key, over the members sorted by key as `key=value` joined with
 * `&` (https://payos.vn/docs/tich-hop-webhook/kiem-tra-du-lieu-voi-signature/ , which gives a test vector the spec proves it against).
 * A nested array would be JSON text with its object keys sorted; no operation NIVO signs carries one.
 */
export const payosSignatureOf = (data: Readonly<Record<string, unknown>>, checksumKey: string): string =>
    createHmac("sha256", checksumKey)
        .update(
            Object.keys(data)
                .sort((left, right) => (left < right ? -1 : Number(left > right)))
                .map((name) => `${name}=${signedText(data[name])}`)
                .join("&"),
        )
        .digest("hex")

/** The path of an operation with its parameters put in, each encoded. */
const pathOf = (operation: PayosOperation, values: Readonly<Record<string, string>>): string =>
    operation.path.replaceAll(/\{([A-Za-z]+)\}/gu, (_whole, name: string) => {
        const value = values[name]
        if (value === undefined) throw new PayosError({ code: PayosErrorCode.Rejected, params: { reason: `missing path ${name}` } })
        return encodeURIComponent(value)
    })

/** The body of a create: the members the caller gave and the signature over the five documented ones. */
const signedCreateBody = (body: PayosData, checksumKey: string): PayosData => {
    const signed: Record<string, unknown> = {}
    for (const name of CREATE_SIGNED) signed[name] = body[name]
    return { ...body, signature: payosSignatureOf(signed, checksumKey) }
}

/**
 * The request of one operation, built purely: the base and the operation's path, the keys in `x-client-id` / `x-api-key` (the API
 * reference's security scheme) and the JSON body of a POST (a create body gets its `signature`).
 */
export const payosRequestOf = (options: PayosOptions, credential: PayosCredential, operation: PayosOperation, call: PayosCall): HttpRequest => {
    const url = `${options.apiBase}${pathOf(operation, call.path ?? {})}`
    const headers = { "x-client-id": credential.clientId, "x-api-key": credential.apiKey }
    if (operation.method !== "POST") return { method: operation.method, url, headers, timeoutMs: options.timeoutMs }
    const body = call.body ?? {}
    return {
        method: "POST",
        url,
        headers,
        body: operation === PAYOS_OPS.createLink ? signedCreateBody(body, credential.checksumKey) : body,
        timeoutMs: options.timeoutMs,
    }
}

/** What payOS said of a refusal: its `code` and `desc` of the answer's wrapper, cut, or the status when it said none. */
const reasonOf = (answer: HttpResponse): string => {
    const body = isRecord(answer.body) ? answer.body : {}
    const code = typeof body.code === "string" ? body.code : String(answer.status)
    const desc = cutDetail(body.desc)
    return desc === null ? code : `${code}: ${desc}`
}

/**
 * The `data` of an answer, or the typed failure. The class of a status comes from its number alone (429 slow down, 401 / 403 the keys,
 * 404 no such link, another 4xx refused as asked, 5xx and an unreadable body not known); a 2xx whose `code` is not "00" is a refusal. The
 * docs list their sample errors with no numeric codes and file them all under 401, so payOS's own `code` and `desc` ride in the params for a
 * person to read; nothing here decides by those words.
 */
export const payosDataOf = (answer: HttpResponse): PayosData => {
    const kind = statusClassOf(answer.status)
    if (kind === "rate_limited") throw new PayosError({ code: PayosErrorCode.RateLimited })
    if (kind === "auth") throw new PayosError({ code: PayosErrorCode.AuthFailed, params: { reason: reasonOf(answer) } })
    if (kind === "not_found") throw new PayosError({ code: PayosErrorCode.NotFound })
    if (kind === "rejected") throw new PayosError({ code: PayosErrorCode.Rejected, params: { reason: reasonOf(answer) } })
    if (kind !== "ok" || !isRecord(answer.body)) throw new PayosError({ code: PayosErrorCode.Failed, params: { reason: String(answer.status) } })
    if (answer.body.code !== SUCCESS_CODE) throw new PayosError({ code: PayosErrorCode.Rejected, params: { reason: reasonOf(answer) } })
    if (!isRecord(answer.body.data)) throw new PayosError({ code: PayosErrorCode.Failed, params: { reason: "no data" } })
    return answer.body.data
}

/** The answer could not be read as the documentation publishes it. */
const unreadable = (what: string): never => {
    throw new PayosError({ code: PayosErrorCode.Failed, params: { reason: `unreadable ${what}` } })
}

/** A member as text, or null. */
const textOf = (value: unknown): string | null => (typeof value === "string" && value.trim() !== "" ? value.trim() : null)

/** A member as a number, or null. */
const numberOf = (value: unknown): number | null => fieldNumberOf(value) ?? null

/** A member that must be an integer (an order code, an amount in dong). */
const integerOf = (value: unknown, what: string): number => {
    const number = numberOf(value)
    return number !== null && Number.isSafeInteger(number) ? number : unreadable(what)
}

/** A member that must be text. */
const requiredText = (value: unknown, what: string): string => textOf(value) ?? unreadable(what)

/** The `data` of a create (https://payos.vn/docs/api/ : `paymentLinkId`, `orderCode`, `checkoutUrl`, `qrCode`, `amount`, `description`, `status`). */
export const payosCreatedOf = (data: PayosData): PayosCreated => ({
    paymentLinkId: requiredText(data.paymentLinkId, "paymentLinkId"),
    orderCode: integerOf(data.orderCode, "orderCode"),
    checkoutUrl: requiredText(data.checkoutUrl, "checkoutUrl"),
    qrCode: textOf(data.qrCode),
    amount: integerOf(data.amount, "amount"),
    description: typeof data.description === "string" ? data.description : "",
    status: requiredText(data.status, "status"),
})

/** The `data` of a get or a cancel (`id`, `orderCode`, `amount`, `amountPaid`, `amountRemaining`, `status`, `createdAt`, and for a cancel `canceledAt`, `cancellationReason`). */
export const payosInfoOf = (data: PayosData): PayosInfo => ({
    id: requiredText(data.id, "id"),
    orderCode: integerOf(data.orderCode, "orderCode"),
    amount: integerOf(data.amount, "amount"),
    amountPaid: numberOf(data.amountPaid),
    amountRemaining: numberOf(data.amountRemaining),
    status: requiredText(data.status, "status"),
    createdAt: textOf(data.createdAt),
    canceledAt: textOf(data.canceledAt),
    cancellationReason: textOf(data.cancellationReason),
})

/** The `data` of a cancel: the same members as a get, with `canceledAt` and `cancellationReason` filled. */
export const payosCancelledOf = (data: PayosData): PayosInfo => payosInfoOf(data)

@Injectable()
/** The one place that talks to payOS's payment API. The three keys are always explicit (those of one connection) and never logged. */
export class PayosClient {
    constructor(
        @InjectHttpClient() private readonly http: HttpClient,
        @InjectPayosOptions() private readonly options: PayosOptions,
    ) {}

    /** Runs one operation and answers its `data`; a refusal or a failure is a `PayosError` saying where it failed. */
    async call(credential: PayosCredential, operation: PayosOperation, call: PayosCall): Promise<PayosData> {
        const request = payosRequestOf(this.options, credential, operation, call)
        const answer = await this.http.request(request).catch((cause: unknown) => {
            throw new PayosError({ code: PayosErrorCode.Unreachable, cause })
        })
        return payosDataOf(answer)
    }
}
