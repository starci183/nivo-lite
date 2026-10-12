import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { TEMPLATE_FILES, TEMPLATE_FILES_OPTIONS } from "./template-files.decorators"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./template-files.module-definition"
import { TemplateFilesService } from "./template-files.service"

@Module({})
/** The template files integration: reads the catalogue definitions and the workflows from the resources folder. */
export class TemplateFilesModule extends ConfigurableModuleClass {
    /** Registers the integration once per app that reads the files. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [
                ...(base.providers ?? []),
                { provide: TEMPLATE_FILES_OPTIONS, useValue: options },
                TemplateFilesService,
                { provide: TEMPLATE_FILES, useExisting: TemplateFilesService },
            ],
            exports: [TEMPLATE_FILES],
        }
    }
}
