import type { ConnectionActor, ConnectionRecord } from "@modules/domain/connections"
import { GoogleError, GoogleErrorCode } from "@modules/integrations/google"
import type { GoogleTokenSet, OAuthState, SheetEventIn } from "@modules/integrations/google"
import type { GoogleConnectionsService } from "@modules/domain/google-connections"

type GoogleCallbackInput = Parameters<GoogleConnectionsService["complete"]>[0]

export const actor: ConnectionActor = { principalId: "owner-1", workspaceId: "ws-1" }
export const NOW = new Date("2026-10-12T03:00:00.000Z")
export const EXPIRES = NOW.getTime() + 3_600_000
export const state: OAuthState = { w: "ws-1", u: "owner-1", r: "/connections", e: EXPIRES }
export const tokens: GoogleTokenSet = {
    accessToken: "access-new",
    refreshToken: "refresh-new",
    expiresAt: EXPIRES,
    idToken: null,
    scope: null,
}
export const stored = { access_token: "access-old", refresh_token: "refresh-old", expires_at: EXPIRES }
export const issued = { access_token: "access-new", refresh_token: "refresh-new", expires_at: EXPIRES }
export const event: SheetEventIn = { event: "order.confirmed", data: { code: "O-1" }, occurredAt: NOW.toISOString() }
export const sheet = { spreadsheetId: "sheet-1", spreadsheetUrl: "https://docs.google.com/spreadsheets/d/sheet-1/edit" }

/** A stored Google account, with the selected row fields overridden for a case. */
export const record = (overrides: Partial<ConnectionRecord> = {}): ConnectionRecord => ({
    id: "c1",
    workspaceId: "ws-1",
    provider: "google",
    name: "Google - shop@example.test",
    meta: { email: "shop@example.test" },
    status: "connected",
    lastError: null,
    environment: "live",
    isDefault: false,
    lastEventAt: null,
    firstEvent: null,
    createdBy: "owner-1",
    createdAt: "2026-10-01T00:00:00.000Z",
    ...overrides,
})

/** A Google refusal with the transport status or OAuth reason required by a case. */
export const googleRefusal = (params: { reason?: string; status?: number } = {}) =>
    new GoogleError({ code: GoogleErrorCode.Refused, params })
/** A consent callback with the requested missing or refused fields. */
export const callback = (extra: Partial<GoogleCallbackInput> = {}): GoogleCallbackInput => ({
    state: "signed-state",
    code: "consent-code",
    error: undefined,
    ...extra,
})
/** The same-site callback redirect expected for the result and optional failure reason. */
export const location = (result: "ok" | "error", reason?: string, key = "google") => ({
    location: `https://nivo.vn/connections?${key}=${result}${reason === undefined ? "" : `&reason=${reason}`}`,
})
