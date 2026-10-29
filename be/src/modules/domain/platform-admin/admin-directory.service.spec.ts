import {
    NOW,
    AT,
    STALE,
    ADMIN,
    PRINCIPAL,
    WS_A,
    WS_B,
    AUDIT,
    workspace,
} from "@tests/fixtures/builders/platform-admin.builder"
import { Test } from "@nestjs/testing"
import { FakeClock, mock } from "@starci/jest-preset"
import { CLOCK } from "@modules/platform/clock"

import { PlatformAuditService } from "@modules/domain/platform-audit"
import { AdminAccessService } from "./admin-access.service"
import { AdminDirectoryService } from "./admin-directory.service"
import { PlatformAdminError, PlatformAdminErrorCode } from "./errors/platform-admin.error"
import { detailStubs } from "@tests/fixtures/builders/platform-admin-detail.builder"
import type { Stubs } from "@tests/fixtures/builders/platform-admin-detail.builder"
import { READ } from "@tests/fixtures/builders/platform-admin-reads.builder"
import { AdminDirectoryReadsService } from "./admin-directory-reads.service"

const FIRST = new Set<string>([READ.workspace, READ.workspaceActivity, READ.quotaStatus, READ.quotaOverride])

/** The stubbed answers of a spec; no stub means no rows. */
const stubbing = (answers: Stubs = { query: [] }): Stubs => answers

/** The directory reads double answering what the stubs say, one row for the reads that answer one. */
const readsOf = (answers: Stubs) => {
    const rowsOf = (name: string): ReadonlyArray<unknown> => {
        const rows = answers.query.find(([key]) => key === name)?.[1]
        return Array.isArray(rows) ? rows : []
    }
    const answer = (name: string) => jest.fn().mockResolvedValue(FIRST.has(name) ? rowsOf(name)[0] : rowsOf(name))
    return mock<AdminDirectoryReadsService>(Object.fromEntries(Object.values(READ).map((name) => [name, answer(name)])))
}

const build = async (answers: Stubs, auditRows: ReadonlyArray<typeof AUDIT> = [AUDIT]) => {
    const reads = readsOf(answers)
    const access = mock<AdminAccessService>()
    access.requireAdmin.mockReturnValue(ADMIN)
    access.audit.mockResolvedValue(undefined)
    const audits = mock<PlatformAuditService>()
    audits.recent.mockResolvedValue(auditRows)
    const moduleRef = await Test.createTestingModule({
        providers: [
            AdminDirectoryService,
            { provide: AdminDirectoryReadsService, useValue: reads },
            { provide: CLOCK, useValue: new FakeClock(NOW) },
            { provide: AdminAccessService, useValue: access },
            { provide: PlatformAuditService, useValue: audits },
        ],
    }).compile()
    return { directory: moduleRef.get(AdminDirectoryService), access, reads }
}

const stubs = {
    query: [
        [
            READ.workspaces,
            [workspace(WS_A, "o-1", "Spa Hoa Mai"), workspace(WS_B, "o-2", "Quan Bun", { paid_until: STALE })],
        ],
        [
            READ.workspaceStats,
            [
                {
                    workspace_id: WS_A,
                    members: 3,
                    last_customer_message_at: AT,
                    messages_7d: 5,
                    open_decisions: 2,
                },
            ],
        ],
        [READ.moduleInstalls, [{ workspace_id: WS_A, module_key: "chatbot", status: "live", live_enabled: true }]],
        [
            READ.liveConnections,
            [
                {
                    workspace_id: WS_A,
                    provider: "telegram",
                    status: "connected",
                    environment: "live",
                    last_event_at: AT,
                    created_at: STALE,
                },
                {
                    workspace_id: WS_A,
                    provider: "zalo",
                    status: "error",
                    environment: "live",
                    last_event_at: null,
                    created_at: STALE,
                },
            ],
        ],
        [READ.errorWorkspaces, [{ workspace_id: WS_A }, { workspace_id: WS_A }]],
        [READ.userEmails, [{ id: "o-1", email: "mai@nivo.vn" }]],
    ],
} as const

describe("AdminDirectoryService", () => {
    describe("session", () => {
        it("answers the admin identity", async () => {
            const { directory } = await build(stubbing())

            await expect(directory.session(PRINCIPAL)).resolves.toEqual(ADMIN)
        })

        it("refuses a caller who is not an admin", async () => {
            const { directory, access } = await build(stubbing())
            access.requireAdmin.mockImplementation(() => {
                throw new PlatformAdminError({ code: PlatformAdminErrorCode.NotFound })
            })

            await expect(directory.session(PRINCIPAL)).rejects.toMatchObject({ code: PlatformAdminErrorCode.NotFound })
        })
    })
})

describe("AdminDirectoryService", () => {
    describe("listWorkspaces", () => {
        it("lists every workspace with its facts, flags and the size of each filter, and audits the view", async () => {
            const { directory, access } = await build(stubbing(stubs))

            const list = await directory.listWorkspaces(PRINCIPAL, { filter: "all", query: "" })

            expect(list.total).toBe(2)
            expect(list.counts).toEqual({ all: 2, attention: 1, unpaid: 1, idle: 1 })
            expect(list.items[0]).toEqual({
                id: WS_A,
                name: "Spa Hoa Mai",
                ownerEmail: "mai@nivo.vn",
                status: "active",
                planCode: "pro",
                paidUntil: null,
                createdAt: AT,
                members: 3,
                modules: [{ key: "chatbot", status: "live", live: true }],
                connections: [
                    { provider: "telegram", count: 1, error: 0, silent: 0 },
                    { provider: "zalo", count: 1, error: 1, silent: 0 },
                ],
                connectionWarning: true,
                lastCustomerMessageAt: AT,
                messages7d: 5,
                openDecisions: 2,
                errors24h: 2,
                attention: true,
                unpaid: false,
                idle7d: false,
            })
            expect(list.items[1]).toMatchObject({
                id: WS_B,
                ownerEmail: null,
                members: 0,
                modules: [],
                connections: [],
                lastCustomerMessageAt: null,
                messages7d: 0,
                openDecisions: 0,
                errors24h: 0,
                attention: false,
                unpaid: true,
                idle7d: true,
            })
            expect(access.audit).toHaveBeenCalledWith(ADMIN, "view.workspaces", null, { filter: "all", q: "" })
        })
    })
})

describe("AdminDirectoryService", () => {
    describe("listWorkspaces", () => {
        it("keeps only what the filter and the search match", async () => {
            const { directory } = await build(stubbing(stubs))

            const list = await directory.listWorkspaces(PRINCIPAL, { filter: "unpaid", query: "bun" })

            expect(list.items.map((item) => item.id)).toEqual([WS_B])
            expect(list.total).toBe(2)
        })
    })
})

describe("AdminDirectoryService", () => {
    describe("listWorkspaces", () => {
        it("asks Auth for no emails when there is no workspace", async () => {
            const answers = stubbing({
                query: [
                    [READ.workspaces, []],
                    [READ.workspaceStats, []],
                    [READ.moduleInstalls, []],
                    [READ.liveConnections, []],
                    [READ.errorWorkspaces, []],
                ],
            })
            const { directory, reads } = await build(answers)

            await expect(directory.listWorkspaces(PRINCIPAL, { filter: "all", query: "" })).resolves.toEqual({
                total: 0,
                counts: { all: 0, attention: 0, unpaid: 0, idle: 0 },
                items: [],
            })
            expect(reads.userEmails).not.toHaveBeenCalled()
        })
    })
})

describe("AdminDirectoryService", () => {
    describe("listWorkspaces", () => {
        it("reads nothing for a caller who is not an admin", async () => {
            const answers = stubbing()
            const { directory, access, reads } = await build(answers)
            access.requireAdmin.mockImplementation(() => {
                throw new PlatformAdminError({ code: PlatformAdminErrorCode.NotFound })
            })

            await expect(directory.listWorkspaces(PRINCIPAL, { filter: "all", query: "" })).rejects.toMatchObject({
                code: PlatformAdminErrorCode.NotFound,
            })
            expect(reads.workspaces).not.toHaveBeenCalled()
        })
    })
})

describe("AdminDirectoryService", () => {
    describe("workspaceDetail", () => {
        it("answers the full overview and audits the view", async () => {
            const answers = stubbing(detailStubs())
            const { directory, access, reads } = await build(answers)

            const detail = await directory.workspaceDetail(PRINCIPAL, WS_A)

            expect(detail.workspace).toEqual({
                id: WS_A,
                name: "Spa Hoa Mai",
                ownerEmail: "mai@nivo.vn",
                status: "active",
                planCode: "pro",
                paidUntil: AT,
                createdAt: AT,
            })
            expect(detail.credits).toEqual({ used: 10, limit: 1150, costUsd: 0.04, ownLimit: null })
            expect(detail.members.map((member) => member.email)).toEqual(["mai@nivo.vn", null])
            expect(detail.transfers).toHaveLength(1)
            expect(detail.modules).toEqual([
                {
                    id: "m-1",
                    key: "chatbot",
                    status: "live",
                    operatingMode: "autopilot",
                    live: true,
                    processor: "openclaw",
                    contextVersion: 2,
                    contextAppliedAt: AT,
                    sync: { agentId: "agent-1", contextVersion: 2, checkedAt: AT, status: "ok", error: null },
                },
                {
                    id: "m-2",
                    key: "sales",
                    status: "setup",
                    operatingMode: "suggest",
                    live: false,
                    processor: "nivo",
                    contextVersion: null,
                    contextAppliedAt: null,
                    sync: null,
                },
            ])
            expect(detail.connections[0]).toMatchObject({ environment: "live", health: "ok" })
            expect(detail.knowledgeTotal).toBe(2)
            expect(detail.knowledge).toEqual([
                {
                    kind: "text",
                    byStatus: [
                        { key: "ready", count: 1 },
                        { key: "failed", count: 1 },
                    ],
                },
            ])
            expect(detail.activity).toEqual({ messages7d: 4, lastCustomerMessageAt: AT, openDecisions: 1 })
            expect(reads.transfers).toHaveBeenCalledWith(["ord-1"])
            expect(access.audit).toHaveBeenCalledWith(ADMIN, "view.workspace", WS_A)
        })
    })
})

describe("AdminDirectoryService", () => {
    describe("workspaceDetail", () => {
        it("skips the transfers of a workspace with no orders and shows zero activity without stats", async () => {
            const answers = stubbing(detailStubs({ orders: [], installs: [], stats: [], emails: [] }))
            const { directory, reads } = await build(answers)

            const detail = await directory.workspaceDetail(PRINCIPAL, WS_A)

            expect(detail.transfers).toEqual([])
            expect(detail.workspace.ownerEmail).toBeNull()
            expect(detail.activity).toEqual({ messages7d: 0, lastCustomerMessageAt: null, openDecisions: 0 })
            expect(reads.transfers).not.toHaveBeenCalled()
        })
    })
})

describe("AdminDirectoryService", () => {
    describe("workspaceDetail", () => {
        it("answers not found for a workspace that does not exist and audits nothing", async () => {
            const answers = stubbing({ query: [[READ.workspace, []]] })
            const { directory, access, reads } = await build(answers)

            await expect(directory.workspaceDetail(PRINCIPAL, WS_A)).rejects.toMatchObject({
                code: PlatformAdminErrorCode.WorkspaceNotFound,
            })
            expect(access.audit).not.toHaveBeenCalled()
            expect(reads.members).not.toHaveBeenCalled()
        })
    })
})

describe("AdminDirectoryService", () => {
    describe("health", () => {
        const healthStubs = (errors: Array<unknown>): Stubs => ({
            query: [
                [READ.signups, [{ day: "2026-10-11", signups: 3 }]],
                [
                    READ.recentTransfers,
                    [
                        { status: "paid", transfer_amount: "590000", content: "NIVO1", received_at: AT },
                        { status: "paid", transfer_amount: null, content: null, received_at: AT },
                        { status: "unmatched", transfer_amount: "1", content: null, received_at: AT },
                    ],
                ],
                [READ.recentBillingEvents, [{ id: "b-1", workspace_id: WS_A, kind: "paid", created_at: AT }]],
                [READ.recentErrors, errors],
                [READ.errorScopes, [{ key: "api.x", count: 2 }]],
                [READ.workspaceNames, [{ id: WS_A, name: "Spa Hoa Mai" }]],
            ],
        })

        it("answers the platform health with the names of the workspaces it links to, and audits the view", async () => {
            const errors = [{ id: "e-1", scope: "api.x", message: "boom", workspace_id: WS_B, created_at: AT }]
            const answers = stubbing(healthStubs(errors))
            const { directory, access, reads } = await build(answers)

            const health = await directory.health(PRINCIPAL)

            expect(health.transferCounts).toEqual([
                { key: "paid", count: 2 },
                { key: "unmatched", count: 1 },
            ])
            expect(health.errorScopes).toEqual([{ key: "api.x", count: 2 }])
            expect(health.workspaceNames).toEqual([{ id: WS_A, name: "Spa Hoa Mai" }])
            expect(health.signups).toEqual([{ day: "2026-10-11", signups: 3 }])
            expect(health.errors[0]).toMatchObject({ id: "e-1", workspaceId: WS_B })
            expect(health.audits[0]).toMatchObject({ id: "a-1", actorEmail: "team@nivo.vn" })
            expect(health.billingEvents[0]).toMatchObject({ id: "b-1" })
            expect(reads.workspaceNames).toHaveBeenCalledWith(expect.arrayContaining([WS_A, WS_B]))
            expect(access.audit).toHaveBeenCalledWith(ADMIN, "view.health", null)
        })

        it("asks for no names when nothing links to a workspace", async () => {
            const answers = stubbing({
                query: healthStubs([]).query.map((pair) =>
                    pair[0] === READ.recentBillingEvents ? [pair[0], []] : pair,
                ),
            })
            const { directory, reads } = await build(answers, [])

            await expect(directory.health(PRINCIPAL)).resolves.toMatchObject({ workspaceNames: [] })
            expect(reads.workspaceNames).not.toHaveBeenCalled()
        })
    })
})
