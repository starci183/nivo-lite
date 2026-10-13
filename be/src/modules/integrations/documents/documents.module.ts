import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { DocumentsClient } from "./documents.client"
import { DOCUMENTS } from "./documents.decorators"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./documents.module-definition"
import { DocumentsHttpClient } from "./documents-http.client"
import { DriveApiClient } from "./drive-api.client"
import { DriveFolderClient } from "./drive-folder.client"
import { PublicLinkClient } from "./public-link.client"

@Module({})
/** Provides the documents port: links, uploaded files and Google Drive items as text. */
export class DocumentsModule extends ConfigurableModuleClass {
    /** Registers the integration once per app that reads documents. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [
                ...(base.providers ?? []),
                DocumentsHttpClient,
                PublicLinkClient,
                DriveApiClient,
                DriveFolderClient,
                { provide: DOCUMENTS, useClass: DocumentsClient },
            ],
            exports: [DOCUMENTS],
        }
    }
}
