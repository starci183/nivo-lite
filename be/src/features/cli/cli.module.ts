import { Module } from "@nestjs/common"
import { MigrateModule } from "./migrate/migrate.module"
import { SeedModule } from "./seed/seed.module"
import { SeedAutomationsModule } from "./seed-automations/seed-automations.module"
import { SyncN8nModule } from "./sync-n8n/sync-n8n.module"

@Module({ imports: [MigrateModule, SeedModule, SeedAutomationsModule, SyncN8nModule] })
/** The cli feature root: every command group of the back end, compiled only into apps/cli. */
export class CliModule {}
