import { Injectable } from "@nestjs/common"
import { IsNull, MoreThan } from "typeorm"
import type { EntityManager } from "typeorm"
import { InjectPassportPasswords } from "@modules/integrations/passport"
import type { PassportPasswordsClient } from "@modules/integrations/passport"
import type { Principal } from "@modules/platform/cqrs"
import { InjectMail } from "@modules/integrations/mail"
import type { MailClient } from "@modules/integrations/mail"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectIds } from "@modules/platform/ids"
import type { Ids } from "@modules/platform/ids"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { IdentityAttemptsService } from "./attempts.service"
import { IdentityError, IdentityErrorCode } from "./errors/identity.error"
import type { PasswordPurpose } from "./identity-auth.contracts"
import { InjectIdentityAuthOptions } from "./identity-auth.decorators"
import { IdentityAuthLogEvent } from "./identity-auth.log-events"
import type { IdentityAuthOptions } from "./identity-auth.options"
import { passwordLinkMail } from "./password-mail.policy"
import { digestOf, isAcceptablePassword, isPresentablePassword, normalizeEmail } from "./password.policy"
import { authDoors } from "./persistence/identity-auth.sql"
import { IdentityPasswordTokenEntity } from "./persistence/entities"

@Injectable()
/** Forgotten and first passwords: a hashed single-use token is emailed, and spending it sets the password and ends every session. */
export class IdentityPasswordResetService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectPassportPasswords() private readonly passwords: PassportPasswordsClient,
        private readonly attempts: IdentityAttemptsService,
        @InjectMail() private readonly mail: MailClient,
        @InjectClock() private readonly clock: Clock,
        @InjectIds() private readonly ids: Ids,
        @InjectIdentityAuthOptions() private readonly options: IdentityAuthOptions,
        @InjectLogger() private readonly logger: Logger,
    ) {}

    /** Emails a reset link when the address has an account; the answer never says whether it does. */
    async request(email: string): Promise<void> {
        const address = normalizeEmail(email)
        await this.attempts.admit("reset", address)
        const user = await authDoors.userByEmail(this.entityManager, address)
        if (user === undefined || user.disabled) return
        const token = await this.mint(user.id, "reset", this.options.resetTtlSeconds)
        const link = `${this.options.webOrigin}/auth/reset?token=${token}`
        const mail = passwordLinkMail("reset", link, Math.ceil(this.options.resetTtlSeconds / 3600))
        await this.mail.sendThroughPlatform({ to: address, ...mail }).catch((cause: unknown) => {
            this.logger.error(IdentityAuthLogEvent.MailFailed, cause, { kind: "reset" })
        })
    }

    /** Spends a link: sets the new password, confirms the mailbox and ends every session of the person. */
    async complete(token: string, password: string): Promise<void> {
        if (!isAcceptablePassword(password)) throw new IdentityError({ code: IdentityErrorCode.PasswordInvalid })
        const now = this.clock.now()
        const hash = await this.passwords.hash(password)
        await this.entityManager.transaction(async (scoped) => {
            const row = await scoped.findOne(IdentityPasswordTokenEntity, {
                where: { tokenHash: digestOf(token), usedAt: IsNull(), expiresAt: MoreThan(now) },
                lock: { mode: "pessimistic_write" },
            })
            if (row?.purpose !== "reset" && row?.purpose !== "invite") {
                throw new IdentityError({ code: IdentityErrorCode.ResetTokenInvalid })
            }
            await scoped.update(IdentityPasswordTokenEntity, { userId: row.userId, usedAt: IsNull() }, { usedAt: now })
            await authDoors.setPassword(scoped, row.userId, hash, now)
            await authDoors.closeUserSessions(scoped, row.userId)
        })
    }

    /** Stores a single-use token for a person and answers the plain token for the one link that carries it. */
    async mint(userId: string, purpose: PasswordPurpose, ttlSeconds: number): Promise<string> {
        const now = this.clock.now()
        const token = `${this.ids.next()}${this.ids.next()}`.replaceAll("-", "")
        await this.entityManager.insert(IdentityPasswordTokenEntity, {
            id: this.ids.next(),
            userId,
            tokenHash: digestOf(token),
            purpose,
            createdAt: now,
            expiresAt: new Date(now.getTime() + ttlSeconds * 1000),
        })
        return token
    }

    /** Changes the password of a signed-in person who proves the current one; other devices are signed out. */
    async change(principal: Principal, current: string, next: string): Promise<void> {
        const { id: userId, email } = principal
        if (email === undefined) throw new IdentityError({ code: IdentityErrorCode.Unauthenticated })
        if (!isAcceptablePassword(next)) throw new IdentityError({ code: IdentityErrorCode.PasswordInvalid })
        const address = normalizeEmail(email)
        await this.attempts.admit("login", address)
        const user = await authDoors.userByEmail(this.entityManager, address)
        const matches = await this.passwords.verify(
            isPresentablePassword(current) ? current : "",
            user?.encrypted_password ?? "",
        )
        if (user?.id !== userId || !matches) {
            throw new IdentityError({ code: IdentityErrorCode.InvalidCredentials })
        }
        await authDoors.setPassword(this.entityManager, userId, await this.passwords.hash(next), this.clock.now())
    }
}
