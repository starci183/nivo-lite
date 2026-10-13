import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { LOYALTY_OTP_PEPPER } from "./loyalty-otps.decorators"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./loyalty-otps.module-definition"
import { LoyaltyOtpsService } from "./loyalty-otps.service"

@Module({})
/** The loyalty one-time codes capability: the codes that unlock the public points page. */
export class LoyaltyOtpsModule extends ConfigurableModuleClass {
    /** Registers the capability once in the API app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [
                ...(base.providers ?? []),
                { provide: LOYALTY_OTP_PEPPER, useValue: options.pepper },
                LoyaltyOtpsService,
            ],
            exports: [LoyaltyOtpsService],
        }
    }
}
