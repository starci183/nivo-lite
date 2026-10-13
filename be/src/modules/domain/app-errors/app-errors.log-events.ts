/** Log events of the app-errors capability. */
export enum AppErrorsLogEvent {
    /** A failure could not be written to `app_errors`; the report is dropped and the failing path goes on. */
    ReportFailed = "app_errors.report_failed",
}
