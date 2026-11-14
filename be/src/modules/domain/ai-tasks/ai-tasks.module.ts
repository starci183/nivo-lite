import { Module, type DynamicModule } from "@nestjs/common"
import { AiTasksService } from "./ai-tasks.service"
import { NodeImagesService } from "./node-images.service"
import { NotesService } from "./notes.service"
import {
    AI_TASKS,
    AI_TASKS_METER,
    AI_TASKS_OPTIONS,
    AI_TASKS_RECALL,
} from "./ai-tasks.decorators"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./ai-tasks.module-definition"

@Module({})
/** The prompt library. The app root names the usage meter and the recall; the LangChain client is global. */
export class AiTasksModule extends ConfigurableModuleClass {
    /** Registers the library once per app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        const { isGlobal: _isGlobal, meter, recall, endpoint: _endpoint, ...parsed } = options
        return {
            ...base,
            providers: [
                ...(base.providers ?? []),
                { provide: AI_TASKS_OPTIONS, useValue: parsed },
                { provide: AI_TASKS_METER, useExisting: meter },
                { provide: AI_TASKS_RECALL, useExisting: recall },
                NotesService,
                NodeImagesService,
                AiTasksService,
                { provide: AI_TASKS, useExisting: AiTasksService },
            ],
            exports: [AiTasksService, AI_TASKS],
        }
    }
}
