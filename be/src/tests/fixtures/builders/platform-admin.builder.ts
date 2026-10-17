import type { Principal } from "@modules/platform/cqrs"

export const NOW = new Date("2026-10-12T00:00:00.000Z")
export const AT = "2026-10-11T08:00:00.000Z"
export const STALE = "2026-10-01T08:00:00.000Z"
export const ADMIN = { userId: "u-1", email: "team@nivo.vn" }
export const PRINCIPAL: Principal = { id: "u-1", email: "team@nivo.vn", role: "authenticated" }
export const WS_A = "aaaaaaaa-0000-4000-8000-000000000001"
export const WS_B = "bbbbbbbb-0000-4000-8000-000000000002"
export const AUDIT = {
    id: "a-1",
    actorEmail: "team@nivo.vn",
    action: "view.workspace",
    workspaceId: WS_A,
    createdAt: AT,
}
/** Build a workspace row with deterministic timestamps and optional field overrides. */
export const workspace = (id: string, owner: string, name: string, change: object = {}) => ({
    id,
    owner_id: owner,
    name,
    status: "active",
    plan_code: "pro",
    paid_until: null,
    created_at: AT,
    ...change,
})
