import { Module } from "@nestjs/common"
import { AddShiftsAvailabilityHandler } from "./application/add-shifts-availability.handler"
import { AddShiftsDraftShiftHandler } from "./application/add-shifts-draft-shift.handler"
import { ApplyShiftsImportHandler } from "./application/apply-shifts-import.handler"
import { CheckInShiftsHandler } from "./application/check-in-shifts.handler"
import { DecideShiftsAvailabilityHandler } from "./application/decide-shifts-availability.handler"
import { ExplainShiftsScheduleHandler } from "./application/explain-shifts-schedule.handler"
import { PreviewShiftsImportHandler } from "./application/preview-shifts-import.handler"
import { ProposeShiftsWeekHandler } from "./application/propose-shifts-week.handler"
import { ReassignShiftsShiftHandler } from "./application/reassign-shifts-shift.handler"
import { RemoveShiftsAvailabilityHandler } from "./application/remove-shifts-availability.handler"
import { RemoveShiftsCoverageHandler } from "./application/remove-shifts-coverage.handler"
import { RemoveShiftsDraftShiftHandler } from "./application/remove-shifts-draft-shift.handler"
import { RemoveShiftsPositionHandler } from "./application/remove-shifts-position.handler"
import { RequestShiftsLeaveHandler } from "./application/request-shifts-leave.handler"
import { RequestShiftsPublishHandler } from "./application/request-shifts-publish.handler"
import { RequestShiftsSwapHandler } from "./application/request-shifts-swap.handler"
import { SaveShiftsCoverageHandler } from "./application/save-shifts-coverage.handler"
import { SaveShiftsPositionHandler } from "./application/save-shifts-position.handler"
import { SaveShiftsSettingsHandler } from "./application/save-shifts-settings.handler"
import { SaveShiftsStaffHandler } from "./application/save-shifts-staff.handler"
import { ShiftsMineHandler } from "./application/shifts-mine.handler"
import { ShiftsWorkbenchHandler } from "./application/shifts-workbench.handler"
import { SubmitShiftsAvailabilityHandler } from "./application/submit-shifts-availability.handler"

@Module({
    providers: [
        AddShiftsAvailabilityHandler,
        AddShiftsDraftShiftHandler,
        ApplyShiftsImportHandler,
        CheckInShiftsHandler,
        DecideShiftsAvailabilityHandler,
        ExplainShiftsScheduleHandler,
        PreviewShiftsImportHandler,
        ProposeShiftsWeekHandler,
        ReassignShiftsShiftHandler,
        RemoveShiftsAvailabilityHandler,
        RemoveShiftsCoverageHandler,
        RemoveShiftsDraftShiftHandler,
        RemoveShiftsPositionHandler,
        RequestShiftsLeaveHandler,
        RequestShiftsPublishHandler,
        RequestShiftsSwapHandler,
        SaveShiftsCoverageHandler,
        SaveShiftsPositionHandler,
        SaveShiftsSettingsHandler,
        SaveShiftsStaffHandler,
        ShiftsMineHandler,
        ShiftsWorkbenchHandler,
        SubmitShiftsAvailabilityHandler,
    ],
})
/** The shifts feature: the handlers of its application. */
export class ShiftsApiModule {}
