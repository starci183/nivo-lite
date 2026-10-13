"use server"
import "server-only"

import { apiRequest } from "../request"
import type { Outcome } from "../outcome"

/** The Zalo permission page a started authorization sends the owner to, and the address Zalo returns the browser to. */
export interface ZaloAuthorizationWire {
    readonly url: string
    readonly callbackUrl: string
}

/** The connection a completed authorization belongs to. */
export interface ZaloConnectionWire {
    readonly connectionId: string
}

/** Starts the Zalo authorization of a connection; the back end proves the caller is an owner or manager of the workspace. */
export const writeZaloAuthorization = async (workspaceId: string, connectionId: string): Promise<Outcome<ZaloAuthorizationWire>> =>
    apiRequest<ZaloAuthorizationWire>(`/channels/zalo/${connectionId}/authorize`, { method: "POST", workspaceId })

/** Finishes the Zalo authorization with what Zalo returned the browser with; the back end checks the one-time state. */
export const writeZaloAuthorizationReturn = async (
    workspaceId: string,
    zaloReturn: { readonly state: string; readonly code: string; readonly oaId?: string },
): Promise<Outcome<ZaloConnectionWire>> =>
    apiRequest<ZaloConnectionWire>("/channels/zalo/authorize/complete", { method: "POST", body: zaloReturn, workspaceId })
