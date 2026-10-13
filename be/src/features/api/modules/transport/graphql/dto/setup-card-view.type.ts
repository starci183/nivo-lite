import { Field, ObjectType } from "@nestjs/graphql"
import { GraphqlJsonObject } from "@modules/platform/graphql"
import { SetupCardType } from "./setup-card.type"

@ObjectType()
/** A confirm card with the value it would replace. */
export class SetupCardViewType {
    /** The card. */
    @Field(() => SetupCardType)
    card!: SetupCardType

    /** The fact or rule in force (with its kind); null when the card is decided or nothing is in force. */
    @Field(() => GraphqlJsonObject, { nullable: true })
    current?: object | null
}
