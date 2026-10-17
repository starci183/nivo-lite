/** Log events of the process lifecycle: the entry points (main.ts of each app) log these. */
export enum LoggingLogEvent {
    /** The HTTP listener is bound and the service answers requests. */
    ServerStarted = "server.started",
    /** The service failed before it could serve; the process exits non-zero. */
    StartupFailed = "server.startup_failed",
    /** A cli command threw or commander rejected the command line; the process exits non-zero. */
    CommandFailed = "cli.command_failed",
    /** The seed command finished; the seed files it ran ride in the fields, by connection. */
    SeedsApplied = "seeds.applied",
}
