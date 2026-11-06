import { Module } from "@nestjs/common"
import { SeedBrainCli } from "./seed-brain.cli"
import { ConfigurableModuleClass } from "./seed-brain.module-definition"

@Module({ providers: [SeedBrainCli] })
/** The seed-brain command over the brain seed of the channel-provisioning capability. */
export class SeedBrainModule extends ConfigurableModuleClass {}
