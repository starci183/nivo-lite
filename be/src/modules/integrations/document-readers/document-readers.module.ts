import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { documentLibraries } from "./document-libraries.adapter"
import { DocumentReadersClient } from "./document-readers.client"
import { DOCUMENT_LIBRARIES, DOCUMENT_READERS } from "./document-readers.decorators"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./document-readers.module-definition"

@Module({})
/** The document readers: any kind of shop document as text, behind the `DocumentReadersPort`. */
export class DocumentReadersModule extends ConfigurableModuleClass {
    /** Registers the readers for the capability that indexes documents. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [
                ...(base.providers ?? []),
                { provide: DOCUMENT_LIBRARIES, useValue: documentLibraries },
                DocumentReadersClient,
                { provide: DOCUMENT_READERS, useExisting: DocumentReadersClient },
            ],
            exports: [DOCUMENT_READERS],
        }
    }
}
