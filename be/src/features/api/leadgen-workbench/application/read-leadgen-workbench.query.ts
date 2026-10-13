import { Query } from "@nestjs/cqrs"
import type { LeadGenWorkbench, LeadGenWorkbenchSelection } from "@modules/domain/leadgen-workbench"
import type { ExecuteParams } from "@modules/platform/cqrs"

/** Asks for the prospect, source, comment and handoff workbench of the active workspace. */
export class ReadLeadGenWorkbenchQuery extends Query<LeadGenWorkbench> {
    constructor(readonly params: ExecuteParams<LeadGenWorkbenchSelection>) {
        super()
    }
}
