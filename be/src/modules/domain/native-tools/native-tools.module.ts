import { Module, type DynamicModule, type Type } from "@nestjs/common"
import { SepayNativeService, type NativeToolFamily } from "@modules/domain/tools"
import { ContactToolsNativeService } from "@modules/domain/contact-tools"
import { DomainToolsService } from "@modules/domain/domain-tools"
import { InvoiceToolsService } from "@modules/domain/invoice-tools"
import { MediaNativeService, PROVIDER_FILE_SINK } from "@modules/domain/media-tools"
import { PaymentLinkNativeService, PaymentNativeService } from "@modules/domain/payment-tools"
import { TimerNativeService } from "@modules/domain/timer-tools"
import { AgentTasksService, AgentWorkAccessService } from "@modules/domain/agent-work"
import { CalendarNativeService } from "@modules/domain/calendar-tools"
import { FacebookNativeService, InstagramNativeService, TiktokNativeService, YoutubeNativeService } from "@modules/domain/social-tools"
import { INTERFACE_READ_PROVIDERS, PROVIDER_REGISTRY_READS_PORT, type InterfaceReadProvider } from "@modules/domain/workbench-door"
import { ProviderRegistryReadsService } from "./provider-registry-reads.service"
import { AccountInfoService } from "./account-info.service"
import { BankNativeService } from "./bank-native.service"
import { BrainNativeService } from "./brain-native.service"
import { BrainProbeService } from "./brain-probe.service"
import { NivoNativeService } from "./nivo-native.service"
import { OpenApiNativeService } from "./openapi-connection-native.service"
import { OpenApiLiveReachService } from "./openapi-live-reach.service"
import { OpenApiReachRegistrationService } from "./openapi-reach-registration.service"
import { OpenApiInterfaceReadsService } from "./openapi-workbench.service"
import { PassageNativeService } from "./passage-native.service"
import { PluginToolsNativeService } from "./plugin-tools-native.service"
import { DriveNativeService } from "./drive-native.service"
import { LedgerNativeService } from "./ledger-native.service"
import { MailNativeService } from "./mail-native.service"
import { MailSendNativeService } from "./mail-send-native.service"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./native-tools.module-definition"
import { NativeViewService } from "./native-view.service"
import { ProviderToolsService } from "./provider-tools.service"
import { ConnectionStatusNativeService } from "./connection-status-native.service"
import { FileNativeService } from "./file-native.service"
import { RecordNativeService } from "./record-native.service"
import { SepayRecordsNativeService } from "./sepay-records-native.service"

/**
 * The native tools NIVO builds, as the classes an app passes to the gateway's `natives` option: the Brain, Google
 * Drive (`nivo.tool.drive.*`), the status of every provider's accounts (`nivo.tool.connection.status.get`), NIVO's record of bank moves
 * (`nivo.tool.payment.credit.list`, `nivo.tool.payment.debit.list`, judged for internal callers), the Brain's document reads (`nivo.tool.brain.passage.*`: search, then read), plus the provider-neutral capability `nivo.tool.bank.transaction.list` and the attached mailboxes' mails (`nivo.tool.mail.message.*`, read from the hub, never the server) and the tools the installed plugins declare under their OpenAPI connection's namespace (a CRM's generated operations `nivo.api.crm.<crmId>.…`), run against the workspace's CRM connection that pinned the CRM's OpenAPI document. The record of bank moves takes the place of the gateway's own SePay adapter (the same connector key).
 * `nivo` holds the context reads the installed plugins serve through `PLUGIN_TOOLS` (the thread read `nivo.tool.conversation.message.list` among them, the chatbot module's own), hard-locked to the run's own conversation and customer.
 * `contacts` holds the engine's person tools (`nivo.tool.contact.*`): the run's contact, lookups, name and tags, memory, identities (an
 * outside system's customer id on a person's approval) and merges.
 * The generic provider purposes run through the provider registry, never naming a provider: the domains (`nivo.tool.domain.*`, any
 * registrar), the e-invoice issue (`nivo.tool.invoice.create`, any e-invoice provider: owner ruling R57), speech, dubbing and video (`nivo.tool.speech.*`, `nivo.tool.dubbing.*`, `nivo.tool.video.generate` / `.generation.get`) and the
 * calendar (`nivo.tool.calendar.*`); the destinations Facebook, Instagram, YouTube and TikTok (`nivo.tool.facebook.*`, `.instagram.*`,
 * `.youtube.*`, `.tiktok.*`) are NIVO's own adapters that run on the account of their owner provider.
 * `nivo.tool.record.*` reads and writes the records of the record types a package declares, and `nivo.tool.file.*` puts and links the
 * files of their `file` fields, both confined to the records of the calling agent.
 */
export const NATIVE_TOOL_ADAPTERS: ReadonlyArray<Type<NativeToolFamily>> = [
    BrainNativeService,
    PassageNativeService,
    DriveNativeService,
    ConnectionStatusNativeService,
    SepayRecordsNativeService,
    BankNativeService,
    LedgerNativeService,
    MailNativeService,
    MailSendNativeService,
    OpenApiNativeService,
    NivoNativeService,
    ContactToolsNativeService,
    DomainToolsService,
    InvoiceToolsService,
    MediaNativeService,
    PaymentNativeService,
    PaymentLinkNativeService,
    TimerNativeService,
    CalendarNativeService,
    FacebookNativeService,
    InstagramNativeService,
    YoutubeNativeService,
    TiktokNativeService,
    RecordNativeService,
    FileNativeService,
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
                PluginToolsNativeService,
                ProviderToolsService,
                SepayNativeService,
                // The timers keep an armed timer as one task of the agent (the engine's task store): the store is provided here too, because the
                // mcp app, where agent runs execute, does not compose the agent-work capability (the service is stateless: a plain writer of agent_tasks).
                AgentWorkAccessService,
                AgentTasksService,
                ...NATIVE_TOOL_ADAPTERS,
                ...(options.fileSink === undefined ? [] : [options.fileSink, { provide: PROVIDER_FILE_SINK, useExisting: options.fileSink }]),
                OpenApiInterfaceReadsService,
                // How an API account is reached: the live reach of this app, registered with the sandbox twin on the OpenAPI provider's registry.
                OpenApiLiveReachService,
                OpenApiReachRegistrationService,
                AccountInfoService,
                ProviderRegistryReadsService,
                // The owner's probe of the Brain reads (`BrainProbeService`): the same families, run with no model turn.
                BrainProbeService,
                { provide: PROVIDER_REGISTRY_READS_PORT, useExisting: ProviderRegistryReadsService },
                {
                    provide: INTERFACE_READ_PROVIDERS,
                    useFactory: (
                        openapi: OpenApiInterfaceReadsService,
                        accounts: AccountInfoService,
                    ): ReadonlyArray<InterfaceReadProvider> => [openapi, ...accounts.providers()],
                    inject: [OpenApiInterfaceReadsService, AccountInfoService],
                },
            ],
            exports: [...NATIVE_TOOL_ADAPTERS, BrainProbeService, INTERFACE_READ_PROVIDERS, PROVIDER_REGISTRY_READS_PORT],
        }
    }
}
