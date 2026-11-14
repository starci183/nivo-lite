import { Field, ObjectType } from "@nestjs/graphql"
import { CrmPinType } from "./crm-pin.type"

@ObjectType()
/** A saved CRM connection as the provider page reopens it; never holds the key. */
export class CrmConnectionViewType {
    /** The CRM id. */
    @Field(() => String)
    crmId!: string

    /** The API base URL. */
    @Field(() => String)
    baseUrl!: string

    /** The Swagger URL of the snapshot. */
    @Field(() => String)
    swaggerUrl!: string

    /** `bearer`, `header`, or empty. */
    @Field(() => String)
    authType!: string

    /** The header the key goes in, else empty. */
    @Field(() => String)
    authName!: string

    /** True when a key is stored; its value is never answered. */
    @Field(() => Boolean)
    hasSecret!: boolean

    /** The pin, or null when no document was pinned. */
    @Field(() => CrmPinType, { nullable: true })
    pin!: CrmPinType | null
}
