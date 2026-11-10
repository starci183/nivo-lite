import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { McpConnectorsModule } from "@modules/domain/mcp-connectors"
import { McpGatewayReceiptsModule } from "@modules/domain/mcp-gateway-receipts"
import { McpToolGrantsModule } from "@modules/domain/mcp-tool-grants"
import { McpModule } from "@modules/integrations/mcp"
import { EffectToolsService } from "./adapters/effect-tools.service"
import { EinvoiceNativeService } from "./adapters/einvoice-native.service"
import { ConnectionKeyCheckService } from "./connection-key-check.service"
import { ProviderAbilitiesService } from "./provider-abilities.service"
import { SepayNativeService } from "./adapters/sepay-native.service"
import { GatewaySurfaceService } from "./gateway-surface.service"
import { withEffectTools, withoutShadowed } from "./native-adapters.policy"
import { McpConnectorCredentialService } from "./mcp-connector-credential.service"
import { McpGatewayAdminService } from "./mcp-gateway-admin.service"
import type { NativeAdapter } from "./mcp-gateway.contracts"
import { NATIVE_ADAPTERS } from "./mcp-gateway.decorators"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./mcp-gateway.module-definition"
import { McpGatewayService } from "./mcp-gateway.service"
import { NativeRunnerService } from "./native-runner.service"

@Module({})
/**
 * The NIVO MCP gateway: the connector registry (native adapters in code, remote MCP servers per workspace), the grants, the
 * approval gate, the audit, the time limits and the breakers. The mcp app serves it as one MCP endpoint per workspace; the api's
 * chat turns and performers call the same service in process, so enforcement lives in one place. The rows live in the table
 * capabilities it composes (mcp-connectors, mcp-tool-grants, mcp-call-log, mcp-gateway-receipts); the SePay connector reads through transactions. A
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
                McpGatewayReceiptsModule.register({}),
            ],
            providers: [
                ...(base.providers ?? []),
                SepayNativeService,
                EinvoiceNativeService,
                EffectToolsService,
                {
                    provide: NATIVE_ADAPTERS,
                    useFactory: (effectTools: EffectToolsService, ...adapters: ReadonlyArray<NativeAdapter>) =>
                        withEffectTools(withoutShadowed(adapters), effectTools.adapters()),
                    inject: [EffectToolsService, SepayNativeService, EinvoiceNativeService, ...(options.natives ?? [])],
                },
                McpConnectorCredentialService,
                NativeRunnerService,
                McpGatewayService,
                ProviderAbilitiesService,
                ...admin,
                ...keyCheck,
                GatewaySurfaceService,
            ],
            exports: [McpGatewayService, ProviderAbilitiesService, ...admin, GatewaySurfaceService],
        }
    }
}
