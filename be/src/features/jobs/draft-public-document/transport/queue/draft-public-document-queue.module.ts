import { Module, type OnModuleInit } from "@nestjs/common"
import { InjectJobProcessorRegistry, type JobProcessorRegistry } from "@modules/platform/jobs"
import { DraftPublicDocumentModule } from "../../draft-public-document.module"
import { ConfigurableModuleClass } from "./draft-public-document-queue.module-definition"
import { DraftPublicDocumentProcessor } from "./draft-public-document.processor"

@Module({ imports: [DraftPublicDocumentModule.register({})], providers: [DraftPublicDocumentProcessor] })
/** The queue transport of the draft-public-document job: registers its processor with the job runner. */
export class DraftPublicDocumentQueueModule extends ConfigurableModuleClass implements OnModuleInit {
    constructor(
        @InjectJobProcessorRegistry() private readonly registry: JobProcessorRegistry,
        private readonly processor: DraftPublicDocumentProcessor,
    ) {
        super()
    }

    /** Hands the processor to the registry. */
    onModuleInit(): void {
        this.registry.add(this.processor)
    }
}
