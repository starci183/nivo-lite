import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** A customer question waiting for a person. */
export class ChatbotEscalationType {
    /** The work item id value. */
    @Field(() => ID)
    workItemId!: string

    /** The question value. */
    @Field(() => String)
    question!: string

    /** The draft value. */
    @Field(() => String)
    draft!: string

    /** The staff name value. */
    @Field(() => String, { nullable: true })
    staffName!: string | null

    /** The since value. */
    @Field(() => String)
    since!: string
}
