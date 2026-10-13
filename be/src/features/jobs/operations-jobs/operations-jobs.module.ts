import { Module } from "@nestjs/common"
import { DeductStep } from "./steps/deduct.step"
import { RunHiringTickStep } from "./steps/run-hiring-tick.step"
import { ReplenishStep } from "./steps/replenish.step"

const STEPS = [DeductStep, ReplenishStep, RunHiringTickStep]

@Module({ providers: STEPS, exports: STEPS })
/** The application of the operations jobs: the steps of the inventory and shifts jobs; the queue transport module imports it. */
export class OperationsJobsModule {}
