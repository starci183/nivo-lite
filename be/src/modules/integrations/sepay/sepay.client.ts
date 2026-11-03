import { Injectable } from "@nestjs/common"
import { InjectHttpClient } from "@modules/platform/http"
import type { HttpClient } from "@modules/platform/http"
import { isRecord } from "@modules/platform/primitives"
import { SepayError, SepayErrorCode } from "./errors/sepay.error"
import type { SepayTransaction, SepayTransactionsQuery } from "./sepay.contracts"
import { InjectSepayOptions } from "./sepay.decorators"
import type { SepayOptions } from "./sepay.options"

/** SePay prints times in Vietnam time (UTC+7, no daylight saving). */
const VIETNAM_OFFSET_MS = 7 * 3_600_000

/** The status SePay answers when the caller must slow down. */
const TOO_MANY_REQUESTS = 429

/** A date as the list filters read it: `YYYY-MM-DD HH:mm:ss` in Vietnam time. */
export const toSepayTime = (at: Date): string =>
    new Date(at.getTime() + VIETNAM_OFFSET_MS).toISOString().slice(0, 19).replace("T", " ")

const UNAUTHORIZED = 401
const FORBIDDEN = 403

/** The seconds SePay asked the caller to wait (`Retry-After` as a number of seconds), or 0 when it named none. */
const retryAfterOf = (header: string | undefined): number => {
    const seconds = Number(header)
    return Number.isFinite(seconds) && seconds > 0 ? Math.ceil(seconds) : 0
}

const textOf = (value: unknown): string | null => {
    if (typeof value === "number" && Number.isFinite(value)) return String(value)
    return typeof value === "string" && value.trim() !== "" ? value.trim() : null
}

const amountOf = (value: unknown): number => {
    const amount = Number(textOf(value) ?? "0")
    return Number.isFinite(amount) && amount > 0 ? amount : 0
}

const malformed = (): never => {
    throw new SepayError({ code: SepayErrorCode.Rejected, params: { reason: "malformed transaction" } })
}

/** Reads one listed row; a row without an id or a readable time is refused, never skipped, so no transfer is lost silently. */
const transactionOf = (row: unknown): SepayTransaction => {
    if (!isRecord(row)) return malformed()
    const id = textOf(row.id)
    const time = textOf(row.transaction_date)
    const occurredAt = time === null ? undefined : new Date(`${time.replace(" ", "T")}+07:00`)
    if (id === null || occurredAt === undefined || Number.isNaN(occurredAt.getTime())) return malformed()
    return {
        id,
        occurredAt,
        amountIn: amountOf(row.amount_in),
        amountOut: amountOf(row.amount_out),
        content: textOf(row.transaction_content) ?? "",
        code: textOf(row.code),
        bank: textOf(row.bank_brand_name),
    }
}

@Injectable()
/** The one place that talks to the SePay user API. The API token is always explicit (the token of one connection) and never logged. */
export class SepayClient {
    constructor(
        @InjectHttpClient() private readonly http: HttpClient,
        @InjectSepayOptions() private readonly options: SepayOptions,
    ) {}

    /** Lists the transactions of one bank account, newest first; a refusal, a rate limit or a network failure is a SepayError. */
    async listTransactions(token: string, query: SepayTransactionsQuery): Promise<ReadonlyArray<SepayTransaction>> {
        const search = new URLSearchParams({
            account_number: query.accountNumber,
            transaction_date_min: toSepayTime(query.from),
            limit: String(query.limit),
        })
        if (query.to !== undefined) search.set("transaction_date_max", toSepayTime(query.to))
        const answer = await this.http
            .request({
                method: "GET",
                url: `${this.options.apiBase}/userapi/transactions/list?${search.toString()}`,
                headers: { Authorization: `Bearer ${token}` },
                timeoutMs: this.options.timeoutMs,
            })
            .catch((cause: unknown) => {
                throw new SepayError({ code: SepayErrorCode.Unavailable, cause })
            })
        if (answer.status === TOO_MANY_REQUESTS) {
            throw new SepayError({
                code: SepayErrorCode.RateLimited,
                params: { retryAfterSeconds: retryAfterOf(answer.headers?.["retry-after"]) },
            })
        }
        if (answer.status === UNAUTHORIZED || answer.status === FORBIDDEN) {
            throw new SepayError({ code: SepayErrorCode.AuthFailed, params: { reason: String(answer.status) } })
        }
        if (answer.status < 200 || answer.status >= 300) {
            throw new SepayError({
                code:
                    answer.status >= 400 && answer.status < 500 ? SepayErrorCode.Rejected : SepayErrorCode.Unavailable,
                params: { reason: String(answer.status) },
            })
        }
        if (!isRecord(answer.body) || !Array.isArray(answer.body.transactions)) {
            throw new SepayError({ code: SepayErrorCode.Unavailable })
        }
        return answer.body.transactions.map(transactionOf)
    }
}
