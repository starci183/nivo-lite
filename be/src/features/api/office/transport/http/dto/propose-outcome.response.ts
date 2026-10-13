import { CandidateResponse } from "./candidate.response"

/** What proposing a command answered: a normal chat, a NIVO line or a command card. */
export class ProposeOutcomeResponse {
    /** `chat`, `reply` or `card`. */
    kind!: string
    /** The line NIVO posted, for `reply`. */
    body?: string
    /** The card, for `card`. */
    candidate?: CandidateResponse
}
