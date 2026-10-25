import type { AccountOverview } from "@modules/domain/workspace-members"
import type { MyAccountType } from "./dto/my-account.type"

/** Maps the account overview to the GraphQL type. */
export const toMyAccountType = (result: AccountOverview): MyAccountType => ({
    name: result.name,
    email: result.email,
    avatarUrl: result.avatarUrl,
    uploadedAvatarUrl: result.uploadedAvatarUrl,
    providers: [...result.providers],
    sessions: result.sessions.map((session) => ({ ...session })),
})
