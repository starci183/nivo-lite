import { Type } from "class-transformer"
import { Field, ID, InputType, Int } from "@nestjs/graphql"
import { ArrayMaxSize, IsArray, IsIn, IsInt, IsOptional, IsUUID, MaxLength, ValidateNested } from "class-validator"
import { TelegramPickedChatInput } from "./telegram-picked-chat.input"

@InputType()
/** The bounded arguments of saveTelegramUserSetup. */
export class SaveTelegramUserSetupInput {
    /** The Telegram connection. */
    @Field(() => ID)
    @IsUUID()
    @MaxLength(64)
    connectionId!: string

    /** The ticked chats, at most 50. */
    @Field(() => [TelegramPickedChatInput])
    @IsArray()
    @ArrayMaxSize(50)
    @ValidateNested({ each: true })
    @Type(() => TelegramPickedChatInput)
    chats!: Array<TelegramPickedChatInput>

    /** The first window in days: 7 or 30. */
    @Field(() => Int)
    @IsInt()
    @IsIn([7, 30])
    sinceDays!: number

    /** Minutes between syncs: 15 or 60; null is manual only. */
    @Field(() => Int, { nullable: true })
    @IsOptional()
    @IsInt()
    @IsIn([15, 60])
    everyMinutes!: number | null
}
