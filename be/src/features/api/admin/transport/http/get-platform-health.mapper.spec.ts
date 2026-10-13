import { builder } from "@starci/jest-preset"
import type { GetPlatformHealthResult } from "../../application/get-platform-health.contracts"
import { toGetPlatformHealthRequest, toGetPlatformHealthResponse } from "./get-platform-health.mapper"

const resultOf = builder<GetPlatformHealthResult>({
    signups: [{ day: "2026-10-13", signups: 3 }],
    transfers: [
        { status: "matched", transferAmount: 500000, content: "ORDER1", receivedAt: "2026-10-13T10:00:00.000Z" },
    ],
    transferCounts: [{ key: "matched", count: 1 }],
    billingEvents: [{ id: "event-1", workspaceId: null, kind: "paid", createdAt: "2026-10-13T10:00:00.000Z" }],
    errors: [
        {
            id: "error-1",
            scope: "billing",
            message: "unavailable",
            workspaceId: "workspace-1",
            createdAt: "2026-10-13T10:00:00.000Z",
        },
    ],
    errorScopes: [{ key: "billing", count: 1 }],
    audits: [],
    workspaceNames: [{ id: "workspace-1", name: "Cafe" }],
})

describe("get-platform-health mapper", () => {
    it("creates the empty health request", () => {
        expect(toGetPlatformHealthRequest()).toEqual({})
    })

    it("preserves the complete health result", () => {
        const result = resultOf()

        expect(toGetPlatformHealthResponse(result)).toBe(result)
        expect(toGetPlatformHealthResponse(result)).toEqual(resultOf())
    })
})
