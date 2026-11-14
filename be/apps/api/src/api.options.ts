import { DataSourcesError, DataSourcesErrorCode } from "@modules/integrations/data-sources"
import type { TelegramUserErrors } from "@modules/integrations/telegram-user"

/** The existing data-sources error family used by the personal Telegram integration. */
export const TELEGRAM_USER_ERRORS: TelegramUserErrors = {
    rejected: (detail, cause) =>
        new DataSourcesError({ code: DataSourcesErrorCode.Rejected, params: { detail }, cause }),
    unavailable: (detail, cause) =>
        new DataSourcesError({ code: DataSourcesErrorCode.Unavailable, params: { detail }, cause }),
    isError: (error): error is DataSourcesError => error instanceof DataSourcesError,
}

export type { ApiOptions } from "./api.env"
