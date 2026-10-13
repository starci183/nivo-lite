import type {
    AddDraftShiftParams,
    ApplyImportParams,
    ExplainScheduleParams,
    ProposeWeekParams,
    ReassignShiftParams,
    RemoveDraftShiftParams,
    RequestLeaveParams,
    RequestPublishParams,
    RequestSwapParams,
} from "../shifts-operations.contracts"

/** One command a member submitted, decoded to the parameters of the domain service that runs it. */
export type ShiftsCommandRequest =
    | { readonly kind: "propose-week"; readonly params: ProposeWeekParams }
    | { readonly kind: "explain-schedule"; readonly params: ExplainScheduleParams }
    | { readonly kind: "reassign-shift"; readonly params: ReassignShiftParams }
    | { readonly kind: "add-draft-shift"; readonly params: AddDraftShiftParams }
    | { readonly kind: "remove-draft-shift"; readonly params: RemoveDraftShiftParams }
    | { readonly kind: "request-publish"; readonly params: RequestPublishParams }
    | { readonly kind: "request-swap"; readonly params: RequestSwapParams }
    | { readonly kind: "request-leave"; readonly params: RequestLeaveParams }
    | { readonly kind: "apply-import"; readonly params: ApplyImportParams }

type Fields = Readonly<Record<string, unknown>>

const fieldsOf = (value: unknown): Fields =>
    typeof value === "object" && value !== null && !Array.isArray(value)
        ? Object.fromEntries(Object.entries(value))
        : {}

const text = (fields: Fields, key: string): string => {
    const value = fields[key]
    return typeof value === "string" ? value : ""
}

/** A text, or null when the field is missing, null or empty. */
const maybeText = (fields: Fields, key: string): string | null => {
    const value = text(fields, key)
    return value === "" ? null : value
}

/** Decodes the stored input of a command by its kind; an unknown kind decodes to nothing. */
export const decodeCommand = (kind: string, input: unknown): ShiftsCommandRequest | null => {
    const fields = fieldsOf(input)
    switch (kind) {
        case "propose-week":
            return { kind, params: { week: text(fields, "week") } }
        case "explain-schedule":
            return { kind, params: { scheduleId: text(fields, "scheduleId") } }
        case "reassign-shift":
            return { kind, params: { shiftId: text(fields, "shiftId"), staffId: maybeText(fields, "staffId") } }
        case "add-draft-shift":
            return {
                kind,
                params: {
                    scheduleId: text(fields, "scheduleId"),
                    date: text(fields, "date"),
                    start: text(fields, "start"),
                    end: text(fields, "end"),
                    positionId: text(fields, "positionId"),
                    staffId: maybeText(fields, "staffId"),
                },
            }
        case "remove-draft-shift":
            return { kind, params: { shiftId: text(fields, "shiftId") } }
        case "request-publish":
            return { kind, params: { scheduleId: text(fields, "scheduleId") } }
        case "request-swap":
            return {
                kind,
                params: {
                    kind: fields.kind === "claim" ? "claim" : "swap",
                    shiftId: text(fields, "shiftId"),
                    toStaffId: maybeText(fields, "toStaffId"),
                    reason: text(fields, "reason"),
                },
            }
        case "request-leave":
            return {
                kind,
                params: { from: text(fields, "from"), to: text(fields, "to"), reason: text(fields, "reason") },
            }
        case "apply-import":
            return {
                kind,
                params: {
                    positions: text(fields, "positions"),
                    staff: text(fields, "staff"),
                    coverage: text(fields, "coverage"),
                },
            }
        default:
            return null
    }
}
