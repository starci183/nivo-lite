import { Injectable, type OnModuleInit } from "@nestjs/common"
import { LedgerRegistryService } from "@modules/domain/provider-registry"
import { SandboxCatalogueRegistryService } from "@modules/domain/provider-sandbox"
import { MisaAmisLedgerService } from "./misa-amis-ledger.service"
import { AMIS_SANDBOX_CATALOGUE } from "./misa-amis-sandbox.catalogue"
import { MisaAmisSandboxLedgerService } from "./misa-amis-sandbox-ledger.service"

@Injectable()
/** Hands the AMIS ledger port (live and sandbox) to the ledger registry, and the sandbox catalogue to the catalogue registry, once, when the app starts (the live one is never ready while it is not built). */
export class MisaAmisProviderRegistrationService implements OnModuleInit {
    constructor(
        private readonly ledgers: LedgerRegistryService,
        private readonly ledger: MisaAmisLedgerService,
        private readonly ledgerSandbox: MisaAmisSandboxLedgerService,
        private readonly catalogues: SandboxCatalogueRegistryService,
    ) {}

    /** Hands the capability to its registry. */
    onModuleInit(): void {
        this.ledgers.register({ live: this.ledger, sandbox: this.ledgerSandbox })
        this.catalogues.register(AMIS_SANDBOX_CATALOGUE)
    }
}
