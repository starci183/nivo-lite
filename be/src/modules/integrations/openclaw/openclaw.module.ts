import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { AgentRegistryService } from "./agent-registry.service"
import { GatewayClient } from "./gateway.client"
import { createGatewaySocket } from "./gateway-socket.client"
import { NodeFilesClient } from "./node-files.client"
import { OPENCLAW_FILES, OPENCLAW_OPTIONS, OPENCLAW_SOCKET_FACTORY } from "./openclaw.decorators"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./openclaw.module-definition"
import { ToolTokenService } from "./tool-token.service"
import { WorkspaceWriterService } from "./workspace-writer.service"

@Module({})
/** The OpenClaw integration: the gateway client, the agent registry, the workspace writer and the tool tokens. */
export class OpenclawModule extends ConfigurableModuleClass {
    /** Registers the integration once per app that talks to OpenClaw. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        const { isGlobal: _isGlobal, ...parsed } = options
        return {
            ...base,
            providers: [
                ...(base.providers ?? []),
                { provide: OPENCLAW_OPTIONS, useValue: parsed },
                { provide: OPENCLAW_SOCKET_FACTORY, useValue: createGatewaySocket },
                { provide: OPENCLAW_FILES, useClass: NodeFilesClient },
                GatewayClient,
                AgentRegistryService,
                WorkspaceWriterService,
                ToolTokenService,
            ],
            exports: [GatewayClient, AgentRegistryService, WorkspaceWriterService, ToolTokenService],
        }
    }
}
