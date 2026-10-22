import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** A person, agent or group a composer can tag. */
export class MentionOptionType {
    /** member, agent or group. */
    @Field()
    kind!: string

    /** The id to tag. */
    @Field()
    id!: string

    /** The name. */
    @Field()
    name!: string

    /** A member's role, an agent's module or a group's kind. */
    @Field()
    role!: string
}
