import { Injectable, type OnModuleInit } from "@nestjs/common"
import { SandboxCatalogueRegistryService } from "@modules/domain/provider-sandbox"
import { SmtpLiveSendService } from "./smtp-live-send.service"
import { SmtpSendRegistryService } from "./smtp-send-registry.service"
import { SMTP_SANDBOX_CATALOGUE } from "./smtp-sandbox.catalogue"
import { SmtpSandboxSendService } from "./smtp-sandbox-send.service"

@Injectable()
/** Hands the workspace SMTP send (live and sandbox) to its registry and its sandbox catalogue to the sandbox page's registry, once, when the app starts. */
export class SmtpSendRegistrationService implements OnModuleInit {
    constructor(
        private readonly senders: SmtpSendRegistryService,
        private readonly sendLive: SmtpLiveSendService,
        private readonly sendSandbox: SmtpSandboxSendService,
        private readonly catalogues: SandboxCatalogueRegistryService,
    ) {}

    /** Registers both implementations under `smtp` and the catalogue of the sandbox's cases. */
    onModuleInit(): void {
        this.senders.register({ live: this.sendLive, sandbox: this.sendSandbox })
        this.catalogues.register(SMTP_SANDBOX_CATALOGUE)
    }
}
