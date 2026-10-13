import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** A source visible through the public content knowledge lens. */
export class ContentBrandSourceType {
    /** The source title. */
    @Field()
    title!: string

    /** The optional source topic. */
    @Field(() => String, { nullable: true })
    topic!: string | null

    /** Public document content used to ground posts. */
    @Field()
    content!: string
}
