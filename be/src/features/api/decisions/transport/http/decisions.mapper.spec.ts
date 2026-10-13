import "reflect-metadata"
import { builder } from "@starci/jest-preset"
import type { WorkItem } from "@modules/domain/decisions"
import type { ResponsibilityListing } from "@modules/domain/responsibilities"
import { CreateResponsibilityRequest } from "./dto/create-responsibility.request"
import { DecideExecutionRequest } from "./dto/decide-execution.request"
import { DecideWorkItemRequest } from "./dto/decide-work-item.request"
import { ListWorkItemsRequest } from "./dto/list-work-items.request"
import { SaveRuleRequest } from "./dto/save-rule.request"
import { SendCommandRequest } from "./dto/send-command.request"
import { UpdateAuthorityRequest } from "./dto/update-authority.request"
import {
    toAuthorityProfileResponse,
    toAuthorityRuleResponse,
    toAuthoritySheetResponse,
    toCommandResultResponse,
    toCreateResponsibilityRequest,
    toDecideExecutionRequest,
    toDecideWorkItemRequest,
    toExecutionResponse,
    toListWorkItemsRequest,
    toResponsibilitiesResponse,
    toResponsibilityResponse,
    toSaveRuleRequest,
    toSendCommandRequest,
    toUpdateAuthorityRequest,
    toWorkItemPageResponse,
    toWorkItemResponse,
} from "./decisions.mapper"

const itemOf = builder<WorkItem>({
    id: "item-1",
    workspace_id: "ws-1",
    department: "sales",
    action: "send_follow_up",
    subject_type: "lead",
    subject_id: "lead-1",
    lead_id: "lead-1",
    inbound_event_id: null,
    parent_id: null,
    chain_id: null,
    depth: 0,
    status: "waiting_decision",
    decided_path: null,
    reason: "over_authority",
    reasons: ["over_authority"],
    missing_fields: [],
    proposal: { summary: "Send", fields: {} },
    result: null,
    error: null,
    evidence_state: "pending",
    assigned_staff_id: null,
    execution_id: null,
    origin: "live",
    created_at: "2026-10-12T10:00:00.000Z",
    updated_at: "2026-10-12T10:00:00.000Z",
    completed_at: null,
    installation_id: null,
})

describe("decisions mapper", () => {
    it("maps the listing, the decisions and the command with the workspace and locale they are given", () => {
        const list = Object.assign(new ListWorkItemsRequest(), { after: { createdAt: "2026-10-12", id: "a" } })
        expect(toListWorkItemsRequest("ws-1", list)).toEqual({
            workspaceId: "ws-1",
            statuses: [],
            after: { createdAt: "2026-10-12", id: "a" },
            limit: 50,
        })

        const decide = Object.assign(new DecideWorkItemRequest(), {
            decision: "approved",
            edits: { draft: "New" },
            note: "ok",
            basis: "seen",
        })
        expect(toDecideWorkItemRequest("ws-1", "item-1", "en", decide)).toEqual({
            workspaceId: "ws-1",
            workItemId: "item-1",
            decision: "approved",
            edits: { draft: "New" },
            note: "ok",
            basis: "seen",
            locale: "en",
        })

        const card = Object.assign(new DecideExecutionRequest(), { decision: "rejected" })
        expect(toDecideExecutionRequest("ws-1", "exec-1", "vi", card)).toEqual({
            workspaceId: "ws-1",
            executionId: "exec-1",
            decision: "rejected",
            editedDraft: undefined,
            locale: "vi",
        })

        const command = Object.assign(new SendCommandRequest(), {
            to: "sales",
            command: "confirm_order",
            reason: "asked",
            subjectId: "o-1",
        })
        expect(toSendCommandRequest("ws-1", "en", command)).toEqual({
            workspaceId: "ws-1",
            to: "sales",
            command: "confirm_order",
            reason: "asked",
            subjectType: undefined,
            subjectId: "o-1",
            leadId: undefined,
            fields: undefined,
            locale: "en",
        })
    })

    it("hands the authority, rule and responsibility bodies over with the workspace", () => {
        const patch = Object.assign(new UpdateAuthorityRequest(), { policies: "P" })
        expect(toUpdateAuthorityRequest("ws-1", patch)).toEqual({ workspaceId: "ws-1", patch })

        const rule = Object.assign(new SaveRuleRequest(), { action: "confirm_order", mode: "ask" })
        expect(toSaveRuleRequest("ws-1", rule)).toEqual({ workspaceId: "ws-1", change: rule })

        const created = Object.assign(new CreateResponsibilityRequest(), { lead_id: "l-1", title: "T" })
        expect(toCreateResponsibilityRequest("ws-1", created)).toEqual({ workspaceId: "ws-1", input: created })
    })

    it("copies the domain answers into the responses", () => {
        const item = itemOf()
        expect(toWorkItemResponse(item)).toEqual(item)
        expect(toWorkItemPageResponse({ items: [item], next: { createdAt: "c", id: "i" } })).toEqual({
            items: [item],
            next: { createdAt: "c", id: "i" },
        })
        const card = { id: "exec-1", status: "approved", work_item_id: "item-1", draft: "Hi" }
        expect(toExecutionResponse(card)).toEqual(card)
        expect(toCommandResultResponse({ ok: false, refused: "cycle", detail: "loop" })).toEqual({
            ok: false,
            refused: "cycle",
            detail: "loop",
        })
        const profile = {
            policies: "P",
            reply_style: "R",
            brand_voice: "B",
            limits_note: "L",
            goal_revenue_vnd: null,
            goal_new_customers: null,
            goal_first_reply_minutes: null,
            goal_note: "",
            updated_by: null,
            updated_at: "2026-10-12T10:00:00.000Z",
        }
        const rule = {
            id: "rule-1",
            workspace_id: "ws-1",
            department: "sales",
            action: "confirm_order",
            mode: "ask" as const,
            limit_vnd: null,
            required_fields: [],
            note: "",
            updated_at: "2026-10-12T10:00:00.000Z",
        }
        expect(toAuthorityProfileResponse(profile)).toEqual(profile)
        expect(toAuthorityRuleResponse(rule)).toEqual(rule)
        expect(toAuthoritySheetResponse({ profile, rules: [rule] })).toEqual({ profile, rules: [rule] })
        const record = builder<ResponsibilityListing>({
            id: "r-1",
            workspace_id: "ws-1",
            lead_id: "l-1",
            title: "T",
            owner_kind: "human",
            owner_agent_id: null,
            owner_name: "An",
            next_action: "Call",
            due_at: null,
            status: "open",
            created_at: "2026-10-12T10:00:00.000Z",
            contact_name: "Lan",
        })()
        expect(toResponsibilityResponse(record)).toEqual(record)
        expect(toResponsibilitiesResponse([record])).toEqual([record])
    })
})
