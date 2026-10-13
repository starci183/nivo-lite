import { Module } from "@nestjs/common"
import { EvidenceApiModule } from "../../evidence.module"
import { RecordManualEvidenceResolver } from "./record-manual-evidence.resolver"

@Module({
    imports: [EvidenceApiModule],
    providers: [
        RecordManualEvidenceResolver,
    ],
})
/** The GraphQL transport of the evidence feature. */
export class EvidenceGraphqlModule {}
