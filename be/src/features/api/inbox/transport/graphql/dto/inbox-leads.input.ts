import { Field, InputType, Int } from "@nestjs/graphql"
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from "class-validator"

@InputType()
/** What the lead list is asked for: a tab, the filters, the order and the most rows. */
export class InboxLeadsInput {
    /** The tab: `all`, `new`, `needs_you`, `ordered` or `paid`. */
    @Field(() => String, { defaultValue: "all" })
    @IsIn(["all", "new", "needs_you", "ordered", "paid"])
    @MaxLength(20)
    tab = "all"

    /** One channel key, or nothing for every channel. */
    @Field(() => String, { nullable: true })
    @IsOptional()
    @IsIn(["zalo", "telegram", "facebook", "instagram", "website", "bank"])
    @MaxLength(20)
    channel: string | null = null

    /** One agent id, or nothing for every agent. */
    @Field(() => String, { nullable: true })
    @IsOptional()
    @IsUUID()
    @MaxLength(36)
    agentId: string | null = null

    /** The order: `recent`, `oldest`, `name` or `amount`. */
    @Field(() => String, { defaultValue: "recent" })
    @IsIn(["recent", "oldest", "name", "amount"])
    @MaxLength(20)
    sort = "recent"

    /** Words to search the name, phone and words of the customers. */
    @Field(() => String, { nullable: true })
    @IsOptional()
    @IsString()
    @MaxLength(120)
    search: string | null = null

    /** The most customers, 1 to 100. */
    @Field(() => Int, { defaultValue: 60 })
    @IsInt()
    @Min(1)
    @Max(100)
    limit = 60
}
