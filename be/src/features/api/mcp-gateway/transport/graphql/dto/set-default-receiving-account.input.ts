import { Field, ID, InputType } from "@nestjs/graphql"
import { IsString, IsUUID, MaxLength } from "class-validator"

@InputType()
/** The payment account the shop receives money on by default: the account a payment QR is drawn on. */
export class SetDefaultReceivingAccountInput {
    /** The connected account: the connection id. */
    @Field(() => ID)
    @IsString()
    @MaxLength(36)
    @IsUUID()
    connectionId!: string
}
