import { Query } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { AutomationsOverview } from "@modules/domain/automations"
import type { GetAutomationsRequest } from "./get-automations.contracts"

/** Reads the gallery, the history and the shop for previews. */
export class GetAutomationsQuery extends Query<AutomationsOverview> {
    constructor(readonly params: ExecuteParams<GetAutomationsRequest>) {
        super()
    }
}
