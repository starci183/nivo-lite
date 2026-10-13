import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** Where a shared n8n workflow listens and who receives its email. */
export class TemplateN8nType {
    /** The webhook path under the n8n base. */
    @Field()
    webhook!: string

    /** The data endpoints the workflow reads. */
    @Field(() => [String], { nullable: true })
    data?: ReadonlyArray<string> | undefined

    /** `owner` or `customer`. */
    @Field()
    audience!: string
}
