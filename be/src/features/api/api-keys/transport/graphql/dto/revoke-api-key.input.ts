import { Field, ID, InputType } from "@nestjs/graphql"
import { IsUUID, MaxLength } from "class-validator"

@InputType()
/** The key to revoke. */
export class RevokeApiKeyInput {
    /** The id of the key. */
    @Field(() => ID)
    @IsUUID()
    @MaxLength(36)
    keyId!: string
}
