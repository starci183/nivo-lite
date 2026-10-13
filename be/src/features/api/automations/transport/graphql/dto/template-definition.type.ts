import { Field, Int, ObjectType } from "@nestjs/graphql"
import { GraphqlJsonObject } from "@modules/platform/graphql"
import { LocalizedTextType } from "./localized-text.type"
import { TemplateAuthorityType } from "./template-authority.type"
import { TemplateN8nType } from "./template-n8n.type"
import { TemplateRequirementsType } from "./template-requirements.type"
import { TemplateSettingType } from "./template-setting.type"
import { TemplateTriggerType } from "./template-trigger.type"

@ObjectType()
/** One ready-made automation of the catalogue. */
export class TemplateDefinitionType {
    /** The stable key. */
    @Field()
    key!: string

    /** The version of the definition. */
    @Field(() => Int)
    version!: number

    /** Where the card sorts in the gallery. */
    @Field(() => Int)
    position!: number

    /** The pack the template belongs to. */
    @Field()
    pack!: string

    /** `implemented`, `n8n` or `definition`. */
    @Field()
    executor!: string

    /** For executor `n8n`: the webhook and the audience. */
    @Field(() => TemplateN8nType, { nullable: true })
    n8n?: TemplateN8nType | undefined

    /** The one module that owns it, or null. */
    @Field(() => String, { nullable: true })
    moduleKey!: string | null

    /** The icon word of the card. */
    @Field()
    icon!: string

    /** The name of the card. */
    @Field(() => LocalizedTextType)
    name!: LocalizedTextType

    /** One line. */
    @Field(() => LocalizedTextType)
    description!: LocalizedTextType

    /** What starts it. */
    @Field(() => TemplateTriggerType)
    trigger!: TemplateTriggerType

    /** What it needs. */
    @Field(() => TemplateRequirementsType)
    requires!: TemplateRequirementsType

    /** The settings the owner can change. */
    @Field(() => [TemplateSettingType])
    settings!: ReadonlyArray<TemplateSettingType>

    /** `fixed`, `ai_per_case` or `none`. */
    @Field()
    contentMode!: string

    /** What the message must never do. */
    @Field(() => [LocalizedTextType])
    guardrails!: ReadonlyArray<LocalizedTextType>

    /** The variable names the body may use. */
    @Field(() => [String])
    variables!: ReadonlyArray<string>

    /** The starting wording. */
    @Field(() => LocalizedTextType, { nullable: true })
    defaultBody!: LocalizedTextType | null

    /** The authority action of the customer message. */
    @Field(() => TemplateAuthorityType)
    authority!: TemplateAuthorityType

    /** The starting values of the settings, by key. */
    @Field(() => GraphqlJsonObject)
    defaults!: object
}
