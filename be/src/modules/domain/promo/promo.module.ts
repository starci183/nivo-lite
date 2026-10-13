import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./promo.module-definition"
import { PromoService } from "./promo.service"

@Module({})
/** The read-only promo capability over workspace-owned facts. */
export class PromoModule extends ConfigurableModuleClass {
    /** Registers the read model once in the API app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return { ...base, providers: [...(base.providers ?? []), PromoService], exports: [PromoService] }
    }
}
