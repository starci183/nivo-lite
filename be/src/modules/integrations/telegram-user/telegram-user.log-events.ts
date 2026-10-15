/** Log events of the personal Telegram client. */
export enum TelegramUserLogEvent {
    /** The connection to Telegram could not be closed cleanly after the work was done. */
    CloseFailed = "telegram_user.close_failed",
    /** The Telegram session could not be signed out (already gone or offline). */
    LogOutFailed = "telegram_user.log_out_failed",
}
