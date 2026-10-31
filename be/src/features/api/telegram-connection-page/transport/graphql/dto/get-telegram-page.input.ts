import { Field, ID, InputType } from "@nestjs/graphql"
import { IsUUID, MaxLength } from "class-validator"

@InputType()
/** The bounded arguments of telegramPage. */
export class GetTelegramPageInput {
    /** The connection. */
    @Field(() => ID)
    @IsUUID()
    @MaxLength(64)
    connectionId!: string
}
