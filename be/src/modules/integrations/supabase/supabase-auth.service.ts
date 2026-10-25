import { Injectable } from "@nestjs/common"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ok, refused } from "@modules/platform/primitives"
import type { Outcome } from "@modules/platform/primitives"
import { SupabaseErrorCode } from "./errors/supabase.error"
import type { SupabaseAdminClient, SupabasePublicClient } from "./supabase.client"
import type { AuthAccount, InviteSent, UploadedAvatarUrl } from "./supabase.contracts"
import { InjectSupabaseAdminClient, InjectSupabasePublicClient } from "./supabase.decorators"
import { SupabaseLogEvent } from "./supabase.log-events"

/**
 * The metadata key of the picture a person uploaded. It is not `avatar_url`: Auth rewrites that key from the provider profile on
 * every OAuth sign-in, which would silently replace the upload.
 */
const UPLOADED_AVATAR_KEY = "nivo_avatar_url"

/** A metadata value that is an HTTPS address, else null. */
const httpsOf = (value: unknown): string | null =>
    typeof value === "string" && value.startsWith("https://") ? value : null

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
        const uploaded = httpsOf(metadata[UPLOADED_AVATAR_KEY])
        return ok({
            id: user.id,
            email,
            lastSignInAt: user.last_sign_in_at ?? null,
            avatarUrl: uploaded ?? (typeof metadata.avatar_url === "string" ? metadata.avatar_url : null),
            uploadedAvatarUrl: uploaded,
            displayName: typeof named === "string" ? named : email.split("@")[0] || "Owner",
        })
    }

    /** Keeps the picture a person uploaded (an HTTPS address) on their account, or drops it back to the provider's or the generated one. */
    async setUploadedAvatar(userId: string, avatarUrl: UploadedAvatarUrl): Promise<Outcome<true, SupabaseErrorCode>> {
        const updated = await this.admin.auth.updateUserById(userId, {
            user_metadata: { [UPLOADED_AVATAR_KEY]: avatarUrl },
        })
        return updated.error === null ? ok(true) : refused(SupabaseErrorCode.AccountNotFound)
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
