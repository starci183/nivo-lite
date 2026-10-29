import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { ConnectorInterestModule } from "@modules/domain/connector-interest"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./connections.module-definition"
import { ConnectionsUpkeepService } from "./connections-upkeep.service"
import { ConnectionsService } from "./connections.service"
import { ConnectionsAdminReadService } from "./connections-admin-read.service"
import { CONNECTION_AGENTS } from "./connections.decorators"
import { ConnectionBindingsReadService } from "./connection-bindings-read.service"
import { ConnectionSecretReadsService } from "./connection-secret-reads.service"

@Module({})
/** The connections capability over the primary Supabase PostgreSQL connection. */
export class ConnectionsModule extends ConfigurableModuleClass {
    /** Registers the capability once in the API app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            imports: [...(base.imports ?? []), ConnectorInterestModule.register({})],
            providers: [
                ...(base.providers ?? []),
                ConnectionsAdminReadService,
                ConnectionSecretReadsService,
                ConnectionBindingsReadService,
                options.ports === undefined
                    ? { provide: CONNECTION_AGENTS, useValue: null }
                    : { provide: CONNECTION_AGENTS, useExisting: options.ports.agents },
                ConnectionsService,
                ConnectionsUpkeepService,
            ],
            exports: [
                ConnectionsAdminReadService,
                ConnectionSecretReadsService,
                ConnectionBindingsReadService,
                ConnectionsService,
            ],
        }
    }
}
