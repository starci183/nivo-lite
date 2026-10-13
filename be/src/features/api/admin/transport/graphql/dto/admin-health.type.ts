import { Field, ObjectType } from "@nestjs/graphql"
import { AdminSignupDayType } from "./admin-signup-day.type"
import { AdminPlatformTransferType } from "./admin-platform-transfer.type"
import { AdminCountType } from "./admin-count.type"
import { AdminPlatformBillingEventType } from "./admin-platform-billing-event.type"
import { AdminPlatformErrorType } from "./admin-platform-error.type"
import { AdminAuditType } from "./admin-audit.type"
import { AdminWorkspaceNameType } from "./admin-workspace-name.type"

@ObjectType()
/** The platform health page. */
export class AdminHealthType {
    /** The signups. */
    @Field(() => [AdminSignupDayType])
    signups!: Array<AdminSignupDayType>

    /** The transfers. */
    @Field(() => [AdminPlatformTransferType])
    transfers!: Array<AdminPlatformTransferType>

    /** The transfer counts. */
    @Field(() => [AdminCountType])
    transferCounts!: Array<AdminCountType>

    /** The billing events. */
    @Field(() => [AdminPlatformBillingEventType])
    billingEvents!: Array<AdminPlatformBillingEventType>

    /** The errors. */
    @Field(() => [AdminPlatformErrorType])
    errors!: Array<AdminPlatformErrorType>

    /** The error scopes. */
    @Field(() => [AdminCountType])
    errorScopes!: Array<AdminCountType>

    /** The audits. */
    @Field(() => [AdminAuditType])
    audits!: Array<AdminAuditType>

    /** The workspace names. */
    @Field(() => [AdminWorkspaceNameType])
    workspaceNames!: Array<AdminWorkspaceNameType>
}
