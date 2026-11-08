import { Module, type DynamicModule } from "@nestjs/common"
import { GapProposalsService } from "./gap-proposals.service"
import { InternalReaderService } from "./internal-reader.service"
import { PublicDocumentsService } from "./public-documents.service"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./public-documents.module-definition"
import { PublicDraftRunService } from "./public-draft-run.service"
import { PublicDraftWriterService } from "./public-draft-writer.service"

@Module({})
/**
 * The documents customers may read, written apart from the internal ones: drafting from internal documents through NIVO MCP, the
 * owner's approval, publishing, the review a changed source asks for, and the proposals for questions the public layer cannot answer.
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
            GapProposalsService,
        ]
        return {
            ...base,
            providers: [...(base.providers ?? []), ...services],
            exports: [PublicDocumentsService, PublicDraftRunService, GapProposalsService],
        }
    }
}
