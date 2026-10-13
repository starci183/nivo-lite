import type { Outcome } from "../outcome"

/** What recording an outcome answered. */
export interface RecordedOutcomeItem {
    readonly leadId: string
    readonly stage: string
    readonly contactName: string
    readonly company: string
    readonly channel: string
    readonly need: string
    readonly origin: string | null
    readonly handedToAccounting: boolean
}

/** One step of a lead journey as the back end answers it. */
export interface ResponsibilityItem {
    readonly id: string
    readonly leadId: string
    readonly title: string
    readonly ownerKind: string
    readonly ownerAgentId: string | null
    readonly ownerName: string
    readonly nextAction: string
    readonly dueAt: string | null
    readonly status: string
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null

const isTextOrNull = (value: unknown): value is string | null => value === null || typeof value === "string"

const isRecorded = (value: unknown): value is RecordedOutcomeItem =>
    isRecord(value) &&
    typeof value.leadId === "string" &&
    typeof value.stage === "string" &&
    typeof value.contactName === "string" &&
    typeof value.company === "string" &&
    typeof value.channel === "string" &&
    typeof value.need === "string" &&
    isTextOrNull(value.origin) &&
    typeof value.handedToAccounting === "boolean"

const isResponsibility = (value: unknown): value is ResponsibilityItem =>
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.leadId === "string" &&
    typeof value.title === "string" &&
    typeof value.ownerKind === "string" &&
    isTextOrNull(value.ownerAgentId) &&
    typeof value.ownerName === "string" &&
    typeof value.nextAction === "string" &&
    isTextOrNull(value.dueAt) &&
    typeof value.status === "string"

const parsed = (body: string): unknown => {
    try {
        return JSON.parse(body)
    } catch {
        return undefined
    }
}

const malformed = { kind: "unavailable", fault: { code: "shape" }, retryable: false } as const

/** Reads the answer of record-outcome. */
export const decodeRecordedOutcome = (body: string): Outcome<RecordedOutcomeItem> => {
    const value = parsed(body)
    return isRecorded(value) ? { kind: "ok", value } : malformed
}

/** Reads the answer of add-responsibility and assign-responsibility. */
export const decodeResponsibility = (body: string): Outcome<ResponsibilityItem> => {
    const value = parsed(body)
    return isResponsibility(value) ? { kind: "ok", value } : malformed
}
