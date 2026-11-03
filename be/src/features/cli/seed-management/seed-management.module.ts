import { Module } from "@nestjs/common"
import { SeedManagementCli } from "./seed-management.cli"
import { ConfigurableModuleClass } from "./seed-management.module-definition"

@Module({ providers: [SeedManagementCli] })
/** The seed-management command over the management seed of the channel-provisioning capability. */
export class SeedManagementModule extends ConfigurableModuleClass {}
