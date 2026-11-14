import { Injectable, type OnModuleInit } from "@nestjs/common"
import { SandboxCatalogueRegistryService } from "@modules/domain/provider-sandbox"
import { IMAP_SANDBOX_CATALOGUE } from "./imap-sandbox.catalogue"
import { ImapSandboxSyncService } from "./imap-sandbox-sync.service"
import { ImapSyncService } from "./imap-sync.service"
import { DataConnectorRegistryService } from "./data-connector-registry.service"

@Injectable()
/** Hands the mailbox pull (live and sandbox) to its registry and its sandbox catalogue to the sandbox page's registry, once, when the app starts. */
export class ImapConnectorRegistrationService implements OnModuleInit {
    constructor(
        private readonly mailboxes: DataConnectorRegistryService,
        private readonly imapLive: ImapSyncService,
        private readonly imapSandbox: ImapSandboxSyncService,
        private readonly catalogues: SandboxCatalogueRegistryService,
    ) {}

    /** Registers both connectors under `imap` and the catalogue of the sandbox's sets. */
    onModuleInit(): void {
        this.mailboxes.register({ live: this.imapLive, sandbox: this.imapSandbox })
        this.catalogues.register(IMAP_SANDBOX_CATALOGUE)
    }
}
