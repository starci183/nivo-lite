import { builder } from "@starci/jest-preset"
import type { ListWorkspacesResult } from "../../application/list-workspaces.contracts"
import { toListWorkspacesRequest, toListWorkspacesResponse } from "./list-workspaces.mapper"

const resultOf = builder<ListWorkspacesResult>({
    total: 1,
    counts: { all: 1, attention: 1, unpaid: 0, idle: 0 },
    items: [
        {
            id: "workspace-1",
            name: "Cafe",
            ownerEmail: "owner@example.test",
            status: "active",
            planCode: "pro",
            paidUntil: null,
            createdAt: "2026-10-13T10:00:00.000Z",
            members: 2,
            modules: [{ key: "sales", status: "active", live: true }],
            connections: [{ provider: "meta", count: 1, error: 1, silent: 0 }],
            connectionWarning: true,
            lastCustomerMessageAt: null,
            messages7d: 4,
            openDecisions: 1,
            errors24h: 2,
            attention: true,
            unpaid: false,
            idle7d: false,
        },
    ],
})

describe("list-workspaces mapper", () => {
    it("copies the filter and search without normalizing them", () => {
        expect(toListWorkspacesRequest({ filter: "attention", query: " Cafe " })).toEqual({
            filter: "attention",
            query: " Cafe ",
        })
        expect(toListWorkspacesRequest({ filter: "all", query: "" })).toEqual({ filter: "all", query: "" })
    })

    it("preserves the counts and workspace items", () => {
        const result = resultOf()

        expect(toListWorkspacesResponse(result)).toBe(result)
        expect(toListWorkspacesResponse(result)).toEqual(resultOf())
    })
})
