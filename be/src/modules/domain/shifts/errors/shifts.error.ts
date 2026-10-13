import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the shifts capability. */
export enum ShiftsErrorCode {
    /** The week is not a day in YYYY-MM-DD form. */
    WeekInvalid = "SHIFTS_WEEK_INVALID",
    /** There is nobody active to schedule. */
    NoStaff = "SHIFTS_NO_STAFF",
    /** There is no coverage to schedule against. */
    NoCoverage = "SHIFTS_NO_COVERAGE",
    /** The schedule could not be saved. */
    ScheduleNotSaved = "SHIFTS_SCHEDULE_NOT_SAVED",
    /** No schedule of the workspace has the requested id. */
    ScheduleNotFound = "SHIFTS_SCHEDULE_NOT_FOUND",
    /** Only a draft schedule can be edited or put up for publishing. */
    ScheduleNotDraft = "SHIFTS_SCHEDULE_NOT_DRAFT",
    /** No shift of the workspace has the requested id. */
    ShiftNotFound = "SHIFTS_SHIFT_NOT_FOUND",
    /** Only a shift of a draft schedule can be edited. */
    ShiftNotEditable = "SHIFTS_SHIFT_NOT_EDITABLE",
    /** The person does not exist in the workspace. */
    StaffNotFound = "SHIFTS_STAFF_NOT_FOUND",
    /** The start or end of a shift is not a time, or the end is not after the start. */
    TimeInvalid = "SHIFTS_TIME_INVALID",
    /** The member who asks has no staff profile in the shifts of the workspace. */
    ProfileMissing = "SHIFTS_PROFILE_MISSING",
    /** The leave range is not two days in order. */
    LeaveRangeInvalid = "SHIFTS_LEAVE_RANGE_INVALID",
    /** The shift cannot change hands: the rules say why. */
    SwapRefused = "SHIFTS_SWAP_REFUSED",
    /** The quick import text has nothing to read. */
    ImportEmpty = "SHIFTS_IMPORT_EMPTY",
    /** Some lines of the quick import could not be read; nothing was changed. */
    ImportLines = "SHIFTS_IMPORT_LINES",
    /** A name or a number of a setup write is not in bounds. */
    SetupFieldInvalid = "SHIFTS_SETUP_FIELD_INVALID",
    /** An availability statement needs exactly one of weekday or date and an end after the start. */
    AvailabilityInvalid = "SHIFTS_AVAILABILITY_INVALID",
    /** A person may only check in to their own shift. */
    CheckinNotYours = "SHIFTS_CHECKIN_NOT_YOURS",
    /** Check-in opens thirty minutes before the shift starts. */
    CheckinEarly = "SHIFTS_CHECKIN_EARLY",
    /** The shift already ended. */
    CheckinClosed = "SHIFTS_CHECKIN_CLOSED",
}

/** How each shifts code travels. */
export const SHIFTS_ERROR_KINDS: Record<ShiftsErrorCode, ErrorKind> = {
    [ShiftsErrorCode.WeekInvalid]: "invalid",
    [ShiftsErrorCode.NoStaff]: "conflict",
    [ShiftsErrorCode.NoCoverage]: "conflict",
    [ShiftsErrorCode.ScheduleNotSaved]: "internal",
    [ShiftsErrorCode.ScheduleNotFound]: "not-found",
    [ShiftsErrorCode.ScheduleNotDraft]: "conflict",
    [ShiftsErrorCode.ShiftNotFound]: "not-found",
    [ShiftsErrorCode.ShiftNotEditable]: "conflict",
    [ShiftsErrorCode.StaffNotFound]: "not-found",
    [ShiftsErrorCode.TimeInvalid]: "invalid",
    [ShiftsErrorCode.ProfileMissing]: "conflict",
    [ShiftsErrorCode.LeaveRangeInvalid]: "invalid",
    [ShiftsErrorCode.SwapRefused]: "conflict",
    [ShiftsErrorCode.ImportEmpty]: "invalid",
    [ShiftsErrorCode.ImportLines]: "invalid",
    [ShiftsErrorCode.SetupFieldInvalid]: "invalid",
    [ShiftsErrorCode.AvailabilityInvalid]: "invalid",
    [ShiftsErrorCode.CheckinNotYours]: "conflict",
    [ShiftsErrorCode.CheckinEarly]: "conflict",
    [ShiftsErrorCode.CheckinClosed]: "conflict",
}

/** The one error class of the shifts capability. */
export class ShiftsError extends DomainError<ShiftsErrorCode> {}
