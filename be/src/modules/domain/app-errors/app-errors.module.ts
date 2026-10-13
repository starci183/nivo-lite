import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { ERROR_REPORTER } from "@modules/platform/errors"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./app-errors.module-definition"
import { AppErrorsService } from "./app-errors.service"

@Module({})
/** The `app_errors` writer, bound as the error reporter of the errors capability so transports and the queue record their failures. */
export class AppErrorsModule extends ConfigurableModuleClass {
    /** Registers the capability once per app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [
                ...(base.providers ?? []),
                AppErrorsService,
                { provide: ERROR_REPORTER, useExisting: AppErrorsService },
            ],
            exports: [AppErrorsService, ERROR_REPORTER],
        }
    }
}
