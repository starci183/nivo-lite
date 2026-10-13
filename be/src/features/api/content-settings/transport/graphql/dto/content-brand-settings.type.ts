import { Field, ObjectType, ID } from "@nestjs/graphql"
import { ContentAutomationFlagsType } from "./content-automation-flags.type"
import { ContentAutomationMarkType } from "./content-automation-mark.type"

@ObjectType()
/** ContentBrandSettings returned by content settings operations. */
export class ContentBrandSettingsType {
    /** workspaceId. */
    @Field(() => ID)
    workspaceId!: string

    /** brandVoice. */
    @Field()
    brandVoice!: string

    /** avoid. */
    @Field()
    avoid!: string

    /** cta. */
    @Field()
    cta!: string

    /** hashtags. */
    @Field(() => [String])
    hashtags!: Array<string>

    /** automations. */
    @Field(() => ContentAutomationFlagsType)
    automations!: ContentAutomationFlagsType

    /** marks. */
    @Field(() => [ContentAutomationMarkType])
    marks!: Array<ContentAutomationMarkType>
}
