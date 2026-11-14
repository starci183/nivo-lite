import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** What setting the enterprise identifier of a workspace answers. */
export class AdminEnterpriseKeySetType {
    /** The identifier the workspace now carries; null for an ordinary workspace. */
    @Field(() => String, { nullable: true })
    enterpriseKey!: string | null
}
