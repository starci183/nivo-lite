import { Module } from "@nestjs/common"
import { SeedRecordsCli } from "./seed-records.cli"
import { ConfigurableModuleClass } from "./seed-records.module-definition"

@Module({ providers: [SeedRecordsCli] })
/** The seed-records command over the records seed of the channel-provisioning capability. */
export class SeedRecordsModule extends ConfigurableModuleClass {}
