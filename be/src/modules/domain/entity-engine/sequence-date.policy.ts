import type { SequenceDate } from "@nivo-lite/agent-sdk/entity"

/** The workspace calendar is Vietnam's: UTC+7 all year (no daylight saving). */
const WORKSPACE_UTC_OFFSET_MS = 7 * 60 * 60 * 1000

/** The calendar day of an instant in the workspace time zone, the date sequence periods and formats are read in. */
export const sequenceDateOf = (instant: Date): SequenceDate => {
    const local = new Date(instant.getTime() + WORKSPACE_UTC_OFFSET_MS)
    return { year: local.getUTCFullYear(), month: local.getUTCMonth() + 1, day: local.getUTCDate() }
}
