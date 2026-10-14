/** The result of checking the primary database. */
export interface ReadinessDatabaseChecks<TStatus extends "ok" | "down"> {
    /** Whether the primary database answered the probe. */
    readonly database: TStatus
}

/** Whether this instance can receive work that requires its primary database. */
export type ReadinessReport =
    | {
          /** Every required dependency answered within the probe deadline. */
          readonly status: "ok"
          /** The primary database answered a read-only query. */
          readonly checks: ReadinessDatabaseChecks<"ok">
      }
    | {
          /** A required dependency failed or exceeded the probe deadline. */
          readonly status: "unready"
          /** The primary database is unavailable to this instance. */
          readonly checks: ReadinessDatabaseChecks<"down">
      }
