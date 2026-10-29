import type { MockOf } from "@starci/jest-preset"
import {
    type ConnectionSecretsService,
    type ConnectionSecret,
    ConnectionSecretsErrorCode,
} from "@modules/domain/connection-secrets"
import type { ConnectionSecretReadsService, ConnectionsService } from "@modules/domain/connections"
import { ZaloError, ZaloErrorCode } from "@modules/integrations/zalo"
import { ok, refused } from "@modules/platform/primitives"
import type { ZaloCredentialsService } from "@modules/domain/channels"

type ZaloSecret = Extract<Awaited<ReturnType<ZaloCredentialsService["load"]>>, ReturnType<typeof ok>>["value"]["secret"]

export const NOW = Date.parse("2026-10-12T10:00:00.000Z")
export const HOUR = 3_600_000
/** Build a valid stored Zalo credential with optional overrides. */
export const secretOf = (patch: Partial<ZaloSecret> = {}): ZaloSecret => ({
    appId: "app-1",
    appSecret: "app-secret",
    oaSecret: "oa-secret",
    accessToken: "access-1",
    renewalToken: "refresh-1",
    ...patch,
})
/** Wrap the credential in the connection-secret read result. */
export const stored = (secret: ZaloSecret | string, expiresAt: number | null = NOW + HOUR) =>
    ok<ConnectionSecret>({
        workspaceId: "ws-1",
        credential: typeof secret === "string" ? secret : JSON.stringify(secret),
        webhookSecret: "hook",
        tokenExpiresAt: expiresAt === null ? null : new Date(expiresAt).toISOString(),
    })
/** Parse the sealed test text, retaining an unreadable value's error so assertions expose it. */
export const sealedJson = (sealed: string): object => {
    try {
        const parsed: unknown = JSON.parse(sealed.slice("sealed:".length))
        return typeof parsed === "object" && parsed !== null ? parsed : {}
    } catch (cause) {
        return { cause }
    }
}
export const missing = refused(ConnectionSecretsErrorCode.NotFound)
/** Build a provider rejection carrying the requested Zalo error code. */
export const zaloRefusal = (zaloCode: number) =>
    new ZaloError({ code: ZaloErrorCode.Rejected, params: { path: "/v4/oa/access_token", reason: "no", zaloCode } })
export const tokens = { accessToken: "access-2", renewalToken: "refresh-2", expiresInSeconds: 3600 }

/** Configure fresh kit doubles with the normal credential persistence responses. */
export const configureCredentialDoubles = (
    secrets: MockOf<ConnectionSecretsService>,
    secretReads: MockOf<ConnectionSecretReadsService>,
    connections: MockOf<ConnectionsService>,
): void => {
    secrets.seal.mockImplementation((plain) => `sealed:${plain}`)
    secrets.save.mockResolvedValue(undefined)
    secrets.takeLease.mockResolvedValue(true)
    secrets.releaseLease.mockResolvedValue(undefined)
    secretReads.dueZalo.mockResolvedValue([])
    connections.markFailing.mockResolvedValue(undefined)
    connections.applyZaloAuthorization.mockResolvedValue(undefined)
}

/** Exact refusal shape for each malformed stored secret. */
export const unreadableSecret = { kind: "refused", code: "CHANNELS_SECRET_UNREADABLE", params: undefined }
