import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectMail } from "@modules/integrations/mail"
import { InjectPassportPasswords } from "@modules/integrations/passport"
import type { PassportPasswordsClient } from "@modules/integrations/passport"
import type { MailClient } from "@modules/integrations/mail"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectIds } from "@modules/platform/ids"
import type { Ids } from "@modules/platform/ids"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ok, refused, sameSitePath } from "@modules/platform/primitives"
import type { Outcome } from "@modules/platform/primitives"
import { IdentityAuthenticatorService } from "./authenticator.service"
import { IdentityError, IdentityErrorCode } from "./errors/identity.error"
import { InjectAccessTokenVerifier } from "./identity.decorators"
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
import { InjectIdentityAuthOptions } from "./identity-auth.decorators"
import { IdentityAuthLogEvent } from "./identity-auth.log-events"
import type { IdentityAuthOptions } from "./identity-auth.options"
import { inviteLinkMail, passwordLinkMail } from "./password-mail.policy"
import { normalizeEmail } from "./password.policy"
import { IdentityPasswordResetService } from "./password-reset.service"
import { IdentitySessionsService } from "./sessions.service"
import { authDoors } from "./persistence/identity-auth.sql"

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

const httpsOf = (value: unknown): string | null =>
    typeof value === "string" && value.startsWith("https://") ? value : null

const isoOf = (value: Date | string | null): string | null => (value === null ? null : new Date(value).toISOString())

@Injectable()
/** Accounts for the workspace capabilities: reads one, keeps the uploaded picture, and delivers invitations by email. */
export class IdentityAccountsService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectMail() private readonly mail: MailClient,
        private readonly resets: IdentityPasswordResetService,
        private readonly authenticator: IdentityAuthenticatorService,
        private readonly sessions: IdentitySessionsService,
        @InjectPassportPasswords() private readonly passwords: PassportPasswordsClient,
        @InjectAccessTokenVerifier() private readonly verifyAccessToken: VerifyAccessToken,
        @InjectClock() private readonly clock: Clock,
        @InjectIds() private readonly ids: Ids,
        @InjectIdentityAuthOptions() private readonly options: IdentityAuthOptions,
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
            displayName: typeof named === "string" ? named : email.split("@")[0] || "Owner",
            avatarUrl: uploaded ?? (typeof user.meta.avatar_url === "string" ? user.meta.avatar_url : null),
            uploadedAvatarUrl: uploaded,
        })
    }

    /** Keeps the picture a person uploaded (an HTTPS address) on the account, or drops it with null. */
    async setUploadedAvatar(userId: string, avatarUrl: string | null): Promise<Outcome<true, IdentityErrorCode>> {
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
            const id = await authDoors.createUser(this.entityManager, {
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
    async openPasswordPrincipal(email: string, password: string): Promise<PasswordPrincipal | null> {
        let subject: Awaited<ReturnType<IdentityAuthenticatorService["verifyPassword"]>>
        try {
            subject = await this.authenticator.verifyPassword(email, password)
        } catch (cause) {
            if (cause instanceof IdentityError) return null
            throw cause
        }
        const tokens = await this.sessions.start(subject, { userAgent: null, ip: null })
        let closed: boolean | undefined
        return {
            id: subject.userId,
            close: async () => {
                if (closed !== undefined) return closed
                try {
                    await this.sessions.end(tokens.cookieToken)
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
    async verifyUser(token: string): Promise<string | null> {
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
    async deliverInvite(email: string, redirectTo: string): Promise<InviteSent> {
        try {
            const address = normalizeEmail(email)
            const known = await authDoors.userByEmail(this.entityManager, address)
            if (known !== undefined) {
                await this.mail.sendThroughPlatform({
                    to: address,
                    ...inviteLinkMail(`${this.options.webOrigin}${this.nextPathOf(redirectTo)}`),
                })
                return "existing"
            }
            const created = await authDoors.createUser(this.entityManager, {
                id: this.ids.next(),
                email: address,
                hash: null,
                confirmed: false,
                meta: "{}",
                now: this.clock.now(),
            })
            if (created === undefined) return "none"
            const token = await this.resets.mint(created, "invite", this.options.inviteTtlSeconds)
            const next = encodeURIComponent(this.nextPathOf(redirectTo))
            const link = `${this.options.webOrigin}/auth/reset?token=${token}&next=${next}`
            await this.mail.sendThroughPlatform({
                to: address,
                ...passwordLinkMail("invite", link, Math.ceil(this.options.inviteTtlSeconds / 3600)),
            })
            return "invited"
        } catch (cause) {
            this.logger.error(IdentityAuthLogEvent.MailFailed, cause, { kind: "invite" })
            return "none"
        }
    }

    private failureOf(cause: unknown): AccountAdminFailure {
        this.logger.error(IdentityAuthLogEvent.AccountAdminFailed, cause, { kind: "account-admin" })
        return { message: cause instanceof Error ? cause.message : "The account door failed." }
    }

    /** The same-site path the invitation link continues to: its `next` query value, else the path of the link itself, else the root. */
    private nextPathOf(redirectTo: string): string {
        if (!URL.canParse(redirectTo)) return "/"
        const url = new URL(redirectTo)
        return sameSitePath(url.searchParams.get("next") ?? `${url.pathname}${url.search}`, "/")
    }
}
