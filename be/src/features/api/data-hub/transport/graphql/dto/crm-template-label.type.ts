import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** A CRM template name in both languages. */
export class CrmTemplateLabelType {
    /** Vietnamese. */
    @Field(() => String)
    vi!: string

    /** English. */
    @Field(() => String)
    en!: string
}
