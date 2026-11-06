import { Field, InputType } from "@nestjs/graphql"
import { IsString, Matches, MaxLength, MinLength } from "class-validator"

@InputType()
/** The action whose approval limits are read. */
export class MemberGrantsInput {
    /** The action key. */
    @Field()
    @IsString()
    @Matches(/^[a-z0-9_]+$/)
    @MinLength(1)
    @MaxLength(80)
    action!: string
}
