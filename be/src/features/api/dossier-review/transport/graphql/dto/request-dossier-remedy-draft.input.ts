import { IsOptional, IsString, IsUUID, MaxLength } from "class-validator"
import { Field, ID, InputType } from "@nestjs/graphql"

@InputType()
/** A finding to draft the completing document for. */
export class RequestDossierRemedyDraftInput {
    /** The finding. */
    @Field(() => ID)
    @IsUUID()
    @MaxLength(36)
    findingId!: string

    /** Notes for NIVO, at most 1,000 characters. */
    @Field(() => String, { nullable: true })
    @IsOptional()
    @IsString()
    @MaxLength(1000)
    instructions: string | null = null
}
