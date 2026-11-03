import { Field, ObjectType } from "@nestjs/graphql"
import { TemplateTextType } from "./template-text.type"
import { TemplateVersionType } from "./template-version.type"

@ObjectType()
/** A template of the caller with its versions. */
export class TemplateType {
    /** The id. */
    @Field(() => String)
    id!: string

    /** The key. */
    @Field(() => String)
    key!: string

    /** The module it stands on. */
    @Field(() => String)
    baseModule!: string

    /** The name. */
    @Field(() => TemplateTextType)
    name!: TemplateTextType

    /** The versions, newest first. */
    @Field(() => [TemplateVersionType])
    versions!: Array<TemplateVersionType>
}
