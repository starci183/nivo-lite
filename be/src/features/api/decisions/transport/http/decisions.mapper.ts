import type { AuthoritySheet, CommandResult, WorkItem, WorkItemPage } from "@modules/domain/decisions"
import type { AuthorityProfile } from "@modules/domain/authority"
import type { AuthorityRuleRecord } from "@modules/domain/authority-rules"
import type { ExecutionRow } from "@modules/domain/executions"
import type { ResponsibilityListing, ResponsibilityRecord } from "@modules/domain/responsibilities"
import type { Locale } from "@modules/platform/i18n"
import type { CreateResponsibilityRequest as CreateResponsibilityCommandRequest } from "../../application/create-responsibility.contracts"
import type { DecideExecutionRequest as DecideExecutionCommandRequest } from "../../application/decide-execution.contracts"
import type { DecideWorkItemRequest as DecideWorkItemCommandRequest } from "../../application/decide-work-item.contracts"
import type { ListWorkItemPageRequest } from "../../application/list-work-item-page.contracts"
import type { SaveRuleRequest as SaveRuleCommandRequest } from "../../application/save-rule.contracts"
import type { SendCommandRequest as SendCommandCommandRequest } from "../../application/send-command.contracts"
import type { UpdateAuthorityRequest as UpdateAuthorityCommandRequest } from "../../application/update-authority.contracts"
import type { AuthorityProfileResponse, AuthorityRuleResponse, AuthoritySheetResponse } from "./dto/authority.response"
import type { CommandResultResponse } from "./dto/command-result.response"
import type { CreateResponsibilityRequest } from "./dto/create-responsibility.request"
import type { DecideExecutionRequest } from "./dto/decide-execution.request"
import type { DecideWorkItemRequest } from "./dto/decide-work-item.request"
import type { ExecutionResponse } from "./dto/execution.response"
import type { ListWorkItemsRequest } from "./dto/list-work-items.request"
import type { ResponsibilityListingResponse, ResponsibilityResponse } from "./dto/responsibility.response"
import type { SaveRuleRequest } from "./dto/save-rule.request"
import type { SendCommandRequest } from "./dto/send-command.request"
import type { UpdateAuthorityRequest } from "./dto/update-authority.request"
import type { WorkItemPageResponse } from "./dto/work-item-page.response"
import type { WorkItemResponse } from "./dto/work-item.response"

/** Maps the work item listing of the HTTP request, with the workspace it names, to the query request. */
export const toListWorkItemsRequest = (workspaceId: string, input: ListWorkItemsRequest): ListWorkItemPageRequest => ({
    workspaceId,
    statuses: input.statuses,
    after: input.after,
    limit: input.limit,
})

/** Maps the decision of the HTTP request, with the workspace, the item and the locale, to the command request. */
export const toDecideWorkItemRequest = (
    workspaceId: string,
    workItemId: string,
    locale: Locale,
    input: DecideWorkItemRequest,
): DecideWorkItemCommandRequest => ({
    workspaceId,
    workItemId,
    decision: input.decision,
    edits: input.edits,
    note: input.note,
    basis: input.basis,
    locale,
})

/** Maps the decision of the HTTP request, with the workspace, the card and the locale, to the command request. */
export const toDecideExecutionRequest = (
    workspaceId: string,
    executionId: string,
    locale: Locale,
    input: DecideExecutionRequest,
): DecideExecutionCommandRequest => ({
    workspaceId,
    executionId,
    decision: input.decision,
    editedDraft: input.editedDraft,
    locale,
})

/** Maps the command of the HTTP request, with the workspace and the locale, to the command request. */
export const toSendCommandRequest = (
    workspaceId: string,
    locale: Locale,
    input: SendCommandRequest,
): SendCommandCommandRequest => ({
    workspaceId,
    to: input.to,
    command: input.command,
    reason: input.reason,
    subjectType: input.subjectType,
    subjectId: input.subjectId,
    leadId: input.leadId,
    fields: input.fields,
    locale,
})

/** Maps the authority changes of the HTTP request, with the workspace it names, to the command request. */
export const toUpdateAuthorityRequest = (
    workspaceId: string,
    input: UpdateAuthorityRequest,
): UpdateAuthorityCommandRequest => ({ workspaceId, patch: input })

/** Maps the rule of the HTTP request, with the workspace it names, to the command request. */
export const toSaveRuleRequest = (workspaceId: string, input: SaveRuleRequest): SaveRuleCommandRequest => ({
    workspaceId,
    change: input,
})

/** Maps the new responsibility of the HTTP request, with the workspace it names, to the command request. */
export const toCreateResponsibilityRequest = (
    workspaceId: string,
    input: CreateResponsibilityRequest,
): CreateResponsibilityCommandRequest => ({ workspaceId, input })

/** Maps one work item to the HTTP response. */
export const toWorkItemResponse = (item: WorkItem): WorkItemResponse => ({ ...item })

/** Maps a page of work items to the HTTP response. */
export const toWorkItemPageResponse = (page: WorkItemPage): WorkItemPageResponse => ({ ...page })

/** Maps an approval card after a decision to the HTTP response. */
export const toExecutionResponse = (card: ExecutionRow): ExecutionResponse => ({ ...card })

/** Maps the answer of the command bus to the HTTP response. */
export const toCommandResultResponse = (result: CommandResult): CommandResultResponse => ({ ...result })

/** Maps the goals and house rules to the HTTP response. */
export const toAuthorityProfileResponse = (profile: AuthorityProfile): AuthorityProfileResponse => ({ ...profile })

/** Maps one stored rule to the HTTP response. */
export const toAuthorityRuleResponse = (rule: AuthorityRuleRecord): AuthorityRuleResponse => ({ ...rule })

/** Maps the authority sheet to the HTTP response. */
export const toAuthoritySheetResponse = (sheet: AuthoritySheet): AuthoritySheetResponse => ({ ...sheet })

/** Maps one responsibility to the HTTP response. */
export const toResponsibilityResponse = (record: ResponsibilityRecord): ResponsibilityResponse => ({ ...record })

/** Maps the responsibilities with their customer to the HTTP response. */
export const toResponsibilitiesResponse = (
    result: ReadonlyArray<ResponsibilityListing>,
): Array<ResponsibilityListingResponse> => result.map((entry) => ({ ...entry }))
