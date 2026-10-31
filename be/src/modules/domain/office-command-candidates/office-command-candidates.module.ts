import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { BACKGROUND_VOICE } from "@modules/domain/agent-schedules"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./office-command-candidates.module-definition"
import { COMMAND_READER } from "./office-command-candidates.decorators"
import { OfficeCommandService } from "./office-command.service"
import { DecisionsQueueService } from "./decisions-queue.service"
import { OfficeBackgroundVoiceService } from "./office-background-voice.service"
import { OfficeTagHandlerService } from "./office-tag-handler.service"
import { OfficeTagService } from "./office-tag.service"
import { OfficeThreadService } from "./office-thread.service"

@Module({})
/**
 * The Office composer and thread: the owner's message becomes a command candidate the owner confirms or cancels, a line that tags
 * agents wakes them and the tagged agent answers it (the handler of the tag source), the voice a background agent speaks to its owner
 * with, and the thread read model the Office screen draws. The workspace members, events, decisions and ai-tasks capabilities must be reachable from it.
 */
export class OfficeCommandCandidatesModule extends ConfigurableModuleClass {
    /** Registers the capability once in the API app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [
                ...(base.providers ?? []),
                { provide: COMMAND_READER, useExisting: options.reader },
                DecisionsQueueService,
                OfficeBackgroundVoiceService,
                { provide: BACKGROUND_VOICE, useExisting: OfficeBackgroundVoiceService },
                OfficeCommandService,
                OfficeTagHandlerService,
                OfficeTagService,
                OfficeThreadService,
            ],
            exports: [
                DecisionsQueueService,
                BACKGROUND_VOICE,
                OfficeCommandService,
                OfficeTagService,
                OfficeThreadService,
            ],
        }
    }
}
