import { Command } from "@nestjs/cqrs"
import type { PublicExecuteParams } from "@modules/platform/cqrs"
import type { AwardTillPointsRequest, AwardTillPointsResult } from "./award-till-points.contracts"

/** Earns the points of a sale made outside NIVO. */
export class AwardTillPointsCommand extends Command<AwardTillPointsResult> {
    constructor(readonly params: PublicExecuteParams<AwardTillPointsRequest>) {
        super()
    }
}
