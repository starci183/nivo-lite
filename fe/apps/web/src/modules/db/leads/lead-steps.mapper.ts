const ROW_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu
const STAGES: ReadonlyArray<string> = ["new", "qualified", "proposal", "won", "lost"]

/** What recording an outcome answers. */
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

/** One step of a lead journey as the database function answers it. */
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

/** What a person types to add or change the step of a lead. */
export interface StepInput {
    /** `human` for the signed-in person, else the id of an agent. */
    readonly owner: string
    readonly nextAction: string
    /** ISO 8601, or null for no date. */
    readonly dueAt: string | null
}

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null

const textOrNull = (value: unknown): string | null => (typeof value === "string" ? value : null)

/** Whether the value is the id of a row. */
export const isRowId = (value: unknown): value is string => typeof value === "string" && ROW_ID.test(value)

/** Whether the value names a lead stage. */
export const isStageName = (value: unknown): value is string => typeof value === "string" && STAGES.includes(value)

/** Bounds the step a person typed; null when it cannot be a step. */
export const stepInputOf = (value: unknown): StepInput | null => {
    if (!isObject(value) || typeof value.owner !== "string" || value.owner === "") return null
    if (typeof value.nextAction !== "string" || value.nextAction.trim() === "" || value.nextAction.length > 500) {
        return null
    }
    const dueAt = textOrNull(value.dueAt)
    if (dueAt !== null && Number.isNaN(new Date(dueAt).getTime())) return null
    return { owner: value.owner, nextAction: value.nextAction, dueAt }
}

/** Reads the answer of `record_lead_outcome`; null when it is not the shape the function promises. */
export const recordedOutcomeOf = (value: unknown): RecordedOutcomeItem | null => {
    if (!isObject(value)) return null
    const { leadId, stage, contactName, company, channel, need } = value
    if (
        typeof leadId !== "string" ||
        typeof stage !== "string" ||
        typeof contactName !== "string" ||
        typeof company !== "string" ||
        typeof channel !== "string" ||
        typeof need !== "string"
    ) {
        return null
    }
    return {
        leadId,
        stage,
        contactName,
        company,
        channel,
        need,
        origin: textOrNull(value.origin),
        handedToAccounting: value.handedToAccounting === true,
    }
}

/** Reads the answer of the step functions; null when it is not the shape they promise. */
export const responsibilityOf = (value: unknown): ResponsibilityItem | null => {
    if (!isObject(value)) return null
    const { id, leadId, title, ownerKind, ownerName, nextAction, status } = value
    if (
        typeof id !== "string" ||
        typeof leadId !== "string" ||
        typeof title !== "string" ||
        typeof ownerKind !== "string" ||
        typeof ownerName !== "string" ||
        typeof nextAction !== "string" ||
        typeof status !== "string"
    ) {
        return null
    }
    return {
        id,
        leadId,
        title,
        ownerKind,
        ownerAgentId: textOrNull(value.ownerAgentId),
        ownerName,
        nextAction,
        dueAt: textOrNull(value.dueAt),
        status,
    }
}
