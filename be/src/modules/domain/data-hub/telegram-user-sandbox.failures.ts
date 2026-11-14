import { DataSourcesError, DataSourcesErrorCode } from "@modules/integrations/data-sources"
import { TELEGRAM_NOT_CONFIGURED_MESSAGE, TELEGRAM_REVOKED_MESSAGE } from "@modules/integrations/telegram-user"
import { TELEGRAM_USER_SANDBOX_UNREACHABLE } from "./telegram-user-sandbox.catalogue"

/**
 * Telegram ended the session: the SAME refusal the live client throws when it finds the session no longer authorised
 * (`DataSourcesError` `Rejected` carrying the revoked sentence). The sandbox service builds no error itself: it reaches no integration.
 */
export const telegramSessionRevoked = (): Error =>
    new DataSourcesError({ code: DataSourcesErrorCode.Rejected, params: { detail: TELEGRAM_REVOKED_MESSAGE } })

/** The deployment has no Telegram app credentials: the SAME `DataSourcesError` `Unavailable` the live client throws before it connects. */
export const telegramNotConfigured = (): Error =>
    new DataSourcesError({ code: DataSourcesErrorCode.Unavailable, params: { detail: TELEGRAM_NOT_CONFIGURED_MESSAGE } })

/** Telegram did not answer: a `DataSourcesError` `Unavailable`, as the live client translates a failure it cannot name (its sentence there is its own). */
export const telegramUnreachable = (): Error =>
    new DataSourcesError({ code: DataSourcesErrorCode.Unavailable, params: { detail: TELEGRAM_USER_SANDBOX_UNREACHABLE } })
