import { Field, ID, InputType } from "@nestjs/graphql"
import { IsUUID, MaxLength } from "class-validator"

@InputType()
/** The pending invitation to send again. */
export class AdminResendWorkspaceInviteInput {
    /** The workspace. */
    @Field(() => ID)
    @IsUUID()
    @MaxLength(36)
    workspaceId!: string

    /** The pending invitation. */
    @Field(() => ID)
    @IsUUID()
    @MaxLength(36)
    inviteId!: string
}
