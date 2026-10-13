import "server-only"

import { dbFailure, dbOk } from "../outcome"
import type { DbOutcome } from "../outcome"
import { readZaloWizard } from "../channels/read-zalo-wizard"
import type { ConnectionStatus, ZaloWizardConnection } from "@/modules/types"

/** How long a step waits for the back end to answer before the owner is asked to try again. */
export const WIZARD_WAIT_MS = 15_000

const trimSlashes = (value: string): string => value.replace(/\/+$/u, "")

/** The address providers call: the api origin when the site knows it, else the site itself (the same site in a local setup). */
const providerOrigin = (): string =>
    trimSlashes(process.env.NEXT_PUBLIC_API_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3100")

/** The address Zalo sends the browser back to after the OA permissions: a page of the site. */
const siteCallback = (): string =>
    `${trimSlashes(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3100")}/connections/zalo/callback`

const statusOf = (status: string): ConnectionStatus =>
    status === "pending" || status === "error" || status === "disconnected" ? status : "connected"

/** The wizard view of a Zalo connection, read under RLS from the public facts of its row. */
export const zaloViewOf = async (connectionId: string): Promise<DbOutcome<ZaloWizardConnection>> => {
    const state = await readZaloWizard(connectionId)
    if (state.kind !== "ok") return state
    const value = state.value
    return dbOk({
        id: value.id,
        name: value.name,
        status: statusOf(value.status),
        webhookUrl: `${providerOrigin()}/api/connections/zalo/${value.id}`,
        callbackUrl: siteCallback(),
        authorized: value.authorized,
        oaSecretSaved: value.oaSecretSaved,
        oaId: value.oaId,
        firstEvent: value.firstEvent,
        agentIds: value.agentIds,
    })
}

/** A step the back end did not finish: the code the wizard shows the generic sentence for. */
export const stepFailed = (code: string): ReturnType<typeof dbFailure> => dbFailure("unavailable", code)
