import { Module, type DynamicModule, type OnModuleInit } from "@nestjs/common"
import { LedgerRegistryService } from "@modules/domain/provider-registry"
import { SandboxCatalogueRegistryService } from "@modules/domain/provider-sandbox"
import { DriveGrantService } from "./drive-grant.service"
import { DriveLiveReachService } from "./drive-live-reach.service"
import { DriveProviderRegistrationService } from "./drive-provider-registration.service"
import { DriveReachRegistryService } from "./drive-reach-registry.service"
import { GoogleConnectionsService } from "./google-connections.service"
import { GoogleLedgerService } from "./google-ledger.service"
import { GoogleDriveSandboxReachService } from "./google-drive-sandbox-reach.service"
import { GOOGLE_LEDGER_SANDBOX_CATALOGUE } from "./google-sandbox.catalogue"
import { GoogleSandboxLedgerService } from "./google-sandbox-ledger.service"
import { GoogleTokensService } from "./google-tokens.service"
import { SheetsGrantService } from "./sheets-grant.service"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./google-connections.module-definition"

@Module({})
/**
 * The Google account connections, the Drive read grant
 * the knowledge capability reads with, and the ledger the workspace keeps in a spreadsheet (registered with the ledger providers), over
 * the connections capability.
 */
export class GoogleConnectionsModule extends ConfigurableModuleClass implements OnModuleInit {
    constructor(
        private readonly ledgers: LedgerRegistryService,
        private readonly ledger: GoogleLedgerService,
        private readonly ledgerSandbox: GoogleSandboxLedgerService,
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
                GoogleTokensService,
                DriveGrantService,
                DriveReachRegistryService,
                DriveLiveReachService,
                GoogleDriveSandboxReachService,
                DriveProviderRegistrationService,
                SheetsGrantService,
                GoogleLedgerService,
                GoogleSandboxLedgerService,
                GoogleConnectionsService,
            ],
            exports: [GoogleConnectionsService, DriveGrantService, DriveReachRegistryService, SheetsGrantService, GoogleTokensService],
        }
    }

    /** Hands the Google ledger (live and sandbox) to the ledger providers, and the sandbox catalogue to the catalogue registry. */
    onModuleInit(): void {
        this.ledgers.register({ live: this.ledger, sandbox: this.ledgerSandbox })
        this.catalogues.register(GOOGLE_LEDGER_SANDBOX_CATALOGUE)
    }
}
