import { Module } from "@nestjs/common"
import type { DynamicModule, Type } from "@nestjs/common"
import { SepayNativeService } from "@modules/domain/mcp-gateway"
import type { NativeAdapter } from "@modules/domain/mcp-gateway"
import { BrainNativeService } from "./brain-native.service"
import { DossierNativeService } from "./dossier-native.service"
import { DriveNativeService } from "./drive-native.service"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./native-tools.module-definition"
import { NativeViewService } from "./native-view.service"
import { ProviderToolsService } from "./provider-tools.service"
import { SepayStatusNativeService } from "./sepay-status-native.service"
import { TelegramNativeService } from "./telegram-native.service"
import { ZaloNativeService } from "./zalo-native.service"

/**
 * The native tools NIVO builds, as the classes an app passes to the gateway's `natives` option: the Brain, the dossiers, Google
 * Drive, Telegram, Zalo OA and SePay with its status. The SePay one takes the place of the gateway's own SePay adapter.
 */
export const NATIVE_TOOL_ADAPTERS: ReadonlyArray<Type<NativeAdapter>> = [
    BrainNativeService,
    DossierNativeService,
    DriveNativeService,
    TelegramNativeService,
    ZaloNativeService,
    SepayStatusNativeService,
]

@Module({})
/**
 * The read tools of the NIVO MCP door beyond the bank and e-invoice ones: they answer what the business knows and how its providers
 * stand, never more than the view of the calling agent. The app registers it globally and passes `NATIVE_TOOL_ADAPTERS` to the gateway.
 */
export class NativeToolsModule extends ConfigurableModuleClass {
    /** Registers the capability once per app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [
                ...(base.providers ?? []),
                NativeViewService,
                ProviderToolsService,
                SepayNativeService,
                ...NATIVE_TOOL_ADAPTERS,
            ],
            exports: [...NATIVE_TOOL_ADAPTERS],
        }
    }
}
