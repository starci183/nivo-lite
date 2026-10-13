import { Field, ID, InputType } from "@nestjs/graphql"
import { IsUUID, MaxLength } from "class-validator"

@InputType()
/** Names one command card. */
export class OfficeCandidateIdInput {
    /** The command card. */
    @Field(() => ID)
    @IsUUID("4")
    @MaxLength(36)
    candidateId!: string
}
