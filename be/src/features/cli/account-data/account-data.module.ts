import { Module } from "@nestjs/common"
import { AccountDataCli } from "./account-data.cli"
import { ConfigurableModuleClass } from "./account-data.module-definition"
import { PlanAccountDataCli } from "./subs/plan.cli"

@Module({ providers: [AccountDataCli, PlanAccountDataCli] })
/** The account-data group: the command and its sub-command over the account-data planner the cli app registers globally. */
export class AccountDataCliModule extends ConfigurableModuleClass {}
