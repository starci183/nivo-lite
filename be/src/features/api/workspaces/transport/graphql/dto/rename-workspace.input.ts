import { Field, InputType } from "@nestjs/graphql"
import { IsString, MaxLength, MinLength } from "class-validator"

@InputType()
/** The new name of the workspace the request names. */
export class RenameWorkspaceInput {
    /** The new name. */
    @Field()
    @IsString()
    @MinLength(1)
    @MaxLength(120)
    name!: string
}
