import { Module } from "@nestjs/common"
import { SimulateSepayCli } from "./simulate-sepay.cli"
import { ConfigurableModuleClass } from "./simulate-sepay.module-definition"
import { RunSimulateSepayCli } from "./subs/run.cli"

@Module({ providers: [SimulateSepayCli, RunSimulateSepayCli] })
/** The SePay simulation group: the command that posts a simulated bank credit. */
export class SimulateSepayModule extends ConfigurableModuleClass {}
