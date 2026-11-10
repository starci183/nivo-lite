import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./lead-memory.module-definition"
import { LeadMemoryService } from "./lead-memory.service"

@Module({})
/**
 * The one memory of each customer across every workflow and run of theirs: what each node answered, the trigger of each workflow and
 * the facts the nodes proved. The graph node step reads it to resolve refs and to resume without running a done node again, and writes
 * each step's outcome into it. It needs the entity engine, registered globally.
 */
export class LeadMemoryModule extends ConfigurableModuleClass {
    /** Registers the capability once per app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []), LeadMemoryService],
            exports: [LeadMemoryService],
        }
    }
}
