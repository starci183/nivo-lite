import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { SEPAY_SIMULATION_OPTIONS } from "./sepay-simulation.decorators"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./sepay-simulation.module-definition"
import type { SepaySimulationOptions, SimulationPoster } from "./sepay-simulation.options"
import { SepaySimulationService } from "./sepay-simulation.service"

@Module({})
/** The development tool that posts a realistic SePay bank webhook to a running api. */
export class SepaySimulationModule extends ConfigurableModuleClass {
    /** Registers the tool once in the cli app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [
                ...(base.providers ?? []),
                options.poster,
                {
                    provide: SEPAY_SIMULATION_OPTIONS,
                    useFactory: (poster: SimulationPoster): SepaySimulationOptions => ({
                        ...options,
                        post: (delivery) => poster.post(delivery),
                    }),
                    inject: [options.poster],
                },
                SepaySimulationService,
            ],
            exports: [SepaySimulationService],
        }
    }
}
