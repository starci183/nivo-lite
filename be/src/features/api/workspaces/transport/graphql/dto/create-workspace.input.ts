import { Field, InputType } from "@nestjs/graphql"
import { IsString, MaxLength, MinLength } from "class-validator"

@InputType()
/** The bounded arguments that create a free workspace. */
export class CreateWorkspaceInput {
    /** The name of the new workspace. */
    @Field()
    @IsString()
    @MinLength(1)
    @MaxLength(120)
    name!: string
}
