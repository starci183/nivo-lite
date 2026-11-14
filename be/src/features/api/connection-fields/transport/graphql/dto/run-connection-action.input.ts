import { Field, ID, InputType } from "@nestjs/graphql"
import { Type } from "class-transformer"
import { ArrayMaxSize, IsArray, IsOptional, IsString, IsUUID, Matches, MaxLength, ValidateNested } from "class-validator"
import { UpdateConnectionFieldInput } from "./update-connection.input"

@InputType()
/** A run of one declared action of a connected account. */
export class RunConnectionActionInput {
    /** The connected account. */
    @Field(() => ID)
    @IsUUID()
    @MaxLength(64)
    connectionId!: string

    /** The key of the action, as the form read it (`test_send`). */
    @Field(() => String)
    @IsString()
    @MaxLength(40)
    @Matches(/^[a-z][a-z0-9_]{0,39}$/u)
    action!: string

    /** The inputs the action declares; absent = none. */
    @Field(() => [UpdateConnectionFieldInput], { nullable: true })
    @IsOptional()
    @IsArray()
    @ArrayMaxSize(10)
    @ValidateNested({ each: true })
    @Type(() => UpdateConnectionFieldInput)
    fields?: Array<UpdateConnectionFieldInput> | null
}
