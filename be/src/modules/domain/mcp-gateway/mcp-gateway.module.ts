import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { McpCallLogModule } from "@modules/domain/mcp-call-log"
import { McpConnectorsModule } from "@modules/domain/mcp-connectors"
import { McpToolGrantsModule } from "@modules/domain/mcp-tool-grants"
import { McpModule } from "@modules/integrations/mcp"
import { EinvoiceNativeService } from "./adapters/einvoice-native.service"
import { ConnectionKeyCheckService } from "./connection-key-check.service"
import { SepayNativeService } from "./adapters/sepay-native.service"
import { GatewaySurfaceService } from "./gateway-surface.service"
import { McpConnectorCredentialService } from "./mcp-connector-credential.service"
import { McpGatewayAdminService } from "./mcp-gateway-admin.service"
import { NATIVE_ADAPTERS } from "./mcp-gateway.decorators"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./mcp-gateway.module-definition"
import { McpGatewayService } from "./mcp-gateway.service"

@Module({})
/**
 * The NIVO MCP gateway: the connector registry (native adapters in code, remote MCP servers per workspace), the grants, the
 * approval gate, the audit, the time limits and the breakers. The mcp app serves it as one MCP endpoint per workspace; the api's
 * chat turns and performers call the same service in process, so enforcement lives in one place. The rows live in the table
 * capabilities it composes (mcp-connectors, mcp-tool-grants, mcp-call-log); the SePay connector reads through transactions. A
 * remote connector's credential is sealed in its row with the connection key: the app registers connection-secrets globally.
 */
export class McpGatewayModule extends ConfigurableModuleClass {
    /** Registers the gateway once per app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        const admin = options.console === true ? [McpGatewayAdminService] : []
        const keyCheck = options.keyCheck === true ? [ConnectionKeyCheckService] : []
        return {
            ...base,
            imports: [
                ...(base.imports ?? []),
                McpModule.register({ isGlobal: false, ...options.remote }),
                McpConnectorsModule.register({}),
                McpToolGrantsModule.register({}),
                McpCallLogModule.register({}),
            ],
            providers: [
                ...(base.providers ?? []),
                SepayNativeService,
                EinvoiceNativeService,
                {
                    provide: NATIVE_ADAPTERS,
                    useFactory: (sepay: SepayNativeService, einvoice: EinvoiceNativeService) => [sepay, einvoice],
                    inject: [SepayNativeService, EinvoiceNativeService],
                },
                McpConnectorCredentialService,
                McpGatewayService,
                ...admin,
                ...keyCheck,
                GatewaySurfaceService,
            ],
            exports: [McpGatewayService, ...admin, GatewaySurfaceService],
        }
    }
}
