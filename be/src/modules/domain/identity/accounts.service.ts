import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { AuthError, normalizeEmail, type AuthPasswords, type AuthSessions } from "@modules/integrations/passport"
import { InjectClock, type Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectIds, type Ids } from "@modules/platform/ids"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { ok, refused, type Outcome } from "@modules/platform/primitives"
import { IdentityAuthenticatorService } from "./authenticator.service"
import { refusing } from "./auth-refusal.policy"
import { IdentityError, IdentityErrorCode } from "./errors/identity.error"
import { InjectAccessTokenVerifier, InjectAuthPasswords, InjectAuthSessions } from "./identity.decorators"
import type { VerifyAccessToken } from "./identity.contracts"
import type {
    AccountAdminFailure,
    AccountCreated,
    AccountPage,
    AccountPageResult,
    AccountRemoved,
    InviteSent,
    NewAccount,
    PasswordPrincipal,
} from "./identity-auth.contracts"
import { IdentityAuthLogEvent } from "./identity-auth.log-events"
import { IdentityInviteService } from "./identity-invite.service"
import { accountDoors } from "./persistence/account-doors.port"
import { authDoors } from "./persistence/auth-doors.port"

/** The metadata key of the picture a person uploaded; the Google sign-in never rewrites it. */
const UPLOADED_AVATAR_KEY = "nivo_avatar_url"

/** What the workspace pages need of one account. */
export interface IdentityAccount {
    /** The account email, empty when the account has none. */
    readonly email: string
    /** The last sign-in instant, ISO 8601; null before the first. */
    readonly lastSignInAt: string | null
    /** The name from the profile, else the email local part. */
    readonly displayName: string
    /** The picture the team sees: the uploaded one, else the provider one. */
    readonly avatarUrl: string | null
    /** The HTTPS address of the picture the person uploaded, when there is one. */
    readonly uploadedAvatarUrl: string | null
}

/** The HTTPS address of an uploaded picture, or null to drop it. */
export type OptionalAvatarUrl = string | null

/** The principal a password opened, or null for a wrong pair. */
export type OptionalPasswordPrincipal = PasswordPrincipal | null

/** The id of the person a token belongs to, or null. */
export type OptionalUserId = string | null

const httpsOf = (value: unknown): string | null =>
    typeof value === "string" && value.startsWith("https://") ? value : null

/** The part of an email before the "@" as the display name; "Owner" when it is empty. */
const localPartOf = (email: string): string => {
    const local = email.split("@")[0]
    return local === undefined || local === "" ? "Owner" : local
}

const isoOf = (value: Date | string | null): string | null => (value === null ? null : new Date(value).toISOString())

@Injectable()
/** Accounts for the workspace capabilities: reads one, keeps the uploaded picture, and delivers invitations by email. */
export class IdentityAccountsService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly invites: IdentityInviteService,
        private readonly authenticator: IdentityAuthenticatorService,
        @InjectAuthSessions() private readonly sessions: AuthSessions,
        @InjectAuthPasswords() private readonly passwords: AuthPasswords,
        @InjectAccessTokenVerifier() private readonly verifyAccessToken: VerifyAccessToken,
        @InjectClock() private readonly clock: Clock,
        @InjectIds() private readonly ids: Ids,
        @InjectLogger() private readonly logger: Logger,
    ) {}

    /** The account of one user, or a not-found refusal. */
    async accountOf(userId: string): Promise<Outcome<IdentityAccount, IdentityErrorCode>> {
        const user = await authDoors.userById(this.entityManager, userId)
        if (user === undefined) return refused(IdentityErrorCode.AccountNotFound)
        const named = [user.meta.full_name, user.meta.name].find((value) => typeof value === "string" && value !== "")
        const email = user.email ?? ""
        const uploaded = httpsOf(user.meta[UPLOADED_AVATAR_KEY])
        return ok({
            email,
            lastSignInAt: isoOf(user.last_sign_in_at),
            displayName: typeof named === "string" ? named : localPartOf(email),
            avatarUrl: uploaded ?? (typeof user.meta.avatar_url === "string" ? user.meta.avatar_url : null),
            uploadedAvatarUrl: uploaded,
        })
    }

    /** Keeps the picture a person uploaded (an HTTPS address) on the account, or drops it with null. */
    async setUploadedAvatar(userId: string, avatarUrl: OptionalAvatarUrl): Promise<Outcome<true, IdentityErrorCode>> {
        const changed = await authDoors.setAvatar(this.entityManager, userId, avatarUrl)
        return changed ? ok(true) : refused(IdentityErrorCode.AccountNotFound)
    }

    /** One page of accounts for the operator commands. A failure of the door is answered, not thrown. */
    async listUsers(page: AccountPage): Promise<AccountPageResult> {
        try {
            const rows = await authDoors.listUsers(this.entityManager, page.page, page.perPage)
            return {
                data: { users: rows.map((row) => ({ id: row.id, email: row.email ?? "", user_metadata: row.meta })) },
                error: null,
            }
        } catch (cause) {
            return { data: { users: [] }, error: this.failureOf(cause) }
        }
    }

    /** Creates a person with a password (a confirmed one when the caller says so). A failure of the door is answered, not thrown. */
    async createUser(user: NewAccount): Promise<AccountCreated> {
        try {
            const id = await accountDoors.createUser(this.entityManager, {
                id: this.ids.next(),
                email: normalizeEmail(user.email),
                hash: await this.passwords.hash(user.password),
                confirmed: user.email_confirm,
                meta: JSON.stringify(user.user_metadata),
                now: this.clock.now(),
            })
            return id === undefined
                ? { data: { user: null }, error: { message: "The account was not created." } }
                : { data: { user: { id } }, error: null }
        } catch (cause) {
            return { data: { user: null }, error: this.failureOf(cause) }
        }
    }

    /**
     * Proves the password of a person and opens a session of its own, which the caller must close. Answers null for a wrong pair
     * (an unknown address, a wrong password, a disabled or unconfirmed account).
     */
    async openPasswordPrincipal(email: string, password: string): Promise<OptionalPasswordPrincipal> {
        let subject: Awaited<ReturnType<IdentityAuthenticatorService["verifyPassword"]>>
        try {
            subject = await this.authenticator.verifyPassword(email, password)
        } catch (cause) {
            if (cause instanceof IdentityError || cause instanceof AuthError) return null
            throw cause
        }
        const tokens = await refusing(() => this.sessions.start(subject, { userAgent: null, ip: null }))
        let closed: boolean | undefined
        return {
            id: subject.userId,
            close: async () => {
                if (closed !== undefined) return closed
                try {
                    await refusing(() => this.sessions.end(tokens.cookieToken))
                    closed = true
                } catch (cause) {
                    closed = false
                    this.logger.error(IdentityAuthLogEvent.AccountAdminFailed, cause, { kind: "principal-close" })
                }
                return closed
            },
        }
    }

    /** Verifies an access token and answers only the id of the person it belongs to, or null. */
    async verifyUser(token: string): Promise<OptionalUserId> {
        const verified = await this.verifyAccessToken(token)
        return verified.kind === "ok" ? verified.value.id : null
    }

    /** Deletes a person for good (the operator cleanup removes the accounts no kept workspace holds). Deleting an absent account is not a failure. */
    async deleteUser(id: string): Promise<AccountRemoved> {
        try {
            await authDoors.deleteUser(this.entityManager, id)
            return { error: null }
        } catch (cause) {
            return { error: this.failureOf(cause) }
        }
    }

    /**
     * Emails the invitation: a new person gets an account with a link to set a password and continue to the invitation, a known person
     * a link to the invitation. When the mail cannot be sent the delivery is `none` and the caller shows the link to copy. Never throws.
     */
    deliverInvite(email: string, redirectTo: string): Promise<InviteSent> {
        return this.invites.deliver(email, redirectTo)
    }

    private failureOf(cause: unknown): AccountAdminFailure {
        this.logger.error(IdentityAuthLogEvent.AccountAdminFailed, cause, { kind: "account-admin" })
        return { message: cause instanceof Error ? cause.message : "The account door failed." }
    }
}
