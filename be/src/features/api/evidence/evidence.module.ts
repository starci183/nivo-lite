import { Module } from "@nestjs/common"
import { RecordManualEvidenceHandler } from "./application/record-manual-evidence.handler"
import { ConfigurableModuleClass } from "./evidence.module-definition"

@Module({
    providers: [RecordManualEvidenceHandler],
})
/** The evidence feature: the handlers of its application. */
export class EvidenceApiModule extends ConfigurableModuleClass {}
