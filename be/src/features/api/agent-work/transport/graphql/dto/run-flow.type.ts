import { Field, ObjectType } from "@nestjs/graphql"
import { GraphqlJsonObject } from "@modules/platform/graphql"

@ObjectType()
/** What `runFlow` answers. */
export class RunFlowType {
    /** The decided work item (`id`, `status`). */
    @Field(() => GraphqlJsonObject)
    data!: object
}
