import type { AuthTransport } from "@nivo-lite/api"
import { authClient } from "@/modules/auth"
import { renewSessionToken, sessionAccessToken } from "@/modules/auth-session"
import { consoleLoginUrl, graphqlTuning, graphqlUrl } from "@/modules/config"
import { i18n } from "@/modules/i18n"

/** What the admin app tells the shared transport about itself: its tuning, endpoint and session. */
export const adminApiTransport: AuthTransport = {
    tuning: graphqlTuning,
    uri: graphqlUrl,
    localeCookieName: i18n.localeCookieName,
    endSession: () => authClient.signOut(),
    signInUrl: consoleLoginUrl,
    getToken: sessionAccessToken,
    refresh: renewSessionToken,
}
