import { API_TIMEOUT_MS, apiUrl } from "@/modules/config"
import type { Outcome } from "./outcome"

/** HTTP methods the back end api serves to the web app. */
type ApiMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE"

/** One request to the back end api. */
export interface ApiRequest {
    readonly path: string
    /** The signed-in user's access token; the api verifies it, the web app never holds a service key. */
    readonly token: string
    /** The reader's locale, sent as the request language so the api answers in the language of the page. */
    readonly locale: string
    /** The workspace the call acts in, sent as X-Workspace-Id; the back end proves the caller membership in it. */
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

const outcomeOfStatus = (status: number): Outcome<never> => {
    if (status === 401 || status === 403) return { kind: "refused", status, code: String(status) }
    if (status === 404) return { kind: "not-found" }
    if (status === 400 || status === 409 || status === 422) return { kind: "invalid", issues: [] }
    return { kind: "unavailable", code: String(status), retryable: status >= 500 }
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
                authorization: `Bearer ${input.token}`,
                ...(input.workspaceId === undefined ? {} : { "x-workspace-id": input.workspaceId }),
                ...(input.body === undefined ? {} : { "content-type": "application/json" }),
            },
            ...(input.body === undefined ? {} : { body: JSON.stringify(input.body) }),
        })
        if (response.status === 401 || response.status === 403) return outcomeOfStatus(response.status)
        if (!response.ok) return outcomeOfStatus(response.status)
        return decode(await response.text())
    } catch {
        return { kind: "unavailable", code: "transport", retryable: true }
    }
}
