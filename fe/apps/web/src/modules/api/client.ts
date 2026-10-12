import { API_TIMEOUT_MS, apiUrl } from "@/modules/config"
import type { ApiFault, Outcome } from "./outcome"

/** HTTP methods the back end api serves to the web app. */
type ApiMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE"

/** One request to the back end api. */
export interface ApiRequest {
    readonly path: string
    /** The signed-in user's access token; the api verifies it, the web app never holds a service key. */
    readonly token: string
    /** The reader's locale, sent as the request language so the api answers in the language of the page. */
    readonly locale: string
    /** The workspace the caller acts in, sent as X-Workspace-Id. */
    readonly workspaceId?: string
    readonly method?: ApiMethod
    /** A JSON body; omitted for reads. */
    readonly body?: unknown
    /** Query-string pairs; undefined values are dropped. */
    readonly query?: Readonly<Record<string, string | number | boolean | undefined>>
}

const withQuery = (path: string, query: ApiRequest["query"]): string => {
    if (query === undefined) return path
    const pairs = Object.entries(query).flatMap(([name, value]): string[][] =>
        value === undefined ? [] : [[name, String(value)]],
    )
    return pairs.length === 0 ? path : `${path}?${new URLSearchParams(pairs).toString()}`
}

const faultOf = (status: number, body: unknown): ApiFault => {
    const entries = typeof body === "object" && body !== null ? Object.entries(body) : []
    const field = (name: string): string | undefined => {
        const value = entries.find(([key]) => key === name)?.[1]
        return typeof value === "string" ? value : undefined
    }
    const message = field("message")
    return { code: field("code") ?? String(status), ...(message === undefined ? {} : { message }) }
}

const outcomeOfStatus = (status: number, body: unknown): Outcome<never> => {
    const fault = faultOf(status, body)
    if (status === 401 || status === 403) return { kind: "refused", status, fault }
    if (status === 404) return { kind: "not-found", fault }
    if (status === 400 || status === 409 || status === 422) return { kind: "invalid", issues: [], fault }
    return { kind: "unavailable", fault, retryable: status >= 500 }
}

/** The failure body the back end answers (`{ code, kind, message, params }`); an unreadable body yields no fields. */
const failureBodyOf = async (response: Response): Promise<unknown> => {
    const text = await response.text()
    try {
        return JSON.parse(text)
    } catch {
        return text
    }
}

/**
 * The one `fetch` of the web app. A reader or a client hook passes the decoder of its response text (empty for a 204), so the shape is
 * checked where it enters instead of being asserted; the token is an argument and never kept here.
 */
export const request = async <T>(
    input: ApiRequest,
    decode: (body: string) => Outcome<T>,
    signal?: AbortSignal,
): Promise<Outcome<T>> => {
    const timeout = AbortSignal.timeout(API_TIMEOUT_MS)
    try {
        const response = await fetch(`${apiUrl()}${withQuery(input.path, input.query)}`, {
            method: input.method ?? "GET",
            cache: "no-store",
            signal: signal === undefined ? timeout : AbortSignal.any([signal, timeout]),
            headers: {
                "accept-language": input.locale,
                ...(input.workspaceId === undefined ? {} : { "x-workspace-id": input.workspaceId }),
                authorization: `Bearer ${input.token}`,
                ...(input.body === undefined ? {} : { "content-type": "application/json" }),
            },
            ...(input.body === undefined ? {} : { body: JSON.stringify(input.body) }),
        })
        if (!response.ok) return outcomeOfStatus(response.status, await failureBodyOf(response))
        return decode(await response.text())
    } catch {
        return { kind: "unavailable", fault: { code: "transport" }, retryable: true }
    }
}
