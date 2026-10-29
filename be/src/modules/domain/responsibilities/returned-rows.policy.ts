import { isRecord } from "@modules/platform/primitives"
import type { StepRow } from "./responsibilities.contracts"
import type { ResponsibilityRecord } from "./responsibility-journal.contracts"

const isStepRow = (value: unknown): value is StepRow =>
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.lead_id === "string" &&
    typeof value.title === "string" &&
    typeof value.owner_name === "string"

const isRecordRow = (value: unknown): value is ResponsibilityRecord =>
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.workspace_id === "string" &&
    typeof value.title === "string" &&
    typeof value.owner_name === "string"

/** The first step a RETURNING write answered; undefined when the write answered none. */
export const firstStepRow = (raw: unknown): StepRow | undefined =>
    Array.isArray(raw) ? raw.find(isStepRow) : undefined

/** The first responsibility record a RETURNING write answered; undefined when the write answered none. */
export const firstRecordRow = (raw: unknown): ResponsibilityRecord | undefined =>
    Array.isArray(raw) ? raw.find(isRecordRow) : undefined
