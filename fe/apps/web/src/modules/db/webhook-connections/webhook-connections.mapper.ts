import { isRecord, isUuid, keyOfCode, schemaOf } from "@/modules/db/channel-connections/channel-connections.mapper"
import type { ChannelRequest } from "@/modules/db/channel-connections/channel-connections.mapper"

const NAME_MAX = 120
const URL_MAX = 2048
const EVENT_MAX = 40
const EVENTS_MAX = 20

const eventsOf = (value: unknown): ReadonlyArray<string> | null => {
    if (!Array.isArray(value) || value.length > EVENTS_MAX) return null
    const events = value.filter((item): item is string => typeof item === "string" && item.length <= EVENT_MAX)
    return events.length === value.length ? events : null
}

/** The webhook.start command for `{ workspaceId, name, url, events }`: bounded text and a short list of event ids (the api knows which ids exist). */
const startRequestOf = (input: unknown): ChannelRequest | null => {
    if (!isRecord(input) || !isUuid(input.workspaceId)) return null
    const { name, url } = input
    const events = eventsOf(input.events)
    if (
        typeof name !== "string" ||
        name.length > NAME_MAX ||
        typeof url !== "string" ||
        url.length > URL_MAX ||
        events === null
    )
        return null
    return { workspaceId: input.workspaceId, kind: "webhook.start", input: { name, url, events } }
}

/** The webhook.finish command for `{ workspaceId, connectionId }`. */
const finishRequestOf = (input: unknown): ChannelRequest | null =>
    isRecord(input) && isUuid(input.workspaceId) && isUuid(input.connectionId)
        ? { workspaceId: input.workspaceId, kind: "webhook.finish", input: { connectionId: input.connectionId } }
        : null

/** The bounded schemas of the webhook commands: each turns an input into the request, or refuses it. */
export const webhookSchemas = { start: schemaOf(startRequestOf), finish: schemaOf(finishRequestOf) } as const

const ERROR_KEYS: Readonly<Record<string, string>> = {
    CONNECTIONS_FORBIDDEN: "errForbidden",
    CONNECTIONS_NOT_FOUND: "errNone",
    WEBHOOK_CONNECTIONS_EVENTS_EMPTY: "errEventsEmpty",
    WEBHOOK_CONNECTIONS_NAME_INVALID: "errNameInvalid",
    WEBHOOK_CONNECTIONS_URL_REFUSED: "errUrlRefused",
    WEBHOOK_CONNECTIONS_SIGNING_UNAVAILABLE: "errSigning",
    WEBHOOK_CONNECTIONS_NO_URL: "errNoUrl",
}

/** The catalog key (namespace `webhookWizard`) of a webhook-connections failure code; an unknown code is the generic key. */
export const webhookMessageKeyOf = (code: string): string => keyOfCode(code, ERROR_KEYS)
