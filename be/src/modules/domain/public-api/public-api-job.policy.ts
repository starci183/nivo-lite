import { isRecord } from "@modules/platform/primitives"
import { PublicApiError, PublicApiErrorCode } from "./errors/public-api.error"
import type { MessageRequestBody } from "./public-api.contracts"
import type { PublicApiBody, PublicApiJob } from "./public-api-job.contracts"

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu

const invalid = (field: string): never => {
    throw new PublicApiError({ code: PublicApiErrorCode.RequestInvalid, params: { field } })
}

const recordOf = (value: unknown): Record<string, unknown> => (isRecord(value) ? value : invalid("payload"))

const textOf = (value: unknown, field: string): string => (typeof value === "string" ? value : invalid(field))

const identityOf = (value: unknown, field: string): string => {
    const text = textOf(value, field)
    return UUID.test(text) ? text : invalid(field)
}

const nullableTextOf = (value: unknown, field: string): string | null => (value === null ? null : textOf(value, field))

const booleanOf = (value: unknown, field: string): boolean => (typeof value === "boolean" ? value : invalid(field))

const stringsOf = (value: unknown, field: string): Array<string> => {
    if (!Array.isArray(value)) return invalid(field)
    return value.map((item: unknown) => textOf(item, field))
}

const messageOf = (row: Record<string, unknown>, source: string): MessageRequestBody => ({
    conversationId: identityOf(row.conversationId, "conversationId"),
    text: textOf(row.text, "text"),
    requireApproval: booleanOf(row.requireApproval, "requireApproval"),
    source,
})

/** Validates ledger and pre-ledger deliveries without creating replacement request identities. */
export const parsePublicApiJob = (payload: unknown): PublicApiJob => {
    const row = recordOf(payload)
    const workspaceId = identityOf(row.workspaceId, "workspaceId")
    if ("requestId" in row) {
        return { format: "ledger", workspaceId, requestId: identityOf(row.requestId, "requestId") }
    }
    switch (row.kind) {
        case "message": {
            const identity = textOf(row.dedupeKey, "dedupeKey")
            if (identity.trim() === "") return invalid("dedupeKey")
            return {
                format: "message",
                workspaceId,
                identity,
                dedupeKey: identity,
                body: messageOf(row, `api:${textOf(row.keyName, "keyName")}`),
            }
        }
        case "knowledge": {
            const sourceId = identityOf(row.sourceId, "sourceId")
            return { format: "knowledge", workspaceId, identity: sourceId, sourceId }
        }
        default:
            return invalid("kind")
    }
}

/** Validates the persisted request. */
export const parsePublicApiBody = (kind: string, payload: unknown): PublicApiBody => {
    const row = recordOf(payload)
    switch (kind) {
        case "message":
            return { kind, body: messageOf(row, textOf(row.source, "source")) }
        case "knowledge": {
            const visibility = row.visibility
            // A row stored as public by an older version is read as internal: an API key never adds a public document.
            if (visibility !== "internal" && visibility !== "public") return invalid("visibility")
            return {
                kind,
                body: {
                    title: textOf(row.title, "title"),
                    content: textOf(row.content, "content"),
                    topic: nullableTextOf(row.topic, "topic"),
                    tags: stringsOf(row.tags, "tags"),
                    visibility: "internal",
                    source: textOf(row.source, "source"),
                },
            }
        }
        default:
            return invalid("kind")
    }
}
