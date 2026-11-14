import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** One operation the installed packages call on the CRM, and whether the pinned document serves it. */
export class CrmOperationStateType {
    /** Its name (`nivo.api.crm.nivoweb.get.prices`). */
    @Field(() => String)
    op!: string

    /** `ready`, `missing`, `unsupported` or `mode_mismatch`. */
    @Field(() => String)
    state!: string

    /** The HTTP method in the document, or null when it has none. */
    @Field(() => String, { nullable: true })
    method!: string | null

    /** The path in the document, or null when it has none. */
    @Field(() => String, { nullable: true })
    path!: string | null

    /** The effect the operation marks, or null. */
    @Field(() => String, { nullable: true })
    effect!: string | null
}
