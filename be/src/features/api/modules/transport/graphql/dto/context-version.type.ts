import { Field, ID, Int, ObjectType } from "@nestjs/graphql"
import { GraphqlJsonObject } from "@modules/platform/graphql"

@ObjectType()
/** One applied, immutable context version of an installation. */
export class ContextVersionType {
    /** The version. */
    @Field(() => ID)
    id!: string

    /** The installation. */
    @Field(() => ID)
    installationId!: string

    /** The number of the version, from 1. */
    @Field(() => Int)
    version!: number

    /** What was frozen: summary, facts and the confirmed gates. */
    @Field(() => GraphqlJsonObject)
    snapshot!: object

    /** Who applied it. */
    @Field()
    appliedBy!: string

    /** When it was applied, ISO 8601. */
    @Field()
    appliedAt!: string
}
