import { Query } from "@nestjs/cqrs"
import type { AgentRemovalImpact } from "@modules/domain/modules"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { AgentDeletionImpactRequest } from "./agent-deletion-impact.contracts"

/** Asks what removing an installed agent would take with it (its records by type, and their files). */
export class AgentDeletionImpactQuery extends Query<AgentRemovalImpact> {
    constructor(readonly params: ExecuteParams<AgentDeletionImpactRequest>) {
        super()
    }
}
