import { builder } from "@starci/jest-preset"
import type { AssignResponsibilityResult } from "../../application/assign-responsibility.contracts"
import type { AssignResponsibilityRequest } from "./dto/assign-responsibility.request"
import { toAssignResponsibilityRequest, toAssignResponsibilityResponse } from "./assign-responsibility.mapper"

const requestOf = builder<AssignResponsibilityRequest>({
    owner: "agent-1",
    nextAction: "Prepare proposal",
    dueAt: "2026-10-20T10:00:00.000Z",
    title: "Proposal",
})
const resultOf = builder<AssignResponsibilityResult>({
    id: "responsibility-1",
    leadId: "lead-1",
    title: "Proposal",
    ownerKind: "agent",
    ownerAgentId: "agent-1",
    ownerName: "Sales",
    nextAction: "Prepare proposal",
    dueAt: "2026-10-20T10:00:00.000Z",
    status: "waiting_approval",
})

describe("assign-responsibility mapper", () => {
    it("copies the reassignment with the responsibility, workspace and language", () => {
        expect(toAssignResponsibilityRequest("workspace-1", "responsibility-1", requestOf(), "en")).toEqual({
            responsibilityId: "responsibility-1",
            owner: "agent-1",
            nextAction: "Prepare proposal",
            dueAt: "2026-10-20T10:00:00.000Z",
            title: "Proposal",
            workspaceId: "workspace-1",
            acceptLanguage: "en",
        })
    })

    it("preserves null fields and an absent language", () => {
        expect(
            toAssignResponsibilityRequest(
                "workspace-2",
                "responsibility-2",
                requestOf({ dueAt: null, title: null }),
                undefined,
            ),
        ).toEqual({
            responsibilityId: "responsibility-2",
            owner: "agent-1",
            nextAction: "Prepare proposal",
            dueAt: null,
            title: null,
            workspaceId: "workspace-2",
            acceptLanguage: undefined,
        })
    })

    it("copies every result field into a separate response", () => {
        const result = resultOf()
        const response = toAssignResponsibilityResponse(result)

        expect(response).toEqual({
            id: "responsibility-1",
            leadId: "lead-1",
            title: "Proposal",
            ownerKind: "agent",
            ownerAgentId: "agent-1",
            ownerName: "Sales",
            nextAction: "Prepare proposal",
            dueAt: "2026-10-20T10:00:00.000Z",
            status: "waiting_approval",
        })
        expect(response).not.toBe(result)
    })
})
