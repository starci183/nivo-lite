import { Field, ID, InputType } from "@nestjs/graphql"
import { IsOptional, IsString, IsUUID, MaxLength } from "class-validator"

@InputType()
/** The bounded arguments that create or update one position. */
export class SaveShiftsPositionInput {
    /** The position to update; absent creates one. */
    @Field(() => ID, { nullable: true })
    @IsOptional()
    @IsUUID("4")
    @MaxLength(36)
    id?: string

    /** The position name. */
    @Field(() => String)
    @IsString()
    @MaxLength(80)
    name!: string

    /** The colour the grid draws it in; absent picks the default. */
    @Field(() => String, { nullable: true })
    @IsOptional()
    @IsString()
    @MaxLength(40)
    color?: string
}
