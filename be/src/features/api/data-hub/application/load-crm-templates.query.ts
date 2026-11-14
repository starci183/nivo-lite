import { Query } from "@nestjs/cqrs"
import type { CrmTemplateView } from "@modules/domain/data-hub"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { LoadCrmTemplatesRequest } from "./load-crm-templates.contracts"

/** Lists the CRMs the installed packages declare, for the connect wizard. */
export class LoadCrmTemplatesQuery extends Query<ReadonlyArray<CrmTemplateView>> {
    constructor(readonly params: ExecuteParams<LoadCrmTemplatesRequest>) {
        super()
    }
}
