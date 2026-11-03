import { Field, Int, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** One saved version of a template. */
export class TemplateVersionType {
    /** The id. */
    @Field(() => String)
    id!: string

    /** The template key. */
    @Field(() => String)
    key!: string

    /** The version. */
    @Field(() => Int)
    version!: number

    /** The hash. */
    @Field(() => String)
    hash!: string

    /** What changed. */
    @Field(() => String)
    changelog!: string

    /** True when the buyer must read it first. */
    @Field(() => Boolean)
    breaking!: boolean

    /** When it was packaged, ISO 8601. */
    @Field(() => String)
    createdAt!: string
}
