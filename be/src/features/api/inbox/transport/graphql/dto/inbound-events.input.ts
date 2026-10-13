import { Field, InputType, Int } from "@nestjs/graphql"
import { IsInt, Max, Min } from "class-validator"

@InputType()
/** A bounded inbox feed; the page normally requests forty events. */
export class InboundEventsInput {
    /** Maximum number of events, between one and one hundred. */
    @Field(() => Int, { defaultValue: 40 })
    @IsInt()
    @Min(1)
    @Max(100)
    limit = 40
}
