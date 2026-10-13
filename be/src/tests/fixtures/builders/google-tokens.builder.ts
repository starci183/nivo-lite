import type { MockOf } from "@starci/jest-preset"
import type { ConnectionsService } from "@modules/domain/connections"
import { GoogleTokensService } from "@modules/domain/google-connections"
import type { GoogleClient } from "@modules/integrations/google"
import type { Clock } from "@modules/platform/clock"

/** Makes a typed double of the Google token store run the real store over the given doubles, for a spec of its callers. */
export const runRealGoogleTokens = (
    tokens: MockOf<GoogleTokensService>,
    connections: ConnectionsService,
    google: GoogleClient,
    clock: Clock,
): void => {
    const real = new GoogleTokensService(connections, google, clock)
    tokens.consent.mockImplementation((request) => real.consent(request))
    tokens.keptRefresh.mockImplementation((row, incoming) => real.keptRefresh(row, incoming))
    tokens.save.mockImplementation((save) => real.save(save))
    tokens.accessToken.mockImplementation((request) => real.accessToken(request))
    tokens.withRetry.mockImplementation((token, work, rejected) => real.withRetry(token, work, rejected))
}
