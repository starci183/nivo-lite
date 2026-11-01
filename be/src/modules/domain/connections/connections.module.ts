import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { ConnectorInterestModule } from "@modules/domain/connector-interest"
import { noAgentIds } from "./connection-agents.policy"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./connections.module-definition"
import { ConnectionsUpkeepService } from "./connections-upkeep.service"
import { ConnectionsService } from "./connections.service"
import { ConnectionsAdminReadService } from "./connections-admin-read.service"
import { CONNECTION_AGENTS } from "./connections.decorators"
import { ConnectionBindingsReadService } from "./connection-bindings-read.service"
import { ConnectionSecretReadsService } from "./connection-secret-reads.service"

@Module({})
/** The connections capability over the primary PostgreSQL connection. */
export class ConnectionsModule extends ConfigurableModuleClass {
    /** Registers the read-only mode (the mcp app): the bindings read alone, with no storage and nothing that calls a provider. */
    static readOnly(options: Extract<typeof OPTIONS_TYPE, { readonly readOnly: true }>): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []), ConnectionBindingsReadService],
            exports: [ConnectionBindingsReadService],
        }
    }

    /** Registers the capability once in the API app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        const ports = "ports" in options ? options.ports : undefined
        return {
            ...base,
            imports: [...(base.imports ?? []), ConnectorInterestModule.register({})],
            providers: [
                ...(base.providers ?? []),
                ConnectionsAdminReadService,
                ConnectionSecretReadsService,
                ConnectionBindingsReadService,
                ports === undefined
                    ? { provide: CONNECTION_AGENTS, useValue: { agentIdsOf: noAgentIds } }
                    : { provide: CONNECTION_AGENTS, useExisting: ports.agents },
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
