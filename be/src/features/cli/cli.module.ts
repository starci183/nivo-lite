import { Module } from "@nestjs/common"
import { MigrateModule } from "./migrate/migrate.module"
import { SeedModule } from "./seed/seed.module"
import { SeedModulesModule } from "./seed-modules/seed-modules.module"

@Module({ imports: [MigrateModule, SeedModule, SeedModulesModule] })
/** The cli feature root: every command group of the back end, compiled only into apps/cli. */
export class CliModule {}
