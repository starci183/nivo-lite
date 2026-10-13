import { Module } from "@nestjs/common"
import { RecordManualEvidenceHandler } from "./application/record-manual-evidence.handler"

@Module({
    providers: [RecordManualEvidenceHandler],
})
/** The evidence feature: the handlers of its application. */
export class EvidenceApiModule {}
