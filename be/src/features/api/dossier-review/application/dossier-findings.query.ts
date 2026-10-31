import { Query } from "@nestjs/cqrs"
import type { FindingPage } from "@modules/domain/dossier-review"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { DossierFindingsRequest } from "./dossier-findings.contracts"

/** Lists the findings of the workspace, severity first, one page at a time. */
export class DossierFindingsQuery extends Query<FindingPage> {
    constructor(readonly params: ExecuteParams<DossierFindingsRequest>) {
        super()
    }
}
