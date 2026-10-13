import { Field, ID, InputType } from "@nestjs/graphql"
import { IsUUID, MaxLength } from "class-validator"

@InputType()
/** Names the device to sign out. */
export class RevokeSessionInput {
    /** The Auth session of the device. */
    @Field(() => ID)
    @IsUUID()
    @MaxLength(36)
    sessionId!: string
}
