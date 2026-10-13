import { Field, ObjectType } from "@nestjs/graphql"
import { GraphqlJsonObject } from "@modules/platform/graphql"

@ObjectType()
/** What the flow engine answered. */
export class RunFlowType {
    /** The answer, as the engine builds it. */
    @Field(() => GraphqlJsonObject)
    data!: object
}
