import { QueryHandler } from "@nestjs/cqrs"
import { BrainPolicyReadService, type BrainPoliciesWire } from "@modules/domain/brain"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { GetBrainPoliciesQuery } from "./get-brain-policies.query"

@QueryHandler(GetBrainPoliciesQuery)
/** Reads the Policies tab: the policies the AI derived from the truth graph, each value read from its fact in force. */
export class GetBrainPoliciesHandler extends ICQRSHandler<GetBrainPoliciesQuery, BrainPoliciesWire> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly policies: BrainPolicyReadService,
    ) {
        super(logger)
    }

    protected override process(query: GetBrainPoliciesQuery): Promise<BrainPoliciesWire> {
        return this.policies.policiesWire(query.params.principal.id, query.params.request.workspaceId)
    }
}
