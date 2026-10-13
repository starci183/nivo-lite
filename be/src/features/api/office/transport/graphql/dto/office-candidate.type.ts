import { Field, ID, ObjectType } from "@nestjs/graphql"
import { GraphqlJsonObject } from "@modules/platform/graphql"
import { OfficeShownRowType } from "./office-shown-row.type"

@ObjectType()
/** One command card of the Office composer. */
export class OfficeCandidateType {
    /** The card id. */
    @Field(() => ID)
    id!: string

    /** The owner message it answers. */
    @Field(() => ID)
    message_id!: string

    /** The receiving module. */
    @Field()
    module!: string

    /** The command key of the receiver. */
    @Field()
    command!: string

    /** The payload the command carries. */
    @Field(() => GraphqlJsonObject)
    payload!: object

    /** One sentence for the owner. */
    @Field()
    summary!: string

    /** The rows the card shows. */
    @Field(() => [OfficeShownRowType])
    shown!: ReadonlyArray<OfficeShownRowType>

    /** `pending`, `sent` or `cancelled`. */
    @Field()
    status!: string

    /** The work item the command became. */
    @Field(() => ID, { nullable: true })
    work_item_id?: string | null

    /** Why the command bus refused it, when it did. */
    @Field(() => String, { nullable: true })
    refusal_detail?: string | null

    /** When it was proposed, ISO 8601. */
    @Field()
    created_at!: string
}
