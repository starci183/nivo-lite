import "server-only"

import { apiUrl } from "@/modules/config"
import { createServerDbClient } from "@/modules/db/server"
import { dbFailure, dbOk } from "@/modules/db/outcome"
import type { DbFailureKind, DbOutcome } from "@/modules/db/outcome"

/** HTTP methods the back end api serves to the web app. */
type ApiMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE"

/** One request to the back end api. */
export interface ApiRequest {
    readonly method?: ApiMethod
    /** A JSON body; omitted for reads. */
    readonly body?: unknown
    /** Query-string pairs; undefined values are dropped. */
    readonly query?: Readonly<Record<string, string | number | boolean | undefined>>
    /** Extra headers such as the active workspace. */
    readonly headers?: Readonly<Record<string, string>>
}

const kindOfStatus = (status: number): DbFailureKind => {
    if (status === 401 || status === 403) return "refused"
    if (status === 404) return "not-found"
    if (status === 400 || status === 409 || status === 422) return "invalid"
    return "unavailable"
}

const withQuery = (path: string, query: ApiRequest["query"]): string => {
    if (query === undefined) return path
    const pairs = Object.entries(query).flatMap(([name, value]): string[][] =>
        value === undefined ? [] : [[name, String(value)]],
    )
    return pairs.length === 0 ? path : `${path}?${new URLSearchParams(pairs).toString()}`
}

const readBody = async <T>(response: Response): Promise<DbOutcome<T>> => {
    if (response.status === 204) return dbOk(undefined as T)
    try {
        return dbOk((await response.json()) as T)
    } catch {
        return dbFailure("unavailable", "body")
    }
}

/** Calls the back end api with the signed-in user's access token; the api verifies it, the web app never holds a service key. */
export const apiRequest = async <T>(path: string, request: ApiRequest = {}): Promise<DbOutcome<T>> => {
    const client = await createServerDbClient()
    const session = await client.auth.getSession()
    const token = session.data.session?.access_token
    if (token === undefined) return dbFailure("refused", "no-session")
    try {
        const response = await fetch(`${apiUrl()}${withQuery(path, request.query)}`, {
            method: request.method ?? "GET",
            cache: "no-store",
            headers: {
                ...request.headers,
                authorization: `Bearer ${token}`,
                ...(request.body === undefined ? {} : { "content-type": "application/json" }),
            },
            ...(request.body === undefined ? {} : { body: JSON.stringify(request.body) }),
        })
        if (!response.ok) return dbFailure(kindOfStatus(response.status), String(response.status))
        return await readBody<T>(response)
    } catch {
        return dbFailure("unavailable", "transport")
    }
}
