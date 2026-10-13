import { Field, InputType } from "@nestjs/graphql"
import { IsObject, IsString, Matches, MaxLength } from "class-validator"
import { GraphqlJsonObject } from "@modules/platform/graphql"

@InputType()
/** A business event a member reports. */
export class EmitAutomationEventInput {
    /** The event name, a dotted identifier. */
    @Field()
    @Matches(/^[a-z][a-z0-9_.-]{0,79}$/u)
    @MaxLength(80)
    event!: string

    /** Unique per occurrence. */
    @Field()
    @IsString()
    @MaxLength(300)
    dedupe!: string

    /** What the event carries. */
    @Field(() => GraphqlJsonObject)
    @IsObject()
    data!: object
}
