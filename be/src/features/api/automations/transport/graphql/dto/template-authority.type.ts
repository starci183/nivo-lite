import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** The authority action a template customer message goes through. */
export class TemplateAuthorityType {
    /** The action; null sends nothing to a customer. */
    @Field(() => String, { nullable: true })
    action!: string | null

    /** True when the owner always decides. */
    @Field(() => Boolean, { nullable: true })
    alwaysAsk?: boolean | undefined
}
