import { Field, ID, InputType } from "@nestjs/graphql"
import { IsOptional, IsString, IsUUID, MaxLength } from "class-validator"

@InputType()
/** The bounded arguments that create or rename one stock location. */
export class SaveInventoryLocationInput {
    /** The location to rename; absent creates one. */
    @Field(() => ID, { nullable: true })
    @IsOptional()
    @IsUUID("4")
    @MaxLength(36)
    id?: string

    /** The location name. */
    @Field(() => String)
    @IsString()
    @MaxLength(120)
    name!: string
}
