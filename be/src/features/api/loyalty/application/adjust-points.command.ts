import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { AdjustPointsRequest, AdjustPointsResult } from "./adjust-points.contracts"

/** Adds or takes points by hand. */
export class AdjustPointsCommand extends Command<AdjustPointsResult> {
    constructor(readonly params: ExecuteParams<AdjustPointsRequest>) {
        super()
    }
}
