import { Injectable, Optional } from "@nestjs/common"
import { StopDoorService, type StopDoorAnswer } from "@modules/domain/agent-threads"
import type { OptionalText } from "./agent-pages.contracts"

/** The answer of an app that runs no thread: every run is the old engine's. */
const NO_THREADS: StopDoorAnswer = { outcome: "not_thread", stepKey: null }

@Injectable()
/**
 * A person's decision on the stop of a thread run, from the card on /chat or the run page: the founder's words or one of the three
 * buttons, through the stop door (owner or manager only; a stop already resolved answers `stop_closed` and moves nothing). An app that
 * runs no thread answers `not_thread`.
 */
export class RunStopDecisionsService {
    constructor(@Optional() private readonly stops?: StopDoorService) {}

    /** Hands the decision to the stop door as the member. */
    decide(
        principalId: string,
        workspaceId: string,
        runId: string,
        stepKey: OptionalText,
        action: string,
        text: OptionalText,
    ): Promise<StopDoorAnswer> {
        if (this.stops === undefined) return Promise.resolve(NO_THREADS)
        return this.stops.decide(principalId, { workspaceId, runId, stepKey, action, text })
    }
}
