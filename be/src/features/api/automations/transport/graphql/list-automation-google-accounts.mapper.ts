import type { GoogleAccount } from "@modules/domain/automations"
import type { GoogleAccountType } from "./dto/google-account.type"

/** Maps the Google accounts of the workspace to the GraphQL types. */
export const toGoogleAccountTypes = (result: ReadonlyArray<GoogleAccount>): Array<GoogleAccountType> =>
    result.map((account) => ({ ...account }))
