import { Module } from "@nestjs/common"
import { DeductStep } from "./steps/deduct.step"
import { ReplenishStep } from "./steps/replenish.step"
import { RunInventoryCommandStep } from "./steps/run-inventory-command.step"
import { RunShiftsCommandStep } from "./steps/run-shifts-command.step"

const STEPS = [DeductStep, ReplenishStep, RunInventoryCommandStep, RunShiftsCommandStep]

@Module({ providers: STEPS, exports: STEPS })
/** The application of the operations jobs: the steps of the inventory and shifts jobs; the queue transport module imports it. */
export class OperationsJobsModule {}
