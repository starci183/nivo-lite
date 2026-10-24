import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { LeadReadService } from "@modules/domain/leads"
import { OrdersService } from "@modules/domain/orders"
import { WorkThreadsService } from "@modules/domain/work-threads"

@Module({
    providers: [LeadReadService, OrdersService, WorkThreadsService],
    exports: [LeadReadService, OrdersService, WorkThreadsService],
})
/** The real list owners over the local database; the world supplies the primary manager and clock. */
export class PaginationProofModule {
    /** Composes only the reads exercised by the cursor proofs. */
    static register(): DynamicModule {
        return { module: PaginationProofModule }
    }
}
