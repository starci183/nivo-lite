import { Field, InputType } from "@nestjs/graphql"
import { IsIn, IsString, MaxLength } from "class-validator"

@InputType()
/** The bounded arguments that load one starter set. */
export class ApplyInventoryStarterInput {
    /** The starter set key. */
    @Field(() => String)
    @IsString()
    @IsIn(["cafe", "retail", "building", "spa"])
    @MaxLength(40)
    key!: string
}
