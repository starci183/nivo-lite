import { Field, InputType } from "@nestjs/graphql"
import { IsString, MaxLength, MinLength } from "class-validator"
import { ITEM_KEY_MAX } from "@modules/domain/agent-doors"

@InputType()
/** The bounded arguments of runScheduledItemNow. */
export class RunScheduledItemNowInput {
    /** The item key, as scheduledItems gave it. */
    @Field(() => String)
    @IsString()
    @MinLength(1)
    @MaxLength(ITEM_KEY_MAX)
    id!: string
}
