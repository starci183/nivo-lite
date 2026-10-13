import { Field, ID, InputType } from "@nestjs/graphql"
import { IsIn, IsString, IsUUID, MaxLength } from "class-validator"
import type { RecordOutcomeRequest } from "../../../application/record-outcome.contracts"

const STAGES = ["new", "qualified", "proposal", "won", "lost"] as const

@InputType()
/** The lead stage and evidence recorded by the caller. */
export class RecordOutcomeInput {
    /** The lead whose stage changes. */
    @Field(() => ID)
    @IsUUID("4")
    @MaxLength(36)
    leadId!: string

    /** The stage the journey moved to. */
    @Field(() => String)
    @IsIn(STAGES)
    @MaxLength(20)
    stage!: RecordOutcomeRequest["stage"]

    /** The evidence behind the change; may be empty. */
    @Field()
    @IsString()
    @MaxLength(2000)
    evidence!: string
}
