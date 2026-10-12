import { Test } from "@nestjs/testing"
import { FakeClock, mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { CLOCK } from "@modules/platform/clock"
import type { Principal } from "@modules/platform/cqrs"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { PlatformAuditService } from "@modules/domain/platform-audit"
import { AdminAccessService } from "./admin-access.service"
import { AdminDirectoryService } from "./admin-directory.service"
import { PlatformAdminError, PlatformAdminErrorCode } from "./errors/platform-admin.error"
import {
    FIND_QUOTA_OVERRIDE,
    FIND_QUOTA_STATUS,
    FIND_WORKSPACE,
    FIND_WORKSPACE_STATS,
    LIST_AGENT_SYNC,
    LIST_BILLING_EVENTS,
    LIST_CONNECTIONS,
    LIST_CONTEXT_VERSIONS,
    LIST_ERROR_SCOPES,
    LIST_ERROR_WORKSPACES,
    LIST_INSTALLS,
    LIST_KNOWLEDGE_SOURCES,
    LIST_LIVE_CONNECTIONS,
    LIST_MEMBERS,
    LIST_MODULE_INSTALLS,
    LIST_ORDERS,
    LIST_PENDING_INVITES,
    LIST_RECENT_BILLING_EVENTS,
    LIST_RECENT_ERRORS,
    LIST_RECENT_TRANSFERS,
    LIST_SIGNUPS,
    LIST_TRANSFERS,
    LIST_USER_EMAILS,
    LIST_WORKSPACES,
    LIST_WORKSPACE_ERRORS,
    LIST_WORKSPACE_NAMES,
    LIST_WORKSPACE_STATS,
} from "./persistence/platform-admin.sql"

const NOW = new Date("2026-10-12T00:00:00.000Z")
const AT = "2026-10-11T08:00:00.000Z"
const STALE = "2026-10-01T08:00:00.000Z"
const ADMIN = { userId: "u-1", email: "team@nivo.vn" }
const PRINCIPAL: Principal = { id: "u-1", email: "team@nivo.vn", role: "authenticated" }

const WS_A = "aaaaaaaa-0000-4000-8000-000000000001"
const WS_B = "bbbbbbbb-0000-4000-8000-000000000002"

const AUDIT = { id: "a-1", actorEmail: "team@nivo.vn", action: "view.workspace", workspaceId: WS_A, createdAt: AT }

/** The query answers a spec hands to the entity manager double. */
type Stubs = Record<"query", ReadonlyArray<readonly [string, unknown]>>

const build = async (em: MockEntityManager, auditRows: ReadonlyArray<typeof AUDIT> = [AUDIT]) => {
    const access = mock<AdminAccessService>()
    access.requireAdmin.mockReturnValue(ADMIN)
    access.audit.mockResolvedValue(undefined)
    const audits = mock<PlatformAuditService>()
    audits.recent.mockResolvedValue(auditRows)
    const moduleRef = await Test.createTestingModule({
        providers: [
            AdminDirectoryService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
            { provide: CLOCK, useValue: new FakeClock(NOW) },
            { provide: AdminAccessService, useValue: access },
            { provide: PlatformAuditService, useValue: audits },
        ],
    }).compile()
    return { directory: moduleRef.get(AdminDirectoryService), access }
}

describe("AdminDirectoryService", () => {
    describe("session", () => {
        it("answers the admin identity", async () => {
            const { directory } = await build(mockEntityManager())

            await expect(directory.session(PRINCIPAL)).resolves.toEqual(ADMIN)
        })

        it("refuses a caller who is not an admin", async () => {
            const { directory, access } = await build(mockEntityManager())
            access.requireAdmin.mockImplementation(() => {
                throw new PlatformAdminError({ code: PlatformAdminErrorCode.NotFound })
            })

            await expect(directory.session(PRINCIPAL)).rejects.toMatchObject({ code: PlatformAdminErrorCode.NotFound })
        })
    })

    describe("listWorkspaces", () => {
        const workspace = (id: string, owner: string, name: string, change: object = {}) => ({
            id,
            owner_id: owner,
            name,
            status: "active",
            plan_code: "pro",
            paid_until: null,
            created_at: AT,
            ...change,
        })
        const stubs = {
            query: [
                [
                    LIST_WORKSPACES,
                    [workspace(WS_A, "o-1", "Spa Hoa Mai"), workspace(WS_B, "o-2", "Quan Bun", { paid_until: STALE })],
                ],
                [
                    LIST_WORKSPACE_STATS,
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
                [
                    LIST_MODULE_INSTALLS,
                    [{ workspace_id: WS_A, module_key: "chatbot", status: "live", live_enabled: true }],
                ],
                [
                    LIST_LIVE_CONNECTIONS,
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
                [LIST_ERROR_WORKSPACES, [{ workspace_id: WS_A }, { workspace_id: WS_A }]],
                [LIST_USER_EMAILS, [{ id: "o-1", email: "mai@nivo.vn" }]],
            ],
        } as const

        it("lists every workspace with its facts, flags and the size of each filter, and audits the view", async () => {
            const { directory, access } = await build(mockEntityManager(stubs))

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

        it("keeps only what the filter and the search match", async () => {
            const { directory } = await build(mockEntityManager(stubs))

            const list = await directory.listWorkspaces(PRINCIPAL, { filter: "unpaid", query: "bun" })

            expect(list.items.map((item) => item.id)).toEqual([WS_B])
            expect(list.total).toBe(2)
        })

        it("asks Auth for no emails when there is no workspace", async () => {
            const em = mockEntityManager({
                query: [
                    [LIST_WORKSPACES, []],
                    [LIST_WORKSPACE_STATS, []],
                    [LIST_MODULE_INSTALLS, []],
                    [LIST_LIVE_CONNECTIONS, []],
                    [LIST_ERROR_WORKSPACES, []],
                ],
            })
            const { directory } = await build(em)

            await expect(directory.listWorkspaces(PRINCIPAL, { filter: "all", query: "" })).resolves.toEqual({
                total: 0,
                counts: { all: 0, attention: 0, unpaid: 0, idle: 0 },
                items: [],
            })
            expect(em.query).not.toHaveBeenCalledWith(LIST_USER_EMAILS, expect.anything())
        })

        it("reads nothing for a caller who is not an admin", async () => {
            const em = mockEntityManager()
            const { directory, access } = await build(em)
            access.requireAdmin.mockImplementation(() => {
                throw new PlatformAdminError({ code: PlatformAdminErrorCode.NotFound })
            })

            await expect(directory.listWorkspaces(PRINCIPAL, { filter: "all", query: "" })).rejects.toMatchObject({
                code: PlatformAdminErrorCode.NotFound,
            })
            expect(em.query).not.toHaveBeenCalled()
        })
    })

    describe("workspaceDetail", () => {
        const detailStubs = (change: Record<string, unknown> = {}): Stubs => ({
            query: [
                [
                    FIND_WORKSPACE,
                    change.workspace ?? [
                        {
                            id: WS_A,
                            owner_id: "o-1",
                            name: "Spa Hoa Mai",
                            status: "active",
                            plan_code: "pro",
                            paid_until: AT,
                            created_at: AT,
                        },
                    ],
                ],
                [
                    LIST_MEMBERS,
                    [
                        { user_id: "o-1", role: "owner", display_name: "Mai", status: "active", created_at: AT },
                        { user_id: "o-9", role: "staff", display_name: "Ha", status: "disabled", created_at: AT },
                    ],
                ],
                [
                    LIST_PENDING_INVITES,
                    [{ id: "i-1", email: "x@nivo.vn", role: "staff", created_at: AT, expires_at: AT }],
                ],
                [
                    LIST_ORDERS,
                    change.orders ?? [
                        {
                            id: "ord-1",
                            order_code: "NIVO1",
                            plan_code: "pro",
                            amount_vnd: "590000",
                            status: "paid",
                            created_at: AT,
                            paid_at: AT,
                        },
                    ],
                ],
                [LIST_BILLING_EVENTS, [{ id: "b-1", kind: "paid", created_at: AT }]],
                [
                    LIST_INSTALLS,
                    change.installs ?? [
                        {
                            id: "m-1",
                            module_key: "chatbot",
                            status: "live",
                            operating_mode: "autopilot",
                            live_enabled: true,
                            active_context_version_id: "v-1",
                            processor: "openclaw",
                        },
                        {
                            id: "m-2",
                            module_key: "sales",
                            status: "setup",
                            operating_mode: "suggest",
                            live_enabled: false,
                            active_context_version_id: null,
                            processor: null,
                        },
                    ],
                ],
                [LIST_CONTEXT_VERSIONS, [{ id: "v-1", version: 2, applied_at: AT }]],
                [
                    LIST_AGENT_SYNC,
                    [
                        {
                            installation_id: "m-1",
                            agent_id: "agent-1",
                            context_version: 2,
                            checked_at: AT,
                            status: "ok",
                            error: null,
                        },
                    ],
                ],
                [
                    LIST_CONNECTIONS,
                    [
                        {
                            id: "c-1",
                            provider: "telegram",
                            name: "Bot",
                            status: "connected",
                            environment: null,
                            last_event_at: AT,
                            last_error: null,
                            created_at: STALE,
                        },
                    ],
                ],
                [LIST_WORKSPACE_ERRORS, [{ id: "e-1", scope: "api.x", message: "boom", created_at: AT }]],
                [
                    LIST_KNOWLEDGE_SOURCES,
                    [
                        { kind: "text", status: "ready" },
                        { kind: "text", status: "failed" },
                    ],
                ],
                [
                    FIND_WORKSPACE_STATS,
                    change.stats ?? [{ messages_7d: 4, last_customer_message_at: AT, open_decisions: 1 }],
                ],
                [FIND_QUOTA_STATUS, [{ credits_used: "10", credits_limit: "1150", cost_usd: "0.04" }]],
                [FIND_QUOTA_OVERRIDE, []],
                [
                    LIST_TRANSFERS,
                    [{ sepay_id: "7", transfer_amount: "590000", content: "NIVO1", status: "paid", received_at: AT }],
                ],
                [LIST_USER_EMAILS, change.emails ?? [{ id: "o-1", email: "mai@nivo.vn" }]],
            ],
        })

        it("answers the full overview and audits the view", async () => {
            const em = mockEntityManager(detailStubs())
            const { directory, access } = await build(em)

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
            expect(detail.knowledge).toEqual([{ kind: "text", byStatus: { ready: 1, failed: 1 } }])
            expect(detail.activity).toEqual({ messages7d: 4, lastCustomerMessageAt: AT, openDecisions: 1 })
            expect(em.query).toHaveBeenCalledWith(LIST_TRANSFERS, [["ord-1"]])
            expect(access.audit).toHaveBeenCalledWith(ADMIN, "view.workspace", WS_A)
        })

        it("skips the transfers of a workspace with no orders and shows zero activity without stats", async () => {
            const em = mockEntityManager(detailStubs({ orders: [], installs: [], stats: [], emails: [] }))
            const { directory } = await build(em)

            const detail = await directory.workspaceDetail(PRINCIPAL, WS_A)

            expect(detail.transfers).toEqual([])
            expect(detail.workspace.ownerEmail).toBeNull()
            expect(detail.activity).toEqual({ messages7d: 0, lastCustomerMessageAt: null, openDecisions: 0 })
            expect(em.query).not.toHaveBeenCalledWith(LIST_TRANSFERS, expect.anything())
        })

        it("answers not found for a workspace that does not exist and audits nothing", async () => {
            const em = mockEntityManager({ query: [FIND_WORKSPACE, []] })
            const { directory, access } = await build(em)

            await expect(directory.workspaceDetail(PRINCIPAL, WS_A)).rejects.toMatchObject({
                code: PlatformAdminErrorCode.WorkspaceNotFound,
            })
            expect(access.audit).not.toHaveBeenCalled()
        })
    })

    describe("health", () => {
        const healthStubs = (errors: Array<unknown>): Stubs => ({
            query: [
                [LIST_SIGNUPS, [{ day: "2026-10-11", signups: 3 }]],
                [
                    LIST_RECENT_TRANSFERS,
                    [
                        { status: "paid", transfer_amount: "590000", content: "NIVO1", received_at: AT },
                        { status: "paid", transfer_amount: null, content: null, received_at: AT },
                        { status: "unmatched", transfer_amount: "1", content: null, received_at: AT },
                    ],
                ],
                [LIST_RECENT_BILLING_EVENTS, [{ id: "b-1", workspace_id: WS_A, kind: "paid", created_at: AT }]],
                [LIST_RECENT_ERRORS, errors],
                [LIST_ERROR_SCOPES, [{ key: "api.x", count: 2 }]],
                [LIST_WORKSPACE_NAMES, [{ id: WS_A, name: "Spa Hoa Mai" }]],
            ],
        })

        it("answers the platform health with the names of the workspaces it links to, and audits the view", async () => {
            const errors = [{ id: "e-1", scope: "api.x", message: "boom", workspace_id: WS_B, created_at: AT }]
            const em = mockEntityManager(healthStubs(errors))
            const { directory, access } = await build(em)

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
            expect(em.query).toHaveBeenCalledWith(LIST_WORKSPACE_NAMES, [expect.arrayContaining([WS_A, WS_B])])
            expect(access.audit).toHaveBeenCalledWith(ADMIN, "view.health", null)
        })

        it("asks for no names when nothing links to a workspace", async () => {
            const stubs = healthStubs([])
            const em = mockEntityManager({
                query: stubs.query.map((pair) => (pair[0] === LIST_RECENT_BILLING_EVENTS ? [pair[0], []] : pair)),
            })
            const { directory } = await build(em, [])

            await expect(directory.health(PRINCIPAL)).resolves.toMatchObject({ workspaceNames: [] })
            expect(em.query).not.toHaveBeenCalledWith(LIST_WORKSPACE_NAMES, expect.anything())
        })
    })
})
