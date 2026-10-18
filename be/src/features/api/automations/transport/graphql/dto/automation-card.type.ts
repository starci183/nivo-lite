import { Field, ID, Int, ObjectType } from "@nestjs/graphql"
import { GraphqlJsonObject } from "@modules/platform/graphql"
import { MissingRequirementType } from "./missing-requirement.type"
import { TemplateDefinitionType } from "./template-definition.type"
import { TrustType } from "./trust.type"

@ObjectType()
/** One template card as the screen shows it. */
export class AutomationCardType {
    /** The template key. */
    @Field()
    key!: string

    /** The definition. */
    @Field(() => TemplateDefinitionType)
    def!: TemplateDefinitionType

    /** The pipeline of this workspace, null before the first switch. */
    @Field(() => ID, { nullable: true })
    pipelineId!: string | null

    /** True when the owner switched it on. */
    @Field(() => Boolean)
    enabled!: boolean

    /** True when the owner pressed not for me. */
    @Field(() => Boolean)
    dismissed!: boolean

    /** The settings, resolved and clamped, by key. */
    @Field(() => GraphqlJsonObject)
    config!: object

    /** The approved message template. */
    @Field(() => String, { nullable: true })
    body!: string | null

    /** How many times the body was saved. */
    @Field(() => Int)
    bodyVersion!: number

    /** The context version the body was written from. */
    @Field(() => Int, { nullable: true })
    basedOnContext!: number | null

    /** The context version in force now. */
    @Field(() => Int, { nullable: true })
    currentContext!: number | null

    /** True when the shop information changed after the body was approved. */
    @Field(() => Boolean)
    bodyStale!: boolean

    /** `auto`, `ask` or `never`; null when the template sends none. */
    @Field(() => String, { nullable: true })
    gate!: string | null

    /** The requirements not met. */
    @Field(() => [MissingRequirementType])
    missing!: ReadonlyArray<MissingRequirementType>

    /** False for a capability-gated pack the shop lacks. */
    @Field(() => Boolean)
    proposed!: boolean

    /** True when nothing runs yet. */
    @Field(() => Boolean)
    comingSoon!: boolean

    /** When it last ran, ISO 8601. */
    @Field(() => String, { nullable: true })
    lastRunAt!: string | null

    /** How many runs the history holds. */
    @Field(() => Int)
    runCount!: number

    /** The trust ladder. */
    @Field(() => TrustType)
    trust!: TrustType

    /** `ready`, `missing`, `lost` or `unavailable` for templates that write to Google. */
    @Field(() => String, { nullable: true })
    google?: string

    /** The spreadsheet link for templates that write to Google. */
    @Field(() => String, { nullable: true })
    sheetUrl?: string | null
}
