import { Module, type DynamicModule } from "@nestjs/common"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./lead-memory.module-definition"
import { CONTACT_MEMORY } from "@modules/domain/contacts"
import { ContactMemoryAdapter } from "./contact-memory.adapter"
import { LeadMemoryService } from "./lead-memory.service"

@Module({})
/**
 * The one memory of each person (keyed by their contact) across every workflow and run of theirs: what each node answered, the trigger of each workflow and
 * the facts the nodes proved. The graph node step reads it to resolve refs and to resume without running a done node again, and writes
 * each step's outcome into it. Its entries live in the contacts' memory table (`CONTACT_MEMORY_STORE`, provided by the contacts module, registered globally).
 */
export class LeadMemoryModule extends ConfigurableModuleClass {
    /** Registers the capability once per app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [
                ...(base.providers ?? []),
                LeadMemoryService,
                ContactMemoryAdapter,
                { provide: CONTACT_MEMORY, useExisting: ContactMemoryAdapter },
            ],
            exports: [LeadMemoryService, CONTACT_MEMORY],
        }
    }
}
