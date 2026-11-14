import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** One operation of the pinned document no installed package calls. */
export class CrmOperationType {
    /** Its name. */
    @Field(() => String)
    op!: string

    /** The HTTP method. */
    @Field(() => String)
    method!: string

    /** The path. */
    @Field(() => String)
    path!: string
}
