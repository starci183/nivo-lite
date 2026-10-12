import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./office.module-definition"
import { COMMAND_READER } from "./office.decorators"
import { OfficeCommandService } from "./office-command.service"
import { OfficeThreadService } from "./office-thread.service"

@Module({})
/**
 * The Office composer and thread: the owner's message becomes a command candidate the owner confirms or cancels, and the thread
 * read model the Office screen draws. The workspace members, events, decisions and deepseek capabilities must be reachable from it.
 */
export class OfficeModule extends ConfigurableModuleClass {
    /** Registers the capability once in the API app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [
                ...(base.providers ?? []),
                { provide: COMMAND_READER, useExisting: options.reader },
                OfficeCommandService,
                OfficeThreadService,
            ],
            exports: [OfficeCommandService, OfficeThreadService],
        }
    }
}
