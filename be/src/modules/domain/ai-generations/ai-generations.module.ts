import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { AI_GENERATIONS_COMPLETION, AI_GENERATIONS_OPTIONS, AI_GENERATIONS_USAGE } from "./ai-generations.decorators"
import { GenerationCompletionService } from "./generation-completion.service"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./ai-generations.module-definition"
import { GenerationRunnerService } from "./generation-runner.service"
import { GenerationsService } from "./generations.service"
import { TextGeneratorService } from "./text-generator.service"

@Module({})
/** Every text the app writes outside customer chat: a queued row, a job that runs it on OpenClaw, and the caller looking at the row. */
export class AiGenerationsModule extends ConfigurableModuleClass {
    /** Registers the capability once; the usage port is bound to the class the options name. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        const { isGlobal: _isGlobal, ...parsed } = options
        return {
            ...base,
            providers: [
                ...(base.providers ?? []),
                { provide: AI_GENERATIONS_OPTIONS, useValue: parsed },
                { provide: AI_GENERATIONS_USAGE, useClass: options.usage },
                GenerationCompletionService,
                { provide: AI_GENERATIONS_COMPLETION, useExisting: options.completion ?? GenerationCompletionService },
                GenerationsService,
                GenerationRunnerService,
                TextGeneratorService,
            ],
            exports: [GenerationsService, GenerationRunnerService, TextGeneratorService],
        }
    }
}
