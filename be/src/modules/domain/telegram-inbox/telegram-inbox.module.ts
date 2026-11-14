import { Module, type DynamicModule, type OnModuleInit } from "@nestjs/common"
import { CustomerSendRegistryService, TelegramCustomerSendService } from "@modules/domain/channels"
import { triggerDeclarations } from "@modules/domain/provider-triggers"
import { SandboxCatalogueRegistryService } from "@modules/domain/provider-sandbox"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./telegram-inbox.module-definition"
import { TELEGRAM_RECEIPT_PROCESSOR } from "./telegram-inbox.decorators"
import { TelegramDeliveryService } from "./telegram-delivery.service"
import { TelegramFilesService } from "./telegram-files.service"
import { TelegramInboxService } from "./telegram-inbox.service"
import { TELEGRAM_TRIGGERS } from "./telegram-message.trigger"
import { TELEGRAM_SANDBOX_CATALOGUE } from "./telegram-sandbox.catalogue"
import { TELEGRAM_SEND_SANDBOX_CASES, TELEGRAM_STAFF_SANDBOX_CASES } from "./telegram-sandbox-send.catalogue"
import { TelegramSandboxSendService } from "./telegram-sandbox-send.service"

@Module({})
/**
 * The Telegram webhook door and its deferred consumer, keeping every update in the connection's account data. Telegram has no provider
 * module of its own: its message trigger is declared here, beside the update's data types, and registered at boot, together with its
 * customer send (the live bot route and its sandbox twin, on the customer-send registry) and its sandbox catalogue.
 */
export class TelegramInboxModule extends ConfigurableModuleClass implements OnModuleInit {
    constructor(
        private readonly sends: CustomerSendRegistryService,
        private readonly sendLive: TelegramCustomerSendService,
        private readonly sendSandbox: TelegramSandboxSendService,
        private readonly catalogues: SandboxCatalogueRegistryService,
    ) {
        super()
    }

    /** Registers the capability once in the API app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [
                ...(base.providers ?? []),
                TelegramInboxService,
                TelegramFilesService,
                TelegramDeliveryService,
                TelegramSandboxSendService,
                { provide: TELEGRAM_RECEIPT_PROCESSOR, useExisting: TelegramInboxService },
            ],
            exports: [TelegramInboxService, TelegramDeliveryService],
        }
    }

    /** Registers the bot's message trigger, its customer send (live and sandbox) and its sandbox catalogue once. */
    onModuleInit(): void {
        this.sends.register({ live: this.sendLive, sandbox: this.sendSandbox })
        this.catalogues.register(TELEGRAM_SANDBOX_CATALOGUE)
        this.catalogues.register({ provider: TELEGRAM_SANDBOX_CATALOGUE.provider, cases: [...TELEGRAM_SEND_SANDBOX_CASES, ...TELEGRAM_STAFF_SANDBOX_CASES] })
        triggerDeclarations.register(...TELEGRAM_TRIGGERS)
    }
}
