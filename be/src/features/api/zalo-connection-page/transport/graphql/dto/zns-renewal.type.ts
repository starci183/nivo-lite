import { Field, ObjectType } from "@nestjs/graphql"
import { ZnsRenewalParamsType } from "./zns-renewal-params.type"

@ObjectType()
/** The ZNS renewal template a Zalo OA connection uses outside the 48-hour window. */
export class ZnsRenewalType {
    /** The approved ZNS template id. */
    @Field(() => String)
    templateId!: string

    /** The parameter names of the template. */
    @Field(() => ZnsRenewalParamsType)
    params!: ZnsRenewalParamsType
}
