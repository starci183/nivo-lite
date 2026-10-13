import type {
    ApplyImportOutput,
    CheckInOutput,
    SaveShiftsAvailabilityOutput,
    SavePositionOutput,
    SaveStaffOutput,
} from "@modules/domain/shifts"
import type { AddShiftsAvailabilityRequest } from "../../application/add-shifts-availability.contracts"
import type { ApplyShiftsImportRequest } from "../../application/apply-shifts-import.contracts"
import type { CheckInShiftsRequest } from "../../application/check-in-shifts.contracts"
import type { DecideShiftsAvailabilityRequest } from "../../application/decide-shifts-availability.contracts"
import type { RemoveShiftsAvailabilityRequest } from "../../application/remove-shifts-availability.contracts"
import type { RemoveShiftsCoverageRequest } from "../../application/remove-shifts-coverage.contracts"
import type { RemoveShiftsPositionRequest } from "../../application/remove-shifts-position.contracts"
import type { SaveShiftsCoverageRequest } from "../../application/save-shifts-coverage.contracts"
import type { SaveShiftsPositionRequest } from "../../application/save-shifts-position.contracts"
import type { SaveShiftsSettingsRequest } from "../../application/save-shifts-settings.contracts"
import type { SaveShiftsStaffRequest } from "../../application/save-shifts-staff.contracts"
import type { SubmitShiftsAvailabilityRequest } from "../../application/submit-shifts-availability.contracts"
import type { ApplyShiftsImportInput } from "./dto/apply-shifts-import.input"
import type { ApplyImportType } from "./dto/apply-import.type"
import type { CheckInType } from "./dto/check-in.type"
import type { DecideShiftsAvailabilityInput } from "./dto/decide-shifts-availability.input"
import type { SaveShiftsAvailabilityInput } from "./dto/save-shifts-availability.input"
import type { SaveShiftsCoverageInput } from "./dto/save-shifts-coverage.input"
import type { SaveShiftsPositionInput } from "./dto/save-shifts-position.input"
import type { SaveShiftsSettingsInput } from "./dto/save-shifts-settings.input"
import type { SaveShiftsStaffInput } from "./dto/save-shifts-staff.input"
import type { ShiftsAvailabilityRefInput } from "./dto/shifts-availability-ref.input"
import type { ShiftsCoverageRefInput } from "./dto/shifts-coverage-ref.input"
import type { ShiftsPositionRefInput } from "./dto/shifts-position-ref.input"
import type { ShiftsRefType } from "./dto/shifts-ref.type"
import type { ShiftsShiftRefInput } from "./dto/shifts-shift-ref.input"

/** Maps the GraphQL input to the quick import request of the workspace it names. */
export const toApplyShiftsImportRequest = (
    workspaceId: string,
    input: ApplyShiftsImportInput,
): ApplyShiftsImportRequest => ({
    workspaceId,
    ...input,
})

/** Maps the GraphQL input to the position save request of the workspace it names. */
export const toSaveShiftsPositionRequest = (
    workspaceId: string,
    input: SaveShiftsPositionInput,
): SaveShiftsPositionRequest => ({ workspaceId, ...input })

/** Maps the GraphQL input to the position removal request of the workspace it names. */
export const toRemoveShiftsPositionRequest = (
    workspaceId: string,
    input: ShiftsPositionRefInput,
): RemoveShiftsPositionRequest => ({ workspaceId, id: input.id })

/** Maps the GraphQL input to the staff save request of the workspace it names. */
export const toSaveShiftsStaffRequest = (workspaceId: string, input: SaveShiftsStaffInput): SaveShiftsStaffRequest => ({
    workspaceId,
    ...input,
    staffRowId: input.staffRowId ?? null,
})

/** Maps the GraphQL input to the coverage save request of the workspace it names. */
export const toSaveShiftsCoverageRequest = (
    workspaceId: string,
    input: SaveShiftsCoverageInput,
): SaveShiftsCoverageRequest => ({ workspaceId, ...input })

/** Maps the GraphQL input to the coverage removal request of the workspace it names. */
export const toRemoveShiftsCoverageRequest = (
    workspaceId: string,
    input: ShiftsCoverageRefInput,
): RemoveShiftsCoverageRequest => ({ workspaceId, id: input.id })

/** Maps the GraphQL input to the settings save request of the workspace it names. */
export const toSaveShiftsSettingsRequest = (
    workspaceId: string,
    input: SaveShiftsSettingsInput,
): SaveShiftsSettingsRequest => ({ workspaceId, ...input })

const toAvailabilityFields = (input: SaveShiftsAvailabilityInput) => ({
    ...(input.staffId === undefined || input.staffId === null ? {} : { staffId: input.staffId }),
    weekday: input.weekday ?? null,
    date: input.date ?? null,
    start: input.start,
    end: input.end,
    available: input.available,
    ...(input.note === undefined || input.note === null ? {} : { note: input.note }),
})

/** Maps the GraphQL input to the manager's availability request of the workspace it names. */
export const toAddShiftsAvailabilityRequest = (
    workspaceId: string,
    input: SaveShiftsAvailabilityInput,
): AddShiftsAvailabilityRequest => ({ workspaceId, ...toAvailabilityFields(input) })

/** Maps the GraphQL input to the member's own availability request of the workspace it names. */
export const toSubmitShiftsAvailabilityRequest = (
    workspaceId: string,
    input: SaveShiftsAvailabilityInput,
): SubmitShiftsAvailabilityRequest => ({ workspaceId, ...toAvailabilityFields(input) })

/** Maps the GraphQL input to the availability removal request of the workspace it names. */
export const toRemoveShiftsAvailabilityRequest = (
    workspaceId: string,
    input: ShiftsAvailabilityRefInput,
): RemoveShiftsAvailabilityRequest => ({ workspaceId, id: input.id })

/** Maps the GraphQL input to the availability decision request of the workspace it names. */
export const toDecideShiftsAvailabilityRequest = (
    workspaceId: string,
    input: DecideShiftsAvailabilityInput,
): DecideShiftsAvailabilityRequest => ({ workspaceId, ...input })

/** Maps the GraphQL input to the check-in request of the workspace it names. */
export const toCheckInShiftsRequest = (workspaceId: string, input: ShiftsShiftRefInput): CheckInShiftsRequest => ({
    workspaceId,
    shiftId: input.shiftId,
})

/** Maps the quick import outcome to the GraphQL type. */
export const toApplyImportType = (result: ApplyImportOutput): ApplyImportType => ({
    positions: result.positions,
    staff: result.staff,
    blocks: result.blocks,
})

/** Maps an id answer to the GraphQL type. */
export const toShiftsRefType = (
    result: SavePositionOutput | SaveStaffOutput | SaveShiftsAvailabilityOutput,
): ShiftsRefType => ({ id: result.id })

/** Maps the check-in outcome to the GraphQL type. */
export const toCheckInType = (result: CheckInOutput): CheckInType => ({ at: result.at })
