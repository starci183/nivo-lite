import { Injectable, type OnModuleInit } from "@nestjs/common"
import { SandboxCatalogueRegistryService } from "@modules/domain/provider-sandbox"
import { WEBHOOK_SANDBOX_CATALOGUE } from "./webhook-sandbox.catalogue"
import { WebhookLiveSendService } from "./webhook-live-send.service"
import { WebhookSandboxSendService } from "./webhook-sandbox-send.service"
import { WebhookSendRegistryService } from "./webhook-send-registry.service"

@Injectable()
/** Hands the outgoing webhook (live and sandbox) to its registry and its sandbox catalogue to the sandbox page's registry, once, when the app starts. */
export class WebhookProviderRegistrationService implements OnModuleInit {
    constructor(
        private readonly sends: WebhookSendRegistryService,
        private readonly live: WebhookLiveSendService,
        private readonly sandbox: WebhookSandboxSendService,
        private readonly catalogues: SandboxCatalogueRegistryService,
    ) {}

    /** Registers both implementations under `webhook` and the catalogue of the sandbox's cases. */
    onModuleInit(): void {
        this.sends.register({ live: this.live, sandbox: this.sandbox })
        this.catalogues.register(WEBHOOK_SANDBOX_CATALOGUE)
    }
}
