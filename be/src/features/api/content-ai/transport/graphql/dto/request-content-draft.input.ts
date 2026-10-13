import { Field, InputType } from "@nestjs/graphql"
import { IsOptional, IsString, IsUUID, MaxLength } from "class-validator"

@InputType()
/** Bounded inputs to requestContentDraft. */
export class RequestContentDraftInput {
    /** The existing idea or draft. */
    @Field()
    @IsUUID()
    @MaxLength(36)
    id!: string

    /** Optional guidance for the rewrite. */
    @Field({ nullable: true })
    @IsOptional()
    @IsString()
    @MaxLength(12000)
    hint?: string
}
