import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { AgentRegistryService } from "./agent-registry.service"
import { GatewayAdminClient } from "./gateway-admin.client"
import { GatewayClient } from "./gateway.client"
import { createGatewaySocket } from "./gateway-socket.client"
import { NodeFilesClient } from "./node-files.client"
import {
    OPENCLAW_AGENT_REGISTRY,
    OPENCLAW_FILES,
    OPENCLAW_GATEWAY,
    OPENCLAW_GATEWAY_ADMIN,
    OPENCLAW_OPTIONS,
    OPENCLAW_SOCKET_FACTORY,
    OPENCLAW_WORKSPACE_WRITER,
} from "./openclaw.decorators"
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
                GatewayAdminClient,
                AgentRegistryService,
                WorkspaceWriterService,
                ToolTokenService,
                { provide: OPENCLAW_GATEWAY, useExisting: GatewayClient },
                { provide: OPENCLAW_GATEWAY_ADMIN, useExisting: GatewayAdminClient },
                { provide: OPENCLAW_AGENT_REGISTRY, useExisting: AgentRegistryService },
                { provide: OPENCLAW_WORKSPACE_WRITER, useExisting: WorkspaceWriterService },
            ],
            exports: [
                GatewayClient,
                AgentRegistryService,
                WorkspaceWriterService,
                ToolTokenService,
                OPENCLAW_GATEWAY,
                OPENCLAW_GATEWAY_ADMIN,
                OPENCLAW_AGENT_REGISTRY,
                OPENCLAW_WORKSPACE_WRITER,
            ],
        }
    }
}
