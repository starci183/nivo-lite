import { Field, ObjectType } from "@nestjs/graphql"


@ObjectType()
/** Whether another page exists and where it begins. */
export class ChatPageInfoType {
    /** Whether another page exists. */
    @Field(() => Boolean)
    hasNextPage!: boolean

    /** The cursor of the next page. */
    @Field(() => String, { nullable: true })
    endCursor!: string | null
}
