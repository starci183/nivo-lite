import { Module } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import { InjectJobProcessorRegistry } from "@modules/platform/jobs"
import type { JobProcessorRegistry } from "@modules/platform/jobs"
import { DraftDossierRemedyModule } from "../../draft-dossier-remedy.module"
import { ConfigurableModuleClass } from "./draft-dossier-remedy-queue.module-definition"
import { DraftDossierRemedyProcessor } from "./draft-dossier-remedy.processor"

@Module({ imports: [DraftDossierRemedyModule.register({})], providers: [DraftDossierRemedyProcessor] })
/** The queue transport of the draft-dossier-remedy job: registers its processor with the job runner. */
export class DraftDossierRemedyQueueModule extends ConfigurableModuleClass implements OnModuleInit {
    constructor(
        @InjectJobProcessorRegistry() private readonly registry: JobProcessorRegistry,
        private readonly processor: DraftDossierRemedyProcessor,
    ) {
        super()
    }

    /** Hands the processor to the registry. */
    onModuleInit(): void {
        this.registry.add(this.processor)
    }
}
