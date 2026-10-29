import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPassportPasswords } from "@modules/integrations/passport"
import type {
    AuthSubject,
    GoogleProfile,
    PassportAuthenticator,
    PassportPasswordsClient,
} from "@modules/integrations/passport"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectIds } from "@modules/platform/ids"
import type { Ids } from "@modules/platform/ids"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { IdentityAttemptsService } from "./attempts.service"
import { IdentityError, IdentityErrorCode } from "./errors/identity.error"
import { IdentityAuthLogEvent } from "./identity-auth.log-events"
import { isPresentablePassword, normalizeEmail } from "./password.policy"
import { authDoors } from "./persistence/identity-auth.sql"

/** The profile keys a Google sign-in may fill on the account; they never overwrite what the person already set. */
const profileKeysOf = (profile: GoogleProfile): Record<string, string | boolean> => ({
    ...(profile.name === null ? {} : { full_name: profile.name, name: profile.name }),
    ...(profile.picture === null ? {} : { avatar_url: profile.picture, picture: profile.picture }),
    ...(profile.email === null ? {} : { email: profile.email }),
    email_verified: profile.emailVerified,
})

@Injectable()
/** The two sign-in decisions: is this email and password right, and which account does this Google profile stand for. */
export class IdentityAuthenticatorService implements PassportAuthenticator {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectPassportPasswords() private readonly passwords: PassportPasswordsClient,
        private readonly attempts: IdentityAttemptsService,
        @InjectClock() private readonly clock: Clock,
        @InjectIds() private readonly ids: Ids,
        @InjectLogger() private readonly logger: Logger,
    ) {}

    /** Verifies the pair (existing GoTrue bcrypt hashes included). An unknown address and a wrong password answer the same refusal. */
    async verifyPassword(email: string, password: string): Promise<AuthSubject> {
        const address = normalizeEmail(email)
        await this.attempts.admit("login", address)
        const row = await authDoors.userByEmail(this.entityManager, address)
        const matches = await this.passwords.verify(
            isPresentablePassword(password) ? password : "",
            row?.encrypted_password ?? "",
        )
        if (row === undefined || !matches) throw new IdentityError({ code: IdentityErrorCode.InvalidCredentials })
        if (row.disabled) throw new IdentityError({ code: IdentityErrorCode.AccountDisabled })
        if (row.email_confirmed_at === null) throw new IdentityError({ code: IdentityErrorCode.EmailNotConfirmed })
        await authDoors.touchUser(this.entityManager, row.id, this.clock.now(), false, "{}")
        return { userId: row.id, email: row.email }
    }

    /** Finds the account a Google subject is linked to, else links by a verified email, else creates the account. */
    async signInWithGoogle(profile: GoogleProfile): Promise<AuthSubject> {
        if (profile.email === null || !profile.emailVerified) {
            throw new IdentityError({ code: IdentityErrorCode.GoogleEmailUnverified })
        }
        const address = normalizeEmail(profile.email)
        const now = this.clock.now()
        const userId = await this.entityManager.transaction(async (scoped) => {
            const linked = await authDoors.userByGoogle(scoped, profile.subject)
            const byEmail = linked === null ? await authDoors.userByEmail(scoped, address) : undefined
            const known = linked ?? byEmail?.id
            const id = known ?? (await this.createFor(scoped, address, profile, now))
            await authDoors.linkGoogle(
                scoped,
                id,
                profile.subject,
                JSON.stringify({
                    sub: profile.subject,
                    email: address,
                    name: profile.name,
                    picture: profile.picture,
                    email_verified: true,
                }),
                now,
            )
            await authDoors.touchUser(scoped, id, now, true, JSON.stringify(profileKeysOf(profile)))
            return id
        })
        const user = await authDoors.userById(this.entityManager, userId)
        if (user?.email === undefined || user.email === null) {
            throw new IdentityError({ code: IdentityErrorCode.AccountNotFound })
        }
        if (user.disabled) throw new IdentityError({ code: IdentityErrorCode.AccountDisabled })
        return { userId: user.id, email: user.email }
    }

    private async createFor(
        scoped: EntityManager,
        address: string,
        profile: GoogleProfile,
        now: Date,
    ): Promise<string> {
        const id = this.ids.next()
        const created = await authDoors.createUser(scoped, {
            id,
            email: address,
            hash: null,
            confirmed: true,
            meta: JSON.stringify(profileKeysOf(profile)),
            now,
        })
        this.logger.info(IdentityAuthLogEvent.AccountCreated, { userId: id })
        return created ?? id
    }
}
