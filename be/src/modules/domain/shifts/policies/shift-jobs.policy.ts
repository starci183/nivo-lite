import type { ShiftsJobPayload } from "@modules/queues/shifts"

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
    typeof value === "object" && value !== null && !Array.isArray(value)

/** The payload of a shift-alerts job, or null for anything else (a foreign or broken payload is dropped). */
export const shiftsJobOf = (value: unknown): ShiftsJobPayload | null => {
    if (!isRecord(value)) return null
    if (value.kind === "tick") return { kind: "tick" }
    if (value.kind !== "remind" && value.kind !== "noshow") return null
    if (typeof value.workspaceId !== "string" || typeof value.shiftId !== "string") return null
    return { kind: value.kind, workspaceId: value.workspaceId, shiftId: value.shiftId }
}
