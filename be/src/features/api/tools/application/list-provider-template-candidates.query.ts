import { Query } from "@nestjs/cqrs"
import type { TemplateCandidate } from "@modules/domain/tools"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { ListProviderTemplateCandidatesRequest } from "./list-provider-template-candidates.contracts"

/** Asks which agents a template would attach to a provider connected after they were created. */
export class ListProviderTemplateCandidatesQuery extends Query<ReadonlyArray<TemplateCandidate>> {
    constructor(readonly params: ExecuteParams<ListProviderTemplateCandidatesRequest>) {
        super()
    }
}
