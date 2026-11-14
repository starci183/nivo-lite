import { Field, ID, ObjectType } from "@nestjs/graphql"
import { CrmPinType } from "./crm-pin.type"

@ObjectType()
/** What saving a CRM connection came to; never holds the key. */
export class CrmConnectionType {
    /** The connection. */
    @Field(() => ID)
    connectionId!: string

    /** True when a package declares this CRM. */
    @Field(() => Boolean)
    templated!: boolean

    /** True when every operation the installed packages call is ready. */
    @Field(() => Boolean)
    compatible!: boolean

    /** The operations of the package document the live document lacks. */
    @Field(() => [String])
    driftFromTemplate!: ReadonlyArray<string>

    /** The pin of the live document. */
    @Field(() => CrmPinType)
    pin!: CrmPinType
}
