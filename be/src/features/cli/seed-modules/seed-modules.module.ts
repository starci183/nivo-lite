import { Module } from "@nestjs/common"
import { SeedModulesCli } from "./seed-modules.cli"
import { ConfigurableModuleClass } from "./seed-modules.module-definition"
import { RunSeedModulesCli } from "./subs/run.cli"

@Module({ providers: [SeedModulesCli, RunSeedModulesCli] })
/** The catalogue seed group: the command that mirrors the module catalogue into public.modules. */
export class SeedModulesModule extends ConfigurableModuleClass {}
