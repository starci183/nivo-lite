import { Module } from "@nestjs/common"
import { SeedEnterpriseCli } from "./seed-enterprise.cli"
import { ConfigurableModuleClass } from "./seed-enterprise.module-definition"
import { EnterpriseRemoveCli } from "./subs/remove.cli"
import { EnterpriseRunCli } from "./subs/run.cli"

@Module({ providers: [SeedEnterpriseCli, EnterpriseRunCli, EnterpriseRemoveCli] })
/** The seed-enterprise group: its command and its sub-commands; the work is the enterprise seed of channel-provisioning. */
export class SeedEnterpriseModule extends ConfigurableModuleClass {}
