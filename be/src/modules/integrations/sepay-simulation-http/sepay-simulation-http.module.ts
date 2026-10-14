import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { SepaySimulationHttpClient } from "./sepay-simulation-http.client"
import type { SepaySimulationPost } from "./sepay-simulation-http.contracts"
import { SEPAY_SIMULATION_POST } from "./sepay-simulation-http.decorators"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./sepay-simulation-http.module-definition"

@Module({})
/** Provides the callback that delivers a simulated SePay webhook through the HTTP port. */
export class SepaySimulationHttpModule extends ConfigurableModuleClass {
    /** Registers the delivery integration once in the cli app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [
                ...(base.providers ?? []),
                SepaySimulationHttpClient,
                {
                    provide: SEPAY_SIMULATION_POST,
                    useFactory:
                        (client: SepaySimulationHttpClient): SepaySimulationPost =>
                        (delivery) =>
                            client.post(delivery),
                    inject: [SepaySimulationHttpClient],
                },
            ],
            exports: [SEPAY_SIMULATION_POST],
        }
    }
}
