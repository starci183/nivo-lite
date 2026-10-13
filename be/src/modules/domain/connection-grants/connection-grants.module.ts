import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { AgentAccessLogModule } from "@modules/domain/agent-access-log"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./connection-grants.module-definition"
import { ConnectionGrantsService } from "./connection-grants.service"

@Module({})
/** The agent access to connections, over the primary Supabase PostgreSQL connection. */
export class ConnectionGrantsModule extends ConfigurableModuleClass {
    /** Registers the capability once in the API app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            imports: [...(base.imports ?? []), AgentAccessLogModule.register({})],
            providers: [...(base.providers ?? []), ConnectionGrantsService],
            exports: [ConnectionGrantsService],
        }
    }
}
