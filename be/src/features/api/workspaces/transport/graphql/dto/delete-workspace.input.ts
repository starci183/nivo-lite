import { Field, InputType } from "@nestjs/graphql"
import { IsString, MaxLength, MinLength } from "class-validator"

@InputType()
/** The owner's confirmation of deleting the workspace the request names. */
export class DeleteWorkspaceInput {
    /** The workspace name, typed by the owner. */
    @Field()
    @IsString()
    @MinLength(1)
    @MaxLength(120)
    confirmName!: string
}
