import { Module } from "@nestjs/common"
import { SeedAutomationsCli } from "./seed-automations.cli"
import { RunSeedAutomationsCli } from "./subs/run.cli"

@Module({ providers: [SeedAutomationsCli, RunSeedAutomationsCli] })
/** The seed-automations group: the command and its one run that syncs the catalogue; the catalogue capability is composed by the cli app. */
export class SeedAutomationsModule {}
