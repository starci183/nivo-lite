import { Injectable } from "@nestjs/common"
import { LessThan } from "typeorm"
import type { EntityManager } from "typeorm"
import { InjectPassportTokens } from "@modules/integrations/passport"
import type { AuthSubject, JwksDocument, PassportTokensClient } from "@modules/integrations/passport"
import type { Principal } from "@modules/platform/cqrs"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectIds } from "@modules/platform/ids"
import type { Ids } from "@modules/platform/ids"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { IdentityError, IdentityErrorCode } from "./errors/identity.error"
import type { DeviceMeta, SessionTokens } from "./identity-auth.contracts"
import { InjectIdentityAuthOptions } from "./identity-auth.decorators"
import { IdentityAuthLogEvent } from "./identity-auth.log-events"
import type { IdentityAuthOptions } from "./identity-auth.options"
import { digestOf } from "./password.policy"
import { authDoors } from "./persistence/auth-doors.port"
import { IdentityRefreshTokenEntity } from "./persistence/entities"

/** A rotated token presented again this soon after its rotation is a racing tab, not a theft: refused without ending the session. */
const REUSE_GRACE_MS = 30_000

type Rotation =
    | { readonly kind: "rotated"; readonly row: IdentityRefreshTokenEntity; readonly next: string }
    | { readonly kind: "invalid" }
    | { readonly kind: "reused"; readonly sessionId: string }

@Injectable()
/** Device sessions: opens one at sign-in, rotates its refresh token on every refresh (a replayed token ends the session) and ends it at sign-out. */
export class IdentitySessionsService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectPassportTokens() private readonly tokens: PassportTokensClient,
        @InjectClock() private readonly clock: Clock,
        @InjectIds() private readonly ids: Ids,
        @InjectIdentityAuthOptions() private readonly options: IdentityAuthOptions,
        @InjectLogger() private readonly logger: Logger,
    ) {}

    /** Opens a device session for a person who just proved who they are, and answers its first tokens. */
    async start(subject: AuthSubject, device: DeviceMeta): Promise<SessionTokens> {
        const now = this.clock.now()
        const sessionId = this.ids.next()
        const refreshToken = this.mintToken()
        await this.entityManager.transaction(async (scoped) => {
            await authDoors.openSession(scoped, {
                id: sessionId,
                userId: subject.userId,
                now,
                userAgent: device.userAgent,
                ip: device.ip,
            })
            await scoped.insert(IdentityRefreshTokenEntity, {
                id: this.ids.next(),
                sessionId,
                userId: subject.userId,
                tokenHash: digestOf(refreshToken),
                expiresAt: this.refreshExpiry(now),
            })
        })
        return this.tokensFor(subject, sessionId, refreshToken, now)
    }

    /** Exchanges a refresh token for a new pair; the presented token is spent. Throws when it is unknown, expired, or was already rotated. */
    async refresh(presented: string): Promise<SessionTokens> {
        if (presented === "") throw new IdentityError({ code: IdentityErrorCode.RefreshInvalid })
        const now = this.clock.now()
        const nextToken = this.mintToken()
        const rotation = await this.entityManager.transaction(async (scoped): Promise<Rotation> => {
            const row = await scoped.findOne(IdentityRefreshTokenEntity, {
                where: { tokenHash: digestOf(presented) },
                lock: { mode: "pessimistic_write" },
            })
            if (row === null || row.expiresAt <= now) return { kind: "invalid" }
            if (row.usedAt !== null) {
                return now.getTime() - row.usedAt.getTime() <= REUSE_GRACE_MS
                    ? { kind: "invalid" }
                    : { kind: "reused", sessionId: row.sessionId }
            }
            await scoped.update(IdentityRefreshTokenEntity, { id: row.id }, { usedAt: now })
            await scoped.insert(IdentityRefreshTokenEntity, {
                id: this.ids.next(),
                sessionId: row.sessionId,
                userId: row.userId,
                tokenHash: digestOf(nextToken),
                expiresAt: this.refreshExpiry(now),
            })
            await scoped.delete(IdentityRefreshTokenEntity, { userId: row.userId, expiresAt: LessThan(now) })
            return { kind: "rotated", row, next: nextToken }
        })
        if (rotation.kind === "reused") {
            await authDoors.closeSession(this.entityManager, rotation.sessionId)
            this.logger.warn(IdentityAuthLogEvent.RefreshReuseDetected, { sessionId: rotation.sessionId })
            throw new IdentityError({ code: IdentityErrorCode.RefreshReused })
        }
        if (rotation.kind === "invalid") throw new IdentityError({ code: IdentityErrorCode.RefreshInvalid })
        const user = await authDoors.userById(this.entityManager, rotation.row.userId)
        if (user === undefined || user.disabled || user.email === null) {
            await authDoors.closeSession(this.entityManager, rotation.row.sessionId)
            throw new IdentityError({ code: IdentityErrorCode.AccountDisabled })
        }
        await authDoors.touchSession(this.entityManager, rotation.row.sessionId, now)
        return this.tokensFor({ userId: user.id, email: user.email }, rotation.row.sessionId, rotation.next, now)
    }

    /**
     * Answers a fresh access token for the session of a refresh token WITHOUT rotating it, so parallel gated requests of one browser can ask
     * at once. A token rotated within the grace window still counts (a sibling request just rotated it); an older replay ends the session.
     */
    async access(presented: string): Promise<SessionTokens> {
        if (presented === "") throw new IdentityError({ code: IdentityErrorCode.RefreshInvalid })
        const now = this.clock.now()
        const row = await this.entityManager.findOne(IdentityRefreshTokenEntity, {
            where: { tokenHash: digestOf(presented) },
        })
        if (row === null || row.expiresAt <= now) throw new IdentityError({ code: IdentityErrorCode.RefreshInvalid })
        if (row.usedAt !== null && now.getTime() - row.usedAt.getTime() > REUSE_GRACE_MS) {
            await authDoors.closeSession(this.entityManager, row.sessionId)
            this.logger.warn(IdentityAuthLogEvent.RefreshReuseDetected, { sessionId: row.sessionId })
            throw new IdentityError({ code: IdentityErrorCode.RefreshReused })
        }
        const user = await authDoors.userById(this.entityManager, row.userId)
        if (user === undefined || user.disabled || user.email === null) {
            await authDoors.closeSession(this.entityManager, row.sessionId)
            throw new IdentityError({ code: IdentityErrorCode.AccountDisabled })
        }
        return this.tokensFor({ userId: user.id, email: user.email }, row.sessionId, presented, now)
    }

    /** The public key document access tokens verify against. */
    jwks(): Promise<JwksDocument> {
        return this.tokens.jwks()
    }

    /** Signs the person out of every other device; the session of the caller stays. */
    async endOthers(principal: Principal): Promise<void> {
        const { id: userId, sessionId: keepSessionId } = principal
        if (keepSessionId === undefined) throw new IdentityError({ code: IdentityErrorCode.Unauthenticated })
        await authDoors.closeOtherSessions(this.entityManager, userId, keepSessionId)
    }

    /** Ends the session a refresh token belongs to (an empty or unknown token changes nothing). */
    async end(presented: string): Promise<void> {
        if (presented === "") return
        const row = await this.entityManager.findOne(IdentityRefreshTokenEntity, {
            where: { tokenHash: digestOf(presented) },
        })
        if (row !== null) await authDoors.closeSession(this.entityManager, row.sessionId)
    }

    private async tokensFor(
        subject: AuthSubject,
        sessionId: string,
        refreshToken: string,
        now: Date,
    ): Promise<SessionTokens> {
        const access = await this.tokens.sign({ sub: subject.userId, email: subject.email, sessionId }, now)
        return {
            accessToken: access.token,
            accessExpiresAt: access.expiresAt.toISOString(),
            accessExpiresIn: Math.round((access.expiresAt.getTime() - now.getTime()) / 1000),
            cookieToken: refreshToken,
            refreshMaxAgeSeconds: this.options.refreshTtlSeconds,
            user: { id: subject.userId, email: subject.email },
        }
    }

    private refreshExpiry(now: Date): Date {
        return new Date(now.getTime() + this.options.refreshTtlSeconds * 1000)
    }

    private mintToken(): string {
        return `${this.ids.next()}${this.ids.next()}`.replaceAll("-", "")
    }
}
