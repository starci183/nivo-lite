import "server-only"
import { getLocale } from "next-intl/server"
import { readAccessToken } from "@/modules/session"
import { request } from "./client"
import type { Outcome } from "./outcome"

/** HTTP methods a server action or reader uses. */
type ApiMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE"

/** What a privileged call to the back end names beyond its path. */
export interface ApiCall {
    readonly method?: ApiMethod
    readonly body?: unknown
    /** The workspace the caller acts in, sent as X-Workspace-Id; the back end proves the membership. */
    readonly workspaceId?: string
}

const parseJson = <T>(text: string): Outcome<T> => {
    try {
        return { kind: "ok", value: JSON.parse(text === "" ? "null" : text) }
    } catch {
        return { kind: "unavailable", fault: { code: "body" }, retryable: false }
    }
}

/**
 * The server-only call to the back end with the signed-in user's bearer, the request language and the workspace. A signed-out
 * visitor gets `refused` without a request. Failures carry the back end's `fault.code`.
 */
export const apiRequest = async <T>(path: string, call: ApiCall = {}): Promise<Outcome<T>> => {
    const token = await readAccessToken()
    if (token === null) return { kind: "refused", status: 401, fault: { code: "no-session" } }
    return request<T>(
        {
            path,
            token,
            locale: await getLocale(),
            ...(call.method === undefined ? {} : { method: call.method }),
            ...(call.body === undefined ? {} : { body: call.body }),
            ...(call.workspaceId === undefined ? {} : { workspaceId: call.workspaceId }),
        },
        parseJson<T>,
    )
}
