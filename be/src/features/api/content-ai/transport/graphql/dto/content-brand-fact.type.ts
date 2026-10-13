import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** One approved public fact from the workspace brain. */
export class ContentBrandFactType {
    /** The fact subject label. */
    @Field()
    subject!: string

    /** The fact attribute label. */
    @Field()
    attribute!: string

    /** The approved value. */
    @Field()
    value!: string
}
