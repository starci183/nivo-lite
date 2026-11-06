import { Field, ID, InputType, Int } from "@nestjs/graphql"
import { IsBoolean, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from "class-validator"
import { PAGE_DEFAULT, PAGE_MAX } from "@modules/domain/team-chat"

@InputType()
/** Selects one page of a thread. */
export class ChatMessagesInput {
    /** The room. */
    @Field(() => ID)
    @IsUUID("all")
    @MaxLength(36)
    roomId!: string

    /** The page size, from one through the shared maximum. */
    @Field(() => Int, { nullable: true, defaultValue: PAGE_DEFAULT })
    @IsOptional()
    @IsInt()
    @Min(1)
    @Max(PAGE_MAX)
    first: number | null = PAGE_DEFAULT

    /** The cursor of the page before; null for the first page. */
    @Field(() => String, { nullable: true })
    @IsOptional()
    @IsString()
    @MaxLength(512)
    after: string | null = null

    /** Only the pinned messages. */
    @Field(() => Boolean, { nullable: true, defaultValue: false })
    @IsOptional()
    @IsBoolean()
    pinnedOnly: boolean | null = false
}
