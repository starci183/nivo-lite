import type { AccountOverview } from "@modules/domain/accounts"
import type { MyAccountType } from "./dto/my-account.type"

/** Maps the account overview to the GraphQL type. */
export const toMyAccountType = (result: AccountOverview): MyAccountType => ({
    name: result.name,
    email: result.email,
    providers: [...result.providers],
    sessions: result.sessions.map((session) => ({ ...session })),
})
