import { Module } from "@nestjs/common"
import { EvidenceApiModule } from "../../evidence.module"
import { ConfigurableModuleClass } from "./evidence-graphql.module-definition"
import { RecordManualEvidenceResolver } from "./record-manual-evidence.resolver"

@Module({
    imports: [EvidenceApiModule.register({})],
    providers: [RecordManualEvidenceResolver],
})
/** The GraphQL transport of the evidence feature. */
export class EvidenceGraphqlModule extends ConfigurableModuleClass {}
