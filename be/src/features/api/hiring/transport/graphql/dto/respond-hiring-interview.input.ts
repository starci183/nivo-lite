import { Field, InputType } from "@nestjs/graphql"
import { IsOptional, IsString, MaxLength } from "class-validator"

@InputType()
/** The bounded arguments that pick an interview time. */
export class RespondHiringInterviewInput {
    /** The link token. */
    @Field(() => String)
    @IsString()
    @MaxLength(200)
    token!: string

    /** The chosen start, ISO; absent says no time fits. */
    @Field(() => String, { nullable: true })
    @IsOptional()
    @IsString()
    @MaxLength(40)
    start?: string
}
