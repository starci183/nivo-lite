import { QueryHandler } from "@nestjs/cqrs"
import { BrainPolicyReadService, type BrainPolicyDetailWire } from "@modules/domain/brain"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { GetBrainPolicyQuery } from "./get-brain-policy.query"

@QueryHandler(GetBrainPolicyQuery)
/** Reads the drawer of one policy row: its value, waiting proposals and history. */
export class GetBrainPolicyHandler extends ICQRSHandler<GetBrainPolicyQuery, BrainPolicyDetailWire | null> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly policies: BrainPolicyReadService,
    ) {
        super(logger)
    }

    protected override process(query: GetBrainPolicyQuery): Promise<BrainPolicyDetailWire | null> {
        return this.policies.detailWire(
            query.params.principal.id,
            query.params.request.workspaceId,
            query.params.request.factId,
        )
    }
}
