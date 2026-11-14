import { Field, ObjectType } from "@nestjs/graphql"
import { CrmOperationStateType } from "./crm-operation-state.type"
import { CrmOperationType } from "./crm-operation.type"

@ObjectType()
/** The snapshot of a CRM OpenAPI document a connection serves; never the document itself. */
export class CrmPinType {
    /** The provider key of the CRM (`crm.nivoweb`). */
    @Field(() => String)
    connector!: string

    /** Where the snapshot was fetched from. */
    @Field(() => String)
    swaggerUrl!: string

    /** The sha256 of the canonical document. */
    @Field(() => String)
    documentSha256!: string

    /** When it was pinned, ISO 8601. */
    @Field(() => String)
    pinnedAt!: string

    /** Whether writes act for real. */
    @Field(() => Boolean)
    live!: boolean

    /** The operations the installed packages call, each with its state. */
    @Field(() => [CrmOperationStateType])
    needed!: ReadonlyArray<CrmOperationStateType>

    /** The other operations of the snapshot. */
    @Field(() => [CrmOperationType])
    others!: ReadonlyArray<CrmOperationType>
}
