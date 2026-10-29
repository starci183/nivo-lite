import { isRecord } from "@modules/platform/primitives"
import { PublicApiError, PublicApiErrorCode } from "./errors/public-api.error"
import { LEAD_STAGES } from "./public-api.contracts"
import type { PublicLeadStage, LeadRequestBody, MessageRequestBody } from "./public-api.contracts"
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

const nullableIdentityOf = (value: unknown, field: string): string | null =>
    value === null ? null : identityOf(value, field)

const booleanOf = (value: unknown, field: string): boolean => (typeof value === "boolean" ? value : invalid(field))

const optionalBooleanOf = (value: unknown, field: string): boolean | undefined =>
    value === undefined ? undefined : booleanOf(value, field)

const optionalChannelOf = (value: unknown): string | undefined => {
    if (value === undefined) return undefined
    const channel = textOf(value, "channel")
    return channel.trim() === "" ? invalid("channel") : channel
}

const stageOf = (value: unknown): PublicLeadStage | null => {
    if (value === null) return null
    return LEAD_STAGES.find((stage) => stage === value) ?? invalid("stage")
}

const stringsOf = (value: unknown, field: string): Array<string> => {
    if (!Array.isArray(value)) return invalid(field)
    return value.map((item: unknown) => textOf(item, field))
}

const messageOf = (row: Record<string, unknown>, source: string): MessageRequestBody => ({
    conversationId: identityOf(row.conversationId, "conversationId"),
    leadId: nullableIdentityOf(row.leadId, "leadId"),
    text: textOf(row.text, "text"),
    requireApproval: booleanOf(row.requireApproval, "requireApproval"),
    source,
})

const leadOf = (row: Record<string, unknown>, needSupplied: boolean | null): LeadRequestBody => {
    const supplied = needSupplied ?? optionalBooleanOf(row.needSupplied, "needSupplied")
    return {
        name: textOf(row.name, "name"),
        contact: nullableTextOf(row.contact, "contact"),
        need: textOf(row.need, "need"),
        channel: textOf(row.channel, "channel"),
        company: textOf(row.company, "company"),
        note: textOf(row.note, "note"),
        stage: stageOf(row.stage),
        externalId: textOf(row.externalId, "externalId"),
        source: textOf(row.source, "source"),
        ...(supplied === undefined ? {} : { needSupplied: supplied }),
    }
}

/** Reads admitted customer facts for the later gated handoff's completion transaction. */
export const parsePublicLeadBody = (payload: unknown, needSupplied: boolean | null): LeadRequestBody =>
    leadOf(recordOf(payload), needSupplied)

/** Validates ledger and pre-ledger deliveries without creating replacement request identities. */
export const parsePublicApiJob = (payload: unknown): PublicApiJob => {
    const row = recordOf(payload)
    const workspaceId = identityOf(row.workspaceId, "workspaceId")
    if ("requestId" in row) {
        return { format: "ledger", workspaceId, requestId: identityOf(row.requestId, "requestId") }
    }
    switch (row.kind) {
        case "lead": {
            const identity = identityOf(row.inboundEventId, "inboundEventId")
            const channel = optionalChannelOf(row.channel)
            return {
                format: "lead",
                workspaceId,
                identity,
                body: {
                    inboundEventId: identity,
                    keyName: textOf(row.keyName, "keyName"),
                    ...(channel === undefined ? {} : { channel }),
                    company: textOf(row.company, "company"),
                    stage: stageOf(row.stage),
                    note: textOf(row.note, "note"),
                },
            }
        }
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

/** Validates the persisted request and recovers future need presence while leaving old rows distinguishable. */
export const parsePublicApiBody = (kind: string, payload: unknown, needSupplied: boolean | null): PublicApiBody => {
    const row = recordOf(payload)
    switch (kind) {
        case "lead":
            return { kind, body: leadOf(row, needSupplied) }
        case "message":
            return { kind, body: messageOf(row, textOf(row.source, "source")) }
        case "knowledge": {
            const visibility = row.visibility
            if (visibility !== "internal" && visibility !== "public") return invalid("visibility")
            return {
                kind,
                body: {
                    title: textOf(row.title, "title"),
                    content: textOf(row.content, "content"),
                    topic: nullableTextOf(row.topic, "topic"),
                    tags: stringsOf(row.tags, "tags"),
                    visibility,
                    source: textOf(row.source, "source"),
                },
            }
        }
        default:
            return invalid("kind")
    }
}
