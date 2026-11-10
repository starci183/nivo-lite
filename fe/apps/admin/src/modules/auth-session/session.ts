import { authClient } from "@/modules/auth"

/** Refreshes through the httpOnly cookie and answers the new access token (`undefined` when it cannot be refreshed). Overlapping calls share one refresh. */
export const renewSessionToken = (): Promise<string | undefined> => authClient.refreshAccessToken()

/** The access token of the current session, refreshed when missing or about to expire; `undefined` when signed out. */
export const sessionAccessToken = (): Promise<string | undefined> => authClient.accessToken()
