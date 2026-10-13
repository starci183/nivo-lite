import { Field, ObjectType } from "@nestjs/graphql"
import { AdminCountType } from "./admin-count.type"

@ObjectType()
/** The knowledge sources of one kind, counted by status. */
export class AdminKnowledgeKindType {
    /** The kind. */
    @Field()
    kind!: string

    /** The by status. */
    @Field(() => [AdminCountType])
    byStatus!: Array<AdminCountType>
}
