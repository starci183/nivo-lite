import { Injectable } from "@nestjs/common"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ok, refused } from "@modules/platform/primitives"
import type { Outcome } from "@modules/platform/primitives"
import { SupabaseErrorCode } from "./errors/supabase.error"
import type { SupabaseAdminClient, SupabasePublicClient } from "./supabase.client"
import type { AuthAccount, InviteSent } from "./supabase.contracts"
import { InjectSupabaseAdminClient, InjectSupabasePublicClient } from "./supabase.decorators"
import { SupabaseLogEvent } from "./supabase.log-events"

@Injectable()
/** Reads accounts and delivers invitations through Supabase Auth; the only door domains have to Auth. */
export class SupabaseAuthService {
    constructor(
        @InjectSupabaseAdminClient() private readonly admin: SupabaseAdminClient,
        @InjectSupabasePublicClient() private readonly publicClient: SupabasePublicClient,
        @InjectLogger() private readonly logger: Logger,
    ) {}

    /** The account of one Auth user, or a not-found refusal when none has that id. */
    async accountOf(userId: string): Promise<Outcome<AuthAccount, SupabaseErrorCode>> {
        const found = await this.admin.auth.getUserById(userId)
        if (found.error !== null) return refused(SupabaseErrorCode.AccountNotFound)
        const user = found.data.user
        const metadata: Record<string, unknown> = user.user_metadata
        const named = [metadata.full_name, metadata.name].find((value) => typeof value === "string" && value !== "")
        const email = user.email ?? ""
        return ok({
            id: user.id,
            email,
            lastSignInAt: user.last_sign_in_at ?? null,
            avatarUrl: typeof metadata.avatar_url === "string" ? metadata.avatar_url : null,
            displayName: typeof named === "string" ? named : email.split("@")[0] || "Owner",
        })
    }

    /**
     * Emails the invitation: a new person gets an account invite, a known person a sign-in link, and when neither can be
     * sent the delivery is `none` and the caller shows the link to copy. Never throws.
     */
    async deliverInvite(email: string, redirectTo: string): Promise<InviteSent> {
        try {
            const invited = await this.admin.auth.inviteUserByEmail(email, { redirectTo })
            if (invited.error === null) return "invited"
            return (await this.publicClient.sendSignInLink(email, redirectTo)) ? "existing" : "none"
        } catch (cause) {
            this.logger.error(SupabaseLogEvent.InviteDeliveryFailed, cause)
            return "none"
        }
    }
}
