import { Injectable } from "@nestjs/common"
import type { DecideOutcome } from "@modules/domain/team-chat"

/** The one answer: no road opens an approval card any more, so there is no decision to settle. */
const NOT_FOUND: DecideOutcome = { ok: false, refusal: "decision_not_found" }

@Injectable()
/**
 * The verdict on an approval card. The old engine's approval requests are gone (a node on `ask` is answered on its run's stop card,
 * through `decideRunStop` / `decideAgentRunStep`), so nothing is written and the verdict is refused `decision_not_found`.
 */
export class ChatApprovalDecisionService {
    /** Refuses the verdict: there is no approval card to settle. */
    decide(): Promise<DecideOutcome> {
        return Promise.resolve(NOT_FOUND)
    }
}
