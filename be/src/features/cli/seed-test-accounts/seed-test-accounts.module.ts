import { Module } from "@nestjs/common"
import { SeedTestAccountsCli } from "./seed-test-accounts.cli"
import { ConfigurableModuleClass } from "./seed-test-accounts.module-definition"

@Module({ providers: [SeedTestAccountsCli] })
/** The seed-test-accounts command over the test-accounts seed of the channel-provisioning capability. */
export class SeedTestAccountsModule extends ConfigurableModuleClass {}
