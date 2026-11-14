import { Module, type DynamicModule } from "@nestjs/common"
import { ToolReceiptsModule } from "@modules/domain/tool-receipts"
import { ToolGrantsModule } from "@modules/domain/tool-grants"
import { EffectToolsService } from "./adapters/effect-tools.service"
import { EinvoiceNativeService } from "./adapters/einvoice-native.service"
import { EffectRightAuditService } from "./effect-right-audit.service"
import { AgentAccountsService } from "./agent-accounts.service"
import { SepayNativeService } from "./adapters/sepay-native.service"
import { withEffectTools, withoutShadowed } from "./tool-families.policy"
import { withUniqueNames } from "./tool-name.policy"
import { ToolsConsoleService } from "./tools-console.service"
import type { NativeToolFamily } from "./tools.contracts"
import { NATIVE_TOOL_FAMILIES } from "./tools.decorators"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./tools.module-definition"
import { ToolRegistryService } from "./tool-registry.service"
import { NativeRunnerService } from "./native-runner.service"

@Module({})
/**
 * The engine's tools: the registry of the tool families in code (the engine's own and the provider adapters'), the rights, the ledger
 * once, the audit, the time limits and the breakers. Graph nodes reach it directly through the node tool door and the tool runner; the
 * outbound mcp app serves the same registry, so enforcement lives in one place. The rows live in the table capabilities it composes
 * (tool-grants, tool-call-log, tool-receipts); NIVO calls no MCP server.
 */
export class ToolsModule extends ConfigurableModuleClass {
    /** Registers the gateway once per app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        // The console's service: the accounts board, the grant rows and the audit log.
        const admin = options.console === true ? [ToolsConsoleService] : []
        // The grant stores are the gateway's sub-module; it hands them on, so a capability that reads them needs no second import.
        const grantStores = ToolGrantsModule.register({})
        return {
            ...base,
            imports: [
                ...(base.imports ?? []),
                grantStores,
                ToolReceiptsModule.register({}),
            ],
            providers: [
                ...(base.providers ?? []),
                SepayNativeService,
                EinvoiceNativeService,
                EffectToolsService,
                {
                    provide: NATIVE_TOOL_FAMILIES,
                    useFactory: (effectTools: EffectToolsService, ...adapters: ReadonlyArray<NativeToolFamily>) =>
                        withUniqueNames(withEffectTools(withoutShadowed(adapters), effectTools.adapters())),
                    inject: [EffectToolsService, SepayNativeService, EinvoiceNativeService, ...(options.natives ?? [])],
                },
                NativeRunnerService,
                ToolRegistryService,
                // The audit line of an effect's rights verdict: a leaf (the call log and the logger), held by the accounts judge.
                EffectRightAuditService,
                AgentAccountsService,
                ...admin,
            ],
            exports: [
                ToolRegistryService,
                AgentAccountsService,
                ...admin,
                grantStores,
            ],
        }
    }
}
