import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./orders.module-definition"
import { OrdersService } from "./orders.service"
import { OrdersReadService } from "./orders-read.service"

@Module({})
/** The orders of a workspace over the primary Supabase PostgreSQL connection: the only writer of public.orders. */
export class OrdersModule extends ConfigurableModuleClass {
    /** Registers the capability once in the API app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []), OrdersService, OrdersReadService],
            exports: [OrdersService, OrdersReadService],
        }
    }
}
