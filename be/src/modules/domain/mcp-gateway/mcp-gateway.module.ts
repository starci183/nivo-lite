import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { McpModule } from "@modules/integrations/mcp"
import { EinvoiceNativeAdapter } from "./adapters/einvoice-native.adapter"
import { SepayNativeAdapter } from "./adapters/sepay-native.adapter"
import { GatewaySurfaceService } from "./gateway-surface.service"
import { McpGatewayAdminService } from "./mcp-gateway-admin.service"
import { NATIVE_ADAPTERS } from "./mcp-gateway.decorators"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./mcp-gateway.module-definition"
import { McpGatewayService } from "./mcp-gateway.service"

@Module({})
/**
 * The NIVO MCP gateway: the connector registry (native adapters in code, remote MCP servers per workspace), the grants, the
 * approval gate, the audit, the time limits and the breakers. The mcp app serves it as one MCP endpoint per workspace; the api's
 * chat turns and performers call the same service in process, so enforcement lives in one place.
 */
export class McpGatewayModule extends ConfigurableModuleClass {
    /** Registers the gateway once per app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        const admin = options.console === true ? [McpGatewayAdminService] : []
        return {
            ...base,
            imports: [...(base.imports ?? []), McpModule.register({ isGlobal: false })],
            providers: [
                ...(base.providers ?? []),
                SepayNativeAdapter,
                EinvoiceNativeAdapter,
                {
                    provide: NATIVE_ADAPTERS,
                    useFactory: (sepay: SepayNativeAdapter, einvoice: EinvoiceNativeAdapter) => [sepay, einvoice],
                    inject: [SepayNativeAdapter, EinvoiceNativeAdapter],
                },
                McpGatewayService,
                ...admin,
                GatewaySurfaceService,
            ],
            exports: [McpGatewayService, ...admin, GatewaySurfaceService],
        }
    }
}
