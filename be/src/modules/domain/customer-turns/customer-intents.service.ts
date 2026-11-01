import { Injectable } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import { IntentRegistryService } from "@modules/domain/intent-contracts"
import { CUSTOMER_INTENT_DOMAIN } from "./customer-intents.policy"

@Injectable()
/** Registers the customer reply as a domain of the intent registry when the module starts, the way a wake source registers its handlers. */
export class CustomerIntentsService implements OnModuleInit {
    constructor(private readonly registry: IntentRegistryService) {}

    /** Adds the frames, the schema and the checks of the customer reply. */
    onModuleInit(): void {
        this.registry.add(CUSTOMER_INTENT_DOMAIN)
    }
}
