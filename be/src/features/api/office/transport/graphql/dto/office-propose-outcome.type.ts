import { Field, ObjectType } from "@nestjs/graphql"
import { OfficeCandidateType } from "./office-candidate.type"

@ObjectType()
/** What proposing a command answered: a normal chat, a NIVO line or a command card. */
export class OfficeProposeOutcomeType {
    /** `chat`, `reply` or `card`. */
    @Field()
    kind!: string

    /** The line NIVO posted, for `reply`. */
    @Field(() => String, { nullable: true })
    body?: string | null

    /** The card, for `card`. */
    @Field(() => OfficeCandidateType, { nullable: true })
    candidate?: OfficeCandidateType | null
}
