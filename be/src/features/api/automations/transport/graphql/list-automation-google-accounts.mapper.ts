import type { GoogleAccount } from "@modules/domain/automations"
import type { AutomationGoogleAccountType } from "./dto/google-account.type"

/** Maps the Google accounts of the workspace to the GraphQL types. */
export const toAutomationGoogleAccountTypes = (
    result: ReadonlyArray<GoogleAccount>,
): Array<AutomationGoogleAccountType> => result.map((account) => ({ ...account }))
