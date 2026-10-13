import { builder } from "@starci/jest-preset"
import type { GetWorkspaceDetailResult } from "../../application/get-workspace-detail.contracts"
import { toGetWorkspaceDetailRequest, toGetWorkspaceDetailResponse } from "./get-workspace-detail.mapper"

const resultOf = builder<GetWorkspaceDetailResult>({
    workspace: {
        id: "workspace-1",
        name: "Cafe",
        ownerEmail: "owner@example.test",
        status: "active",
        planCode: "pro",
        paidUntil: null,
        createdAt: "2026-10-13T10:00:00.000Z",
    },
    credits: { used: 12, limit: 100, costUsd: 0.5, ownLimit: null },
    members: [{ userId: "person-1", role: "owner", displayName: "An", status: "active", email: null }],
    invites: [
        {
            id: "invite-1",
            email: "staff@example.test",
            role: "staff",
            createdAt: "2026-10-13T10:00:00.000Z",
            expiresAt: "2026-10-20T10:00:00.000Z",
        },
    ],
    orders: [],
    transfers: [],
    billingEvents: [],
    modules: [],
    connections: [],
    errors: [],
    knowledgeTotal: 2,
    knowledge: [{ kind: "document", byStatus: { ready: 2 } }],
    activity: { messages7d: 4, lastCustomerMessageAt: null, openDecisions: 1 },
})

describe("get-workspace-detail mapper", () => {
    it("names the workspace from the path", () => {
        expect(toGetWorkspaceDetailRequest("workspace-1")).toEqual({ workspaceId: "workspace-1" })
    })

    it("preserves the complete workspace detail", () => {
        const result = resultOf()

        expect(toGetWorkspaceDetailResponse(result)).toBe(result)
        expect(toGetWorkspaceDetailResponse(result)).toEqual(resultOf())
    })
})
