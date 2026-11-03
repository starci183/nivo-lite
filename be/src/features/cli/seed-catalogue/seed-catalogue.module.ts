import { Module } from "@nestjs/common"
import { SeedCatalogueCli } from "./seed-catalogue.cli"
import { ConfigurableModuleClass } from "./seed-catalogue.module-definition"

@Module({ providers: [SeedCatalogueCli] })
/** The seed-catalogue command over the catalogue seed of the channel-provisioning capability. */
export class SeedCatalogueModule extends ConfigurableModuleClass {}
