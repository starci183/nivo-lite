import { Injectable, type OnModuleInit } from "@nestjs/common"
import { LedgerRegistryService } from "@modules/domain/provider-registry"
import { MisaAmisLedgerService } from "./misa-amis-ledger.service"

@Injectable()
/** Hands the AMIS ledger port to the ledger registry once, when the app starts (never ready while it is not built). */
export class MisaAmisProviderRegistrationService implements OnModuleInit {
    constructor(
        private readonly ledgers: LedgerRegistryService,
        private readonly ledger: MisaAmisLedgerService,
    ) {}

    /** Hands the capability to its registry. */
    onModuleInit(): void {
        this.ledgers.register(this.ledger)
    }
}
