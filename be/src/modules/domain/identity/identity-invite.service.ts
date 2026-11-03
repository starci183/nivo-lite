import { Injectable } from "@nestjs/common"
import { IsNull } from "typeorm"
import type { EntityManager } from "typeorm"
import { InjectMailSettings, InjectMailer } from "@modules/integrations/mail"
import type { MailOptions, Mailer, RenderedMail } from "@modules/integrations/mail"
import { digestOf, normalizeEmail } from "@modules/integrations/passport"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectIds } from "@modules/platform/ids"
import type { Ids } from "@modules/platform/ids"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { sameSitePath } from "@modules/platform/primitives"
import type { InviteSent } from "./identity-auth.contracts"
import { InjectIdentityAuthOptions } from "./identity-auth.decorators"
import { IdentityAuthLogEvent } from "./identity-auth.log-events"
import type { IdentityAuthOptions } from "./identity-auth.options"
import { inviteAccountMail, inviteExistingMail } from "./messages/identity-mail.messages"
import { accountDoors } from "./persistence/account-doors.port"
import { IdentityEmailTokenEntity } from "./persistence/entities"

const SECONDS_PER_HOUR = 3600
/** The purpose an invitation link is stored under: spending it is the reset door, which sets the first password and confirms the mailbox. */
const RESET = "reset"

@Injectable()
/**
 * Delivers a workspace invitation by email: a new person gets an account with a single-use link to set a password and continue to the
 * invitation, a known person a link to the invitation. The link of a new person is a reset link with the longer invitation lifetime.
 */
export class IdentityInviteService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectMailer() private readonly mailer: Mailer,
        @InjectMailSettings() private readonly mail: MailOptions,
        @InjectClock() private readonly clock: Clock,
        @InjectIds() private readonly ids: Ids,
        @InjectIdentityAuthOptions() private readonly options: IdentityAuthOptions,
        @InjectLogger() private readonly logger: Logger,
    ) {}

    /**
     * Emails the invitation. When the mail cannot be sent the delivery is `none` and the caller shows the link to copy. Never throws.
     * The mail is written in the default language of the mail settings.
     */
    async deliver(email: string, redirectTo: string): Promise<InviteSent> {
        try {
            const address = normalizeEmail(email)
            const next = this.nextPathOf(redirectTo)
            const known = await accountDoors.userByEmail(this.entityManager, address)
            if (known !== undefined) {
                await this.send(address, inviteExistingMail(this.mail.defaultLanguage, { brand: this.mail.brandName, url: `${this.mail.webOrigin}${next}` }))
                return "existing"
            }
            const created = await accountDoors.createUser(this.entityManager, {
                id: this.ids.next(),
                email: address,
                hash: null,
                confirmed: false,
                meta: "{}",
                now: this.clock.now(),
            })
            if (created === undefined) return "none"
            const token = await this.mint(created)
            const url = `${this.mail.webOrigin}/auth/reset?token=${encodeURIComponent(token)}&next=${encodeURIComponent(next)}`
            const hours = Math.ceil(this.options.inviteTtlSeconds / SECONDS_PER_HOUR)
            await this.send(address, inviteAccountMail(this.mail.defaultLanguage, { brand: this.mail.brandName, url, hours }))
            return "invited"
        } catch (cause) {
            this.logger.error(IdentityAuthLogEvent.MailFailed, cause, { kind: "invite" })
            return "none"
        }
    }

    private async send(to: string, message: RenderedMail): Promise<void> {
        await this.mailer.send({ to, message })
    }

    /** Stores a fresh single-use token for a person (older live ones stop working) and answers the plain token for the one link that carries it. */
    private async mint(userId: string): Promise<string> {
        const now = this.clock.now()
        const token = `${this.ids.next()}${this.ids.next()}`.replaceAll("-", "")
        await this.entityManager.transaction(async (scoped) => {
            await scoped.update(IdentityEmailTokenEntity, { userId, purpose: RESET, usedAt: IsNull() }, { usedAt: now })
            await scoped.insert(IdentityEmailTokenEntity, {
                id: this.ids.next(),
                userId,
                purpose: RESET,
                tokenHash: digestOf(token),
                expiresAt: new Date(now.getTime() + this.options.inviteTtlSeconds * 1000),
                usedAt: null,
                createdAt: now,
            })
        })
        return token
    }

    /** The same-site path the invitation link continues to: its `next` query value, else the path of the link itself, else the root. */
    private nextPathOf(redirectTo: string): string {
        if (!URL.canParse(redirectTo)) return "/"
        const url = new URL(redirectTo)
        return sameSitePath(url.searchParams.get("next") ?? `${url.pathname}${url.search}`, "/")
    }
}
