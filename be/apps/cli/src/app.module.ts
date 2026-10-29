import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import type { CliAppOptions } from "./cli.options"
import { cliModules } from "./compose/modules"
import { cliSetupModules } from "./compose/setup"

@Module({})
/**
 * The composition root of the cli: the clock and the logger every command logs through, the database capability over every
 * connection, own-auth account administration, the workspace capabilities (demo seed and prune), and the cli feature root.
 */
export class AppModule {
    /** Builds the cli from its parsed options. */
    static register(options: CliAppOptions): DynamicModule {
        return {
            module: AppModule,
            imports: [...cliModules(options), ...cliSetupModules(options)],
        }
    }
}
