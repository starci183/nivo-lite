import "server-only"

import { dbFailure, dbOk, toOutcome } from "../outcome"
import type { DbOutcome } from "../outcome"
import { createServerDbClient } from "../server"

/** The most agents one connection is bound to that the wizard reads. */
const AGENT_LIMIT = 100
/** How long the reader waits between two looks at the connection row. */
const WAIT_STEP_MS = 400

/** The first event a connection received, as the wizard shows it. */
export interface ZaloFirstEvent {
    readonly amount: number
    readonly content: string
    readonly at: string
}

/** The result the back end wrote next to a wizard ticket. */
export interface ZaloWizardResult {
    readonly ticket: string
    readonly command: string
    /** queued while the back end has not answered yet, then done or failed. */
    readonly state: string
    /** The Zalo permission page, for the begin command. */
    readonly url: string
    /** The code of the refusal, when the step failed. */
    readonly code: string
}

/** One Zalo connection as the wizard reads it, from the public facts of its row. */
export interface ZaloWizardState {
    readonly id: string
    readonly name: string
    readonly status: string
    /** The OA has been authorized: the back end holds tokens. */
    readonly authorized: boolean
    /** The OA Secret Key was sealed by the back end. */
    readonly oaSecretSaved: boolean
    readonly oaId: string
    readonly firstEvent: ZaloFirstEvent | null
    readonly agentIds: ReadonlyArray<string>
    readonly wizard: ZaloWizardResult | null
}

const recordOf = (value: unknown): { [name: string]: unknown } =>
    typeof value === "object" && value !== null && !Array.isArray(value)
        ? Object.fromEntries(Object.entries(value))
        : {}

const textOf = (value: unknown): string => (typeof value === "string" ? value : "")

const firstEventOf = (value: unknown): ZaloFirstEvent | null => {
    const event = recordOf(value)
    if (typeof event.amount !== "number" || typeof event.content !== "string" || typeof event.at !== "string")
        return null
    return { amount: event.amount, content: event.content, at: event.at }
}

const wizardOf = (value: unknown): ZaloWizardResult | null => {
    const wizard = recordOf(value)
    if (typeof wizard.ticket !== "string") return null
    return {
        ticket: wizard.ticket,
        command: textOf(wizard.command),
        state: textOf(wizard.state),
        url: textOf(wizard.url),
        code: textOf(wizard.code),
    }
}

/** Reads one Zalo connection of the current RLS principal workspace together with the agents bound to it. */
export const readZaloWizard = async (connectionId: string): Promise<DbOutcome<ZaloWizardState>> => {
    const client = await createServerDbClient()
    const row = toOutcome(
        await client
            .from("connections")
            .select("id, name, status, public_meta, first_event")
            .eq("id", connectionId)
            .eq("provider", "zalo_oa")
            .single(),
    )
    if (row.kind !== "ok") return row
    const grants = toOutcome(
        await client.from("agent_connections").select("agent_id").eq("connection_id", connectionId).limit(AGENT_LIMIT),
    )
    const agents = grants.kind === "ok" ? grants.value.map((grant) => grant.agent_id) : []
    const meta = recordOf(row.value.public_meta)
    return dbOk({
        id: row.value.id,
        name: row.value.name,
        status: row.value.status,
        authorized: meta.authorized === true,
        oaSecretSaved: meta.oa_secret_saved === true,
        oaId: textOf(meta.oa_id),
        firstEvent: firstEventOf(row.value.first_event),
        agentIds: agents,
        wizard: wizardOf(meta.wizard),
    })
}

const pause = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Waits for the back end to answer a wizard ticket (null: whichever ticket is on the row now): looks at the connection row until the result next to the ticket is done or failed, or
 * the time is up (then the step is reported as unavailable and the owner can try again).
 */
export const readZaloWizardResult = async (
    connectionId: string,
    ticket: string | null,
    timeoutMs: number,
): Promise<DbOutcome<ZaloWizardResult>> => {
    const deadline = Date.now() + timeoutMs
    for (;;) {
        const state = await readZaloWizard(connectionId)
        if (state.kind !== "ok") return state
        const wizard = state.value.wizard
        if (wizard !== null && (ticket === null || wizard.ticket === ticket) && wizard.state !== "queued")
            return dbOk(wizard)
        if (Date.now() >= deadline) return dbFailure("unavailable", "zalo-wizard-timeout")
        await pause(WAIT_STEP_MS)
    }
}
