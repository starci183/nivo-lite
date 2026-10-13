import { IsIn, IsString, MaxLength } from "class-validator"
import type { RecordOutcomeRequest as RecordOutcomeCommandRequest } from "../../../application/record-outcome.contracts"

const STAGES = ["new", "qualified", "proposal", "won", "lost"] as const

/** The bounded HTTP request of record-outcome: the stage the journey moved to and the evidence behind it. */
export class RecordOutcomeRequest {
    /** The stage the journey moved to. */
    @IsIn(STAGES)
    stage!: RecordOutcomeCommandRequest["stage"]

    /** Why: the evidence the person wrote; may be empty. */
    @IsString()
    @MaxLength(2000)
    evidence!: string
}
