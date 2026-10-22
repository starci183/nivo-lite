import type { AuthorityProfile } from "@modules/domain/authority"
import type { AuthorityRuleRecord } from "@modules/domain/authority-rules"
import type { AuthoritySheet, CommandResult, DecisionRecord, WorkItem, WorkItemPage } from "@modules/domain/decisions"
import type { ExecutionRow } from "@modules/domain/executions"
import type { DirectoryMember, MemberGrant } from "@modules/domain/member-grants"
import type { ResponsibilityListing, ResponsibilityRecord } from "@modules/domain/responsibilities"
import type { Locale } from "@modules/platform/i18n"
import type { CreateResponsibilityRequest } from "../../application/create-responsibility.contracts"
import type { DecideExecutionRequest } from "../../application/decide-execution.contracts"
import type { AssignWorkItemRequest } from "../../application/assign-work-item.contracts"
import type { DecideWorkItemRequest } from "../../application/decide-work-item.contracts"
import type { HoldWorkItemRequest } from "../../application/hold-work-item.contracts"
import type { ListApproversRequest } from "../../application/list-approvers.contracts"
import type { ListDecisionHistoryRequest } from "../../application/list-decision-history.contracts"
import type { ListMemberGrantsRequest } from "../../application/list-member-grants.contracts"
import type { GetWorkItemRequest } from "../../application/get-work-item.contracts"
import type { ListResponsibilitiesRequest } from "../../application/list-responsibilities.contracts"
import type { ListWorkItemPageRequest } from "../../application/list-work-item-page.contracts"
import type { ReadAuthorityRequest } from "../../application/read-authority.contracts"
import type { SaveMemberGrantsRequest } from "../../application/save-member-grants.contracts"
import type { SaveRuleRequest } from "../../application/save-rule.contracts"
import type { SendCommandRequest } from "../../application/send-command.contracts"
import type { UpdateAuthorityRequest } from "../../application/update-authority.contracts"
import type { UpdateResponsibilityStatusRequest } from "../../application/update-responsibility-status.contracts"
import type { AgentCommandResultType } from "./dto/agent-command-result.type"
import type { ApprovalExecutionType } from "./dto/approval-execution.type"
import type { ApproverMemberType } from "./dto/approver-member.type"
import type { AuthorityProfileType } from "./dto/authority-profile.type"
import type { AuthorityRuleType } from "./dto/authority-rule.type"
import type { AuthoritySheetType } from "./dto/authority-sheet.type"
import type { CreateResponsibilityInput } from "./dto/create-responsibility.input"
import type { DecideExecutionInput } from "./dto/decide-execution.input"
import type { DecisionRecordType } from "./dto/decision-record.type"
import type { ListDecisionHistoryInput } from "./dto/list-decision-history.input"
import type { MemberGrantType } from "./dto/member-grant.type"
import type { MemberGrantsInput } from "./dto/member-grants.input"
import type { AssignWorkItemInput } from "./dto/assign-work-item.input"
import type { DecideWorkItemInput } from "./dto/decide-work-item.input"
import type { HoldWorkItemInput } from "./dto/hold-work-item.input"
import type { ListWorkItemsInput } from "./dto/list-work-items.input"
import type { ResponsibilityListingType } from "./dto/responsibility-listing.type"
import type { ResponsibilityType } from "./dto/responsibility.type"
import type { SaveAuthorityRuleInput } from "./dto/save-authority-rule.input"
import type { SaveMemberGrantsInput } from "./dto/save-member-grants.input"
import type { SendAgentCommandInput } from "./dto/send-agent-command.input"
import type { UpdateAuthorityInput } from "./dto/update-authority.input"
import type { UpdateResponsibilityStatusInput } from "./dto/update-responsibility-status.input"
import type { WorkItemIdInput } from "./dto/work-item-id.input"
import type { WorkItemPageType } from "./dto/work-item-page.type"
import type { WorkItemType } from "./dto/work-item.type"

/** Maps the work item listing of the GraphQL input, with the workspace it names, to the query request. */
export const toListWorkItemsRequest = (workspaceId: string, input: ListWorkItemsInput): ListWorkItemPageRequest => ({
    workspaceId,
    statuses: input.statuses,
    action: input.action,
    after: input.after,
    limit: input.limit,
})

/** Maps the id of the GraphQL input, with the workspace it names, to the query request. */
export const toGetWorkItemRequest = (workspaceId: string, input: WorkItemIdInput): GetWorkItemRequest => ({
    workspaceId,
    ...input,
})

/** Maps the hold note of the GraphQL input, with the workspace and the locale, to the command request. */
export const toHoldWorkItemRequest = (
    workspaceId: string,
    input: HoldWorkItemInput,
    locale: Locale,
): HoldWorkItemRequest => ({ workspaceId, locale, ...input })

/** Maps the assignment of the GraphQL input, with the workspace and the locale, to the command request. */
export const toAssignWorkItemRequest = (
    workspaceId: string,
    input: AssignWorkItemInput,
    locale: Locale,
): AssignWorkItemRequest => ({ workspaceId, locale, ...input })

/** Maps the decision of the GraphQL input, with the workspace and the locale, to the command request. */
export const toDecideWorkItemRequest = (
    workspaceId: string,
    input: DecideWorkItemInput,
    locale: Locale,
): DecideWorkItemRequest => ({ workspaceId, locale, ...input })

/** Maps the decision of the GraphQL input, with the workspace and the locale, to the command request. */
export const toDecideExecutionRequest = (
    workspaceId: string,
    input: DecideExecutionInput,
    locale: Locale,
): DecideExecutionRequest => ({ workspaceId, locale, ...input })

/** Maps the command of the GraphQL input, with the workspace and the locale, to the command request. */
export const toSendCommandRequest = (
    workspaceId: string,
    input: SendAgentCommandInput,
    locale: Locale,
): SendCommandRequest => ({ workspaceId, locale, ...input })

/** Maps the workspace of the request to the authority query request. */
export const toReadAuthorityRequest = (workspaceId: string): ReadAuthorityRequest => ({ workspaceId })

/** Maps the authority changes of the GraphQL input, with the workspace, to the command request. */
export const toUpdateAuthorityRequest = (workspaceId: string, input: UpdateAuthorityInput): UpdateAuthorityRequest => ({
    workspaceId,
    ...input,
})

/** Maps the rule of the GraphQL input, with the workspace, to the command request. */
export const toSaveRuleRequest = (workspaceId: string, input: SaveAuthorityRuleInput): SaveRuleRequest => ({
    workspaceId,
    ...input,
})

/** Maps the workspace of the request to the approver directory query request. */
export const toListApproversRequest = (workspaceId: string): ListApproversRequest => ({ workspaceId })

/** Maps the action of the GraphQL input, with the workspace, to the member grants query request. */
export const toListMemberGrantsRequest = (workspaceId: string, input: MemberGrantsInput): ListMemberGrantsRequest => ({
    workspaceId,
    ...input,
})

/** Maps the limits of the GraphQL input, with the workspace, to the command request. */
export const toSaveMemberGrantsRequest = (
    workspaceId: string,
    input: SaveMemberGrantsInput,
): SaveMemberGrantsRequest => ({
    workspaceId,
    action: input.action,
    grants: input.grants.map((grant) => ({ memberId: grant.memberId, maxAmount: grant.maxAmount })),
})

/** Maps the people an approver group can name to the GraphQL type. */
export const toApproverMembersType = (members: ReadonlyArray<DirectoryMember>): Array<ApproverMemberType> =>
    members.map((member) => ({
        memberId: member.memberId,
        name: member.name,
        role: member.role,
        status: member.status,
        rooms: member.rooms,
    }))

/** Maps the approval limits of one action to the GraphQL type. */
export const toMemberGrantsType = (grants: ReadonlyArray<MemberGrant>): Array<MemberGrantType> =>
    grants.map((grant) => ({
        memberId: grant.member_id,
        action: grant.action,
        unit: grant.unit,
        maxAmount: grant.max_amount,
    }))

/** Maps the workspace of the request to the responsibilities query request. */
export const toListResponsibilitiesRequest = (workspaceId: string): ListResponsibilitiesRequest => ({ workspaceId })

/** Maps the new responsibility of the GraphQL input, with the workspace, to the command request. */
export const toCreateResponsibilityRequest = (
    workspaceId: string,
    input: CreateResponsibilityInput,
): CreateResponsibilityRequest => ({ workspaceId, ...input })

/** Maps the status move of the GraphQL input, with the workspace, to the command request. */
export const toUpdateResponsibilityStatusRequest = (
    workspaceId: string,
    input: UpdateResponsibilityStatusInput,
): UpdateResponsibilityStatusRequest => ({ workspaceId, ...input })

/** Maps one work item to the GraphQL type. */
export const toWorkItemType = (item: WorkItem): WorkItemType => ({ ...item })

/** Maps a page of work items to the GraphQL type. */
export const toWorkItemPageType = (page: WorkItemPage): WorkItemPageType => ({ ...page })

/** Maps an approval card after a decision to the GraphQL type. */
export const toApprovalExecutionType = (card: ExecutionRow): ApprovalExecutionType => ({ ...card })

/** Maps the answer of the command bus to the GraphQL type. */
export const toAgentCommandResultType = (result: CommandResult): AgentCommandResultType => ({ ...result })

/** Maps the goals and house rules to the GraphQL type. */
export const toAuthorityProfileType = (profile: AuthorityProfile): AuthorityProfileType => ({ ...profile })

/** Maps one stored rule to the GraphQL type. */
export const toAuthorityRuleType = (rule: AuthorityRuleRecord): AuthorityRuleType => ({ ...rule })

/** Maps the authority sheet to the GraphQL type. */
export const toAuthoritySheetType = (sheet: AuthoritySheet): AuthoritySheetType => ({ ...sheet })

/** Maps one responsibility to the GraphQL type. */
export const toResponsibilityType = (record: ResponsibilityRecord): ResponsibilityType => ({ ...record })

/** Maps the responsibilities with their customer to the GraphQL type. */
export const toResponsibilityListingsType = (
    result: ReadonlyArray<ResponsibilityListing>,
): Array<ResponsibilityListingType> => result.map((entry) => ({ ...entry }))

/** Maps the history listing of the GraphQL input, with the workspace it names, to the query request. */
export const toListDecisionHistoryRequest = (
    workspaceId: string,
    input: ListDecisionHistoryInput,
): ListDecisionHistoryRequest => ({ workspaceId, ...input })

/** Maps the lines of the decision log to the GraphQL type. */
export const toDecisionRecordsType = (records: ReadonlyArray<DecisionRecord>): Array<DecisionRecordType> =>
    records.map((record) => ({ ...record }))
