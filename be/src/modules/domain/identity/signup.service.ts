import { Injectable } from "@nestjs/common"
import { IsNull, MoreThan } from "typeorm"
import type { EntityManager } from "typeorm"
import { InjectMail } from "@modules/integrations/mail"
import type { MailClient } from "@modules/integrations/mail"
import { InjectPassportPasswords } from "@modules/integrations/passport"
import type { PassportPasswordsClient } from "@modules/integrations/passport"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectIds } from "@modules/platform/ids"
import type { Ids } from "@modules/platform/ids"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { IdentityAttemptsService } from "./attempts.service"
import { IdentityError, IdentityErrorCode } from "./errors/identity.error"
import { InjectIdentityAuthOptions } from "./identity-auth.decorators"
import { IdentityAuthLogEvent } from "./identity-auth.log-events"
import type { IdentityAuthOptions } from "./identity-auth.options"
import { passwordLinkMail } from "./password-mail.policy"
import { digestOf, isAcceptablePassword, normalizeEmail } from "./password.policy"
import { IdentityPasswordResetService } from "./password-reset.service"
import { authDoors } from "./persistence/identity-auth.sql"
import { IdentityPasswordTokenEntity } from "./persistence/entities"

const MAX_NAME_CHARACTERS = 120

@Injectable()
/** Self-service signup: an account that cannot sign in until its mailbox is confirmed through a single-use emailed link. */
export class IdentitySignupService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectPassportPasswords() private readonly passwords: PassportPasswordsClient,
        private readonly attempts: IdentityAttemptsService,
        @InjectMail() private readonly mail: MailClient,
        private readonly tokens: IdentityPasswordResetService,
        @InjectClock() private readonly clock: Clock,
        @InjectIds() private readonly ids: Ids,
        @InjectIdentityAuthOptions() private readonly options: IdentityAuthOptions,
        @InjectLogger() private readonly logger: Logger,
    ) {}

    /** Creates an unconfirmed account and mails its confirmation link; an address that already has an account is answered the same, silently. */
    async signup(name: string, email: string, password: string): Promise<void> {
        if (!isAcceptablePassword(password)) throw new IdentityError({ code: IdentityErrorCode.PasswordInvalid })
        const address = await this.admit(email)
        const known = await authDoors.userByEmail(this.entityManager, address)
        if (known !== undefined) {
            if (known.email_confirmed_at === null) await this.sendConfirmation(known.id, address)
            return
        }
        const id = this.ids.next()
        const created = await authDoors.createUser(this.entityManager, {
            id,
            email: address,
            hash: await this.passwords.hash(password),
            confirmed: false,
            meta: JSON.stringify({ full_name: name.trim().slice(0, MAX_NAME_CHARACTERS) }),
            now: this.clock.now(),
        })
        await this.sendConfirmation(created ?? id, address)
    }

    /** Mails the confirmation link again to an unconfirmed account; the answer never says whether the address has one. */
    async resend(email: string): Promise<void> {
        const address = await this.admit(email)
        const known = await authDoors.userByEmail(this.entityManager, address)
        if (known?.email_confirmed_at === null && !known.disabled) {
            await this.sendConfirmation(known.id, address)
        }
    }

    /** Spends a confirmation link and confirms the mailbox. */
    async confirm(token: string): Promise<void> {
        const now = this.clock.now()
        await this.entityManager.transaction(async (scoped) => {
            const row = await scoped.findOne(IdentityPasswordTokenEntity, {
                where: { tokenHash: digestOf(token), usedAt: IsNull(), expiresAt: MoreThan(now) },
                lock: { mode: "pessimistic_write" },
            })
            if (row?.purpose !== "confirm") throw new IdentityError({ code: IdentityErrorCode.ResetTokenInvalid })
            await scoped.update(IdentityPasswordTokenEntity, { userId: row.userId, usedAt: IsNull() }, { usedAt: now })
            await authDoors.confirmEmail(scoped, row.userId, now)
        })
    }

    private async admit(email: string): Promise<string> {
        const address = normalizeEmail(email)
        await this.attempts.admit("signup", address)
        return address
    }

    private async sendConfirmation(userId: string, address: string): Promise<void> {
        const token = await this.tokens.mint(userId, "confirm", this.options.resetTtlSeconds)
        const link = `${this.options.webOrigin}/auth/confirm?token=${token}`
        const mail = passwordLinkMail("confirm", link, Math.ceil(this.options.resetTtlSeconds / 3600))
        await this.mail.sendThroughPlatform({ to: address, ...mail }).catch((cause: unknown) => {
            this.logger.error(IdentityAuthLogEvent.MailFailed, cause, { kind: "confirm" })
        })
    }
}
