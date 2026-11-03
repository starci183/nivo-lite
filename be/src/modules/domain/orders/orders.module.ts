import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./orders.module-definition"
import { OrderPaymentClaimsService } from "./order-payment-claims.service"
import { OrdersService } from "./orders.service"
import { WORK_RAISED } from "@modules/domain/decisions/work-engine.decorators"
import { PaymentClaimGraphAdapter } from "./payment-claim-graph.adapter"
import { PaymentClaimWorkRaisedAdapter } from "./payment-claim-work-raised.adapter"
import { PaymentMarkPaidGraphAdapter } from "./payment-mark-paid-graph.adapter"
import { OrdersLabelReadService } from "./orders-label-read.service"
import { OrderFactReaderService } from "./order-fact-reader.service"
import { OrdersFiguresService } from "./orders-figures.service"
import { OrdersReadService } from "./orders-read.service"
import { OrdersAutomationReadService } from "./orders-automation-read.service"
import { OrdersGraphService } from "./orders-graph.service"

@Module({})
/** The orders of a workspace over the primary PostgreSQL connection: the only writer of public.orders. */
export class OrdersModule extends ConfigurableModuleClass {
    /** Registers the capability once in the API app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [
                ...(base.providers ?? []),
                OrdersService,
                OrderPaymentClaimsService,
                PaymentClaimGraphAdapter,
                PaymentClaimWorkRaisedAdapter,
                { provide: WORK_RAISED, useExisting: PaymentClaimWorkRaisedAdapter },
                PaymentMarkPaidGraphAdapter,
                OrdersReadService,
                OrdersFiguresService,
                OrderFactReaderService,
                OrdersAutomationReadService,
                OrdersLabelReadService,
                OrdersGraphService,
            ],
            exports: [
                OrdersService,
                OrderPaymentClaimsService,
                PaymentClaimGraphAdapter,
                WORK_RAISED,
                OrdersReadService,
                OrdersFiguresService,
                OrderFactReaderService,
                OrdersAutomationReadService,
                OrdersLabelReadService,
            ],
        }
    }
}
