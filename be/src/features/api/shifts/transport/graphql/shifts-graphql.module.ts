import { Module } from "@nestjs/common"
import { ShiftsApiModule } from "../../shifts.module"
import { AddShiftsAvailabilityResolver } from "./add-shifts-availability.resolver"
import { AddShiftsDraftShiftResolver } from "./add-shifts-draft-shift.resolver"
import { ApplyShiftsImportResolver } from "./apply-shifts-import.resolver"
import { CheckInShiftsResolver } from "./check-in-shifts.resolver"
import { DecideShiftsAvailabilityResolver } from "./decide-shifts-availability.resolver"
import { ExplainShiftsScheduleResolver } from "./explain-shifts-schedule.resolver"
import { ProposeShiftsWeekResolver } from "./propose-shifts-week.resolver"
import { ReassignShiftsShiftResolver } from "./reassign-shifts-shift.resolver"
import { RemoveShiftsAvailabilityResolver } from "./remove-shifts-availability.resolver"
import { RemoveShiftsCoverageResolver } from "./remove-shifts-coverage.resolver"
import { RemoveShiftsDraftShiftResolver } from "./remove-shifts-draft-shift.resolver"
import { RemoveShiftsPositionResolver } from "./remove-shifts-position.resolver"
import { RequestShiftsLeaveResolver } from "./request-shifts-leave.resolver"
import { RequestShiftsPublishResolver } from "./request-shifts-publish.resolver"
import { RequestShiftsSwapResolver } from "./request-shifts-swap.resolver"
import { SaveShiftsCoverageResolver } from "./save-shifts-coverage.resolver"
import { SaveShiftsPositionResolver } from "./save-shifts-position.resolver"
import { SaveShiftsSettingsResolver } from "./save-shifts-settings.resolver"
import { SaveShiftsStaffResolver } from "./save-shifts-staff.resolver"
import { ShiftsMineResolver } from "./shifts-mine.resolver"
import { ShiftsWorkbenchResolver } from "./shifts-workbench.resolver"
import { SubmitShiftsAvailabilityResolver } from "./submit-shifts-availability.resolver"

@Module({
    imports: [ShiftsApiModule],
    providers: [
        AddShiftsAvailabilityResolver,
        AddShiftsDraftShiftResolver,
        ApplyShiftsImportResolver,
        CheckInShiftsResolver,
        DecideShiftsAvailabilityResolver,
        ExplainShiftsScheduleResolver,
        ProposeShiftsWeekResolver,
        ReassignShiftsShiftResolver,
        RemoveShiftsAvailabilityResolver,
        RemoveShiftsCoverageResolver,
        RemoveShiftsDraftShiftResolver,
        RemoveShiftsPositionResolver,
        RequestShiftsLeaveResolver,
        RequestShiftsPublishResolver,
        RequestShiftsSwapResolver,
        SaveShiftsCoverageResolver,
        SaveShiftsPositionResolver,
        SaveShiftsSettingsResolver,
        SaveShiftsStaffResolver,
        ShiftsMineResolver,
        ShiftsWorkbenchResolver,
        SubmitShiftsAvailabilityResolver,
    ],
})
/** The GraphQL transport of the shifts feature. */
export class ShiftsGraphqlModule {}
