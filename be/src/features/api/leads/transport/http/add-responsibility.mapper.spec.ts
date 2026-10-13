import { builder } from "@starci/jest-preset"
import type { AddResponsibilityResult } from "../../application/add-responsibility.contracts"
import type { AddResponsibilityRequest } from "./dto/add-responsibility.request"
import { toAddResponsibilityRequest, toAddResponsibilityResponse } from "./add-responsibility.mapper"

const followUp = "Follow up"

const requestOf = builder<AddResponsibilityRequest>({
    title: followUp,
    owner: "human",
    nextAction: "Call customer",
    dueAt: "2026-10-20T10:00:00.000Z",
})
const resultOf = builder<AddResponsibilityResult>({
    id: "responsibility-1",
    leadId: "lead-1",
    title: followUp,
    ownerKind: "human",
    ownerAgentId: null,
    ownerName: "An",
    nextAction: "Call customer",
    dueAt: "2026-10-20T10:00:00.000Z",
    status: "open",
})

describe("add-responsibility mapper", () => {
    it("copies the request and adds the lead, workspace and language", () => {
        expect(toAddResponsibilityRequest("workspace-1", "lead-1", requestOf(), "en")).toEqual({
            leadId: "lead-1",
            title: followUp,
            owner: "human",
            nextAction: "Call customer",
            dueAt: "2026-10-20T10:00:00.000Z",
            workspaceId: "workspace-1",
            acceptLanguage: "en",
        })
    })

    it("preserves an absent language and a null due date", () => {
        expect(toAddResponsibilityRequest("workspace-2", "lead-2", requestOf({ dueAt: null }), undefined)).toEqual({
            leadId: "lead-2",
            title: followUp,
            owner: "human",
            nextAction: "Call customer",
            dueAt: null,
            workspaceId: "workspace-2",
            acceptLanguage: undefined,
        })
    })

    it("copies every result field into a separate response", () => {
        const result = resultOf()
        const response = toAddResponsibilityResponse(result)

        expect(response).toEqual({
            id: "responsibility-1",
            leadId: "lead-1",
            title: followUp,
            ownerKind: "human",
            ownerAgentId: null,
            ownerName: "An",
            nextAction: "Call customer",
            dueAt: "2026-10-20T10:00:00.000Z",
            status: "open",
        })
        expect(response).not.toBe(result)
    })
})
