import type { ProposalFieldValue, SubjectType } from "./decisions.contracts"
import type { SplitPayload } from "./work-engine.contracts"

/** A chain longer than this many hops is refused (the longest real chain today is 3: handoff_lead, classify_lead, send_follow_up). */
export const MAX_COMMAND_DEPTH = 6

/** Payload keys that address the work item itself; every other payload key becomes a field of the receiver's proposal. */
const ENVELOPE_KEYS = new Set(["subject_type", "subject_id", "lead_id"])

const isEmpty = (value: unknown): boolean =>
    value === null || value === undefined || (typeof value === "string" && value.trim() === "")

const textOf = (value: unknown): string | null => (typeof value === "string" && value.trim() !== "" ? value : null)

/** The required payload keys the sender did not supply. */
export const missingPayload = (
    requiredFields: ReadonlyArray<string>,
    payload: Readonly<Record<string, unknown>>,
): ReadonlyArray<string> => requiredFields.filter((field) => isEmpty(payload[field]))

const SUBJECT_TYPES = new Set([
    "lead",
    "order",
    "invoice",
    "transaction",
    "conversation",
    "inbound",
    "purchase_order",
    "stock",
    "video_project",
])

/** Whether text names a kind of record a work item can be about. */
export const isSubjectType = (value: string): value is SubjectType => SUBJECT_TYPES.has(value)

/** A payload value as a proposal field: text, numbers and null stay, a missing value is dropped, anything else is kept as JSON text. */
const fieldValue = (value: unknown): ProposalFieldValue | undefined =>
    value === undefined || value === null || typeof value === "string" || typeof value === "number"
        ? value
        : JSON.stringify(value)

/** Splits a payload into the work item's address and the proposal fields. */
export const splitPayload = (payload: Readonly<Record<string, unknown>>, defaultSubjectType: string): SplitPayload => ({
    subjectType: textOf(payload.subject_type) ?? defaultSubjectType,
    subjectId: textOf(payload.subject_id),
    leadId: textOf(payload.lead_id),
    fields: Object.fromEntries(
        Object.entries(payload)
            .filter(([key]) => !ENVELOPE_KEYS.has(key))
            .flatMap(([key, value]) => {
                const field = fieldValue(value)
                return field === undefined ? [] : [[key, field]]
            }),
    ),
})

/** True when the next hop would be deeper than the limit. `depth` is the depth the new item would get (the root is 0). */
export const tooDeep = (depth: number): boolean => depth > MAX_COMMAND_DEPTH

/** The default idempotency key: the same command about the same subject is one piece of work. */
export const defaultDedupeKey = (command: string, subjectType: string, subjectId: string | null): string =>
    `cmd:${command}:${subjectType}:${subjectId ?? "none"}`

/** "type - instance" when the instance has a name of its own, else the type's name. */
export const instanceLabel = (typeName: string, instanceName: string | null): string =>
    instanceName !== null && instanceName.trim().toLowerCase() !== typeName.trim().toLowerCase()
        ? `${typeName} – ${instanceName}`
        : typeName

/** An order number reads as "#DH-1"; any other label is shown as it is. */
export const shownSubject = (subjectType: string, label: string): string =>
    subjectType === "order" && !label.startsWith("#") ? `#${label}` : label

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Whether text is a UUID. */
export const isUuid = (value: string): boolean => UUID_PATTERN.test(value)
