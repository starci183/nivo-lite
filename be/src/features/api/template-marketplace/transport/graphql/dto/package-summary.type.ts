import { Field, Int, ObjectType } from "@nestjs/graphql"
import { ProposedRightType } from "./proposed-right.type"
import { TemplateParameterType } from "./template-parameter.type"

@ObjectType()
/** What a package holds, for the preview. */
export class PackageSummaryType {
    /** The key. */
    @Field(() => String)
    key!: string

    /** The version it would be saved as. */
    @Field(() => Int)
    version!: number

    /** The hash of the package. */
    @Field(() => String)
    hash!: string

    /** The module it stands on. */
    @Field(() => String)
    baseModule!: string

    /** The providers the buyer must connect. */
    @Field(() => [String])
    requiredProviders!: Array<string>

    /** The actions that need a rule in the buyer's authority matrix. */
    @Field(() => [String])
    requiredAuthorityActions!: Array<string>

    /** How many public documents the buyer starts with. */
    @Field(() => Int)
    starterKnowledge!: number

    /** The settings of the buyer. */
    @Field(() => [TemplateParameterType])
    parameters!: Array<TemplateParameterType>

    /** The rights proposed. */
    @Field(() => [ProposedRightType])
    proposedRights!: Array<ProposedRightType>

    /** The real person the persona is modelled on, or null. */
    @Field(() => String, { nullable: true })
    personName!: string | null
}
