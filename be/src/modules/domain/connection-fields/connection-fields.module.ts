import { Module, type DynamicModule } from "@nestjs/common"
import type { ConnectionFieldWriter } from "./connection-fields.contracts"
import { CONNECTION_FIELD_WRITERS } from "./connection-fields.decorators"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./connection-fields.module-definition"

import { ConnectionFieldsService } from "./connection-fields.service"

@Module({})
/**
 * The generic connection form: the providers' declared fields with their public values, and one dispatch of a checked change to the
 * provider's own writer. The writers are the app's (`options.writers`), injected from the providers' global modules; none of them may
 * inject this capability back. A provider whose form could put a secret on a page is DISABLED by the service (its accounts answer
 * `CONNECTION_FIELDS_DECLARATION_INVALID`); the app still starts, so one plugin's bad declaration never takes the product down.
 */
export class ConnectionFieldsModule extends ConfigurableModuleClass {
    /** Registers the capability once per app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        const writers = options.writers ?? []
        return {
            ...base,
            providers: [
                ...(base.providers ?? []),
                {
                    provide: CONNECTION_FIELD_WRITERS,
                    useFactory: (...registered: ReadonlyArray<ConnectionFieldWriter>): ReadonlyArray<ConnectionFieldWriter> => registered,
                    inject: [...writers],
                },
                ConnectionFieldsService,
            ],
            exports: [ConnectionFieldsService],
        }
    }
}
