import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { DailyCloseEffectsService } from "./daily-close-effects.service"
import { LeadEffectsService } from "./lead-effects.service"
import { OrderEffectsService } from "./order-effects.service"
import { PaymentEffectsService } from "./payment-effects.service"
import { PaymentQrEffectsService } from "./payment-qr-effects.service"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./sales-effects.module-definition"

@Module({})
/**
 * What Sales does for the graph nodes on the entity engine: the executors of `lead.ensure`, `order.record`, `order.confirm` and
 * `order.void`, `payment.order.settle`, `payment.claim.record`, `payment.claim.cancel`, `payment.qr.create` and `report.daily.close` (the evening close of the books, posted to the team), and the resolver that tells a turn which customer its conversation belongs to. Each runs in one workspace-scoped
 * transaction over the `sales.lead`, `sales.order` and `chat.conversation` records; the data ports of the two kinds are the engine's.
 */
export class SalesEffectsModule extends ConfigurableModuleClass {
    /** Registers the capability in the app that runs graph nodes. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [
                ...(base.providers ?? []),
                LeadEffectsService,
                OrderEffectsService,
                PaymentEffectsService,
                PaymentQrEffectsService,
                DailyCloseEffectsService,
            ],
        }
    }
}
