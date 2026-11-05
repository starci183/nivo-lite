import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { REMOTE_FILES, REMOTE_FILES_OPTIONS } from "./remote-files.decorators"
import { RemoteFilesClient } from "./remote-files.client"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./remote-files.module-definition"

@Module({})
/** The remote files integration: reads one file by address through the HTTP port. Register it only in an app that composes `platform/http`. */
export class RemoteFilesModule extends ConfigurableModuleClass {
    /** Registers the integration once per app that reads remote files, with the limits its config read. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [
                ...(base.providers ?? []),
                { provide: REMOTE_FILES_OPTIONS, useValue: options },
                RemoteFilesClient,
                { provide: REMOTE_FILES, useExisting: RemoteFilesClient },
            ],
            exports: [REMOTE_FILES],
        }
    }
}
