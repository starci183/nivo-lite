import type { RequestSwapParams } from "./shifts-operations.contracts"
import type { SaveShiftsAvailabilityParams, SaveStaffParams } from "./shifts-setup.contracts"

/** The swap or claim request of one workspace. */
interface RequestSwapRequest extends RequestSwapParams {
    /** The workspace the request acts in. */
    readonly workspaceId: string
}

/** The staff save request of one workspace. */
interface SaveStaffRequest extends SaveStaffParams {
    /** The workspace the staff member belongs to. */
    readonly workspaceId: string
}

/** The availability request of one workspace. */
interface AvailabilityRequest extends SaveShiftsAvailabilityParams {
    /** The workspace the window belongs to. */
    readonly workspaceId: string
}

/** The swap or claim form as GraphQL hands it over: the colleague may be absent. */
interface RequestSwapForm extends Omit<RequestSwapParams, "toStaffId"> {
    /** The colleague who takes the shift, when given. */
    readonly toStaffId?: string | null
}

/** The availability form as GraphQL hands it over: an optional field may arrive as null as well as absent. */
interface AvailabilityForm extends Omit<SaveShiftsAvailabilityParams, "staffId" | "weekday" | "date" | "note"> {
    /** The staff member, when the manager names one. */
    readonly staffId?: string | null
    /** The weekday of a repeating window, when given. */
    readonly weekday?: number | null
    /** The date of a one-off window, when given. */
    readonly date?: string | null
    /** The note, when given. */
    readonly note?: string | null
}

/** True when GraphQL handed the field over: neither absent nor null. */
const isGiven = <V>(value: V | null | undefined): value is V => value !== undefined && value !== null

/** Maps the swap or claim form to the request of the workspace it names; an absent colleague reads as null. */
export const toRequestShiftsSwapRequest = (workspaceId: string, input: RequestSwapForm): RequestSwapRequest => ({
    workspaceId,
    kind: input.kind,
    shiftId: input.shiftId,
    toStaffId: input.toStaffId ?? null,
    reason: input.reason,
})

/** Maps the staff form to the save request of the workspace it names; an absent staff row reads as null. */
export const toSaveShiftsStaffRequest = (workspaceId: string, input: SaveStaffParams): SaveStaffRequest => ({
    workspaceId,
    ...input,
    staffRowId: input.staffRowId ?? null,
})

/** Maps the availability form to the request of the workspace it names; an absent day or date reads as null. */
const toAvailabilityRequest = (workspaceId: string, input: AvailabilityForm): AvailabilityRequest => ({
    workspaceId,
    ...(isGiven(input.staffId) ? { staffId: input.staffId } : {}),
    weekday: input.weekday ?? null,
    date: input.date ?? null,
    start: input.start,
    end: input.end,
    available: input.available,
    ...(isGiven(input.note) ? { note: input.note } : {}),
})

/** Maps the manager's availability form to the request of the workspace it names. */
export const toAddShiftsAvailabilityRequest = (workspaceId: string, input: AvailabilityForm): AvailabilityRequest =>
    toAvailabilityRequest(workspaceId, input)

/** Maps the member's own availability form to the request of the workspace it names. */
export const toSubmitShiftsAvailabilityRequest = (workspaceId: string, input: AvailabilityForm): AvailabilityRequest =>
    toAvailabilityRequest(workspaceId, input)
