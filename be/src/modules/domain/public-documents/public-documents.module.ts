import { Module, type DynamicModule } from "@nestjs/common"
import { InternalReaderService } from "./internal-reader.service"
import { PublicDocumentsService } from "./public-documents.service"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./public-documents.module-definition"
import { PublicDraftRunService } from "./public-draft-run.service"
import { PublicDraftWriterService } from "./public-draft-writer.service"

@Module({})
/**
 * The documents customers may read, written apart from the internal ones: drafting from documents of the PUBLIC area only, the
 * owner's approval, publishing, and the review a changed source asks for.
 */
export class PublicDocumentsModule extends ConfigurableModuleClass {
    /** Registers the capability once per app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        const services = [
            PublicDocumentsService,
            PublicDraftRunService,
            PublicDraftWriterService,
            InternalReaderService,
        ]
        return {
            ...base,
            providers: [...(base.providers ?? []), ...services],
            exports: [PublicDocumentsService, PublicDraftRunService],
        }
    }
}
