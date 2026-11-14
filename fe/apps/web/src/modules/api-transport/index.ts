import type { AuthTransport } from "@nivo-lite/api"
import { endSession } from "@/modules/auth-actions"
import { renewSessionToken, sessionAccessToken } from "@/modules/auth-session"
import { graphqlTuning, graphqlUrl, isPrototypeMode } from "@/modules/config"
import { fixtureAnswerOf } from "@/modules/fixture-api"
import { i18n } from "@/modules/i18n"
import { loginPath, openWorkspaceId } from "@/modules/routes"

/** What the web app tells the shared transport about itself: its tuning, endpoint, session, open workspace and prototype fixtures. */
export const webApiTransport: AuthTransport = {
    tuning: graphqlTuning,
    uri: graphqlUrl,
    localeCookieName: i18n.localeCookieName,
    endSession,
    signInUrl: loginPath,
    getToken: sessionAccessToken,
    refresh: renewSessionToken,
    workspaceId: openWorkspaceId,
    fixture: { active: isPrototypeMode, answer: fixtureAnswerOf },
}
