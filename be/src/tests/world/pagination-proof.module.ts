import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { LeadReadService } from "@modules/domain/leads"
import { OrdersService } from "@modules/domain/orders"
import { QUIET_PAYMENT_DEMAND } from "./quiet-peers.options"

@Module({
    providers: [LeadReadService, OrdersService, QUIET_PAYMENT_DEMAND],
    exports: [LeadReadService, OrdersService],
})
/** The real list owners over the local database; the world supplies the primary manager and clock. */
export class PaginationProofModule {
    /** Composes only the reads exercised by the cursor proofs. */
    static register(): DynamicModule {
        return { module: PaginationProofModule }
    }
}
