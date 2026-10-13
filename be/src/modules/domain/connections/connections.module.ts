import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./connections.module-definition"
import { ConnectionsService } from "./connections.service"

@Module({})
/** The status facts of a workspace's connections over the primary Supabase PostgreSQL connection. */
export class ConnectionsModule extends ConfigurableModuleClass {
    /** Registers the capability once in the API app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []), ConnectionsService],
            exports: [ConnectionsService],
        }
    }
}
