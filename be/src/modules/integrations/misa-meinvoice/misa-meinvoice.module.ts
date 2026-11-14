import { Module, type DynamicModule } from "@nestjs/common"
import { MisaMeinvoiceClient } from "./misa-meinvoice.client"
import { MISA_MEINVOICE } from "./misa-meinvoice.decorators"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./misa-meinvoice.module-definition"

@Module({})
/** Provides the MisaMeinvoice client. */
export class MisaMeinvoiceModule extends ConfigurableModuleClass {
    /** Registers the integration once per app that calls MisaMeinvoice. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []), { provide: MISA_MEINVOICE, useClass: MisaMeinvoiceClient }],
            exports: [MISA_MEINVOICE],
        }
    }
}
