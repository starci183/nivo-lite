import { Field, ID, InputType } from "@nestjs/graphql"
import { IsOptional, IsString, IsUUID, Matches, MaxLength, MinLength } from "class-validator"

@InputType()
/** The bounded arguments that set or clear the enterprise identifier of a workspace. */
export class AdminSetWorkspaceEnterpriseKeyInput {
    /** The workspace. */
    @Field(() => ID)
    @IsUUID()
    @MaxLength(36)
    workspaceId!: string

    /** The enterprise identifier, a lowercase slug; null or absent clears it, making the workspace an ordinary one. */
    @Field(() => String, { nullable: true })
    @IsOptional()
    @IsString()
    @MinLength(1)
    @MaxLength(40)
    @Matches(/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/)
    enterpriseKey: string | null = null
}
