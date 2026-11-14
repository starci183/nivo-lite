import { Field, Int, ObjectType } from "@nestjs/graphql"
import { CrmTemplateLabelType } from "./crm-template-label.type"

@ObjectType()
/** A CRM a package declares, as the connect wizard lists it. */
export class CrmTemplateType {
    /** The fixed CRM id. */
    @Field(() => String)
    id!: string

    /** Its name in both languages. */
    @Field(() => CrmTemplateLabelType)
    label!: CrmTemplateLabelType

    /** `bearer` or `header`. */
    @Field(() => String)
    authType!: string

    /** The header the key goes in, else empty. */
    @Field(() => String)
    authName!: string

    /** Where the live document is served under the base URL. */
    @Field(() => String)
    swaggerPath!: string

    /** An example base URL. */
    @Field(() => String)
    baseUrlHint!: string

    /** A documentation link, or empty. */
    @Field(() => String)
    docs!: string

    /** How many operations the installed packages call on it. */
    @Field(() => Int)
    neededCount!: number
}
