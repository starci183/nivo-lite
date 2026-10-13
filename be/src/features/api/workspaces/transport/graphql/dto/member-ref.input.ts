import { Field, ID, InputType } from "@nestjs/graphql"
import { IsUUID, MaxLength } from "class-validator"

@InputType()
/** Names one member of the caller's workspace. */
export class MemberRefInput {
    /** The member's Auth user. */
    @Field(() => ID)
    @IsUUID()
    @MaxLength(36)
    userId!: string
}
