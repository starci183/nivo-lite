import { Field, ID, InputType } from "@nestjs/graphql"
import { IsString, IsUUID, MaxLength } from "class-validator"

@InputType()
/** The bounded arguments of sendZaloTestMessage. */
export class SendZaloTestInput {
    /** The connection. */
    @Field(() => ID)
    @IsUUID()
    @MaxLength(64)
    connectionId!: string

    /** The Zalo user id of the follower. */
    @Field(() => String)
    @IsString()
    @MaxLength(64)
    recipientId!: string

    /** The text to send. */
    @Field(() => String)
    @IsString()
    @MaxLength(500)
    text!: string
}
