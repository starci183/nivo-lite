import { Query } from "@nestjs/cqrs"
import type { LeadGenWorkbenchData } from "@modules/domain/leads"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { ReadLeadGenWorkbenchRequest } from "./read-leadgen-workbench.contracts"

/** Asks for the Lead Gen workbench in a workspace the caller belongs to. */
export class ReadLeadGenWorkbenchQuery extends Query<LeadGenWorkbenchData> {
    constructor(readonly params: ExecuteParams<ReadLeadGenWorkbenchRequest>) {
        super()
    }
}
