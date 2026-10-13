import { Field, ID, InputType } from "@nestjs/graphql"
import { ArrayMaxSize, IsArray, IsString, IsUUID, MaxLength } from "class-validator"

@InputType()
/** The bounded arguments of updateWebhookEvents. */
export class UpdateWebhookEventsInput {
    /** The connection. */
    @Field(() => ID)
    @IsUUID()
    @MaxLength(64)
    connectionId!: string

    /** The picked events. */
    @Field(() => [String])
    @IsArray()
    @ArrayMaxSize(20)
    @IsString({ each: true })
    @MaxLength(40, { each: true })
    events!: ReadonlyArray<string>
}
