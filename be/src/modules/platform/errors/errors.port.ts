import type { ErrorReportContext } from "./errors.contracts"

/**
 * Where an unexpected failure is recorded for the team console (/admin/health, the `app_errors` table). The app root binds it; a
 * report never throws, so it is safe in any failure path, and every stored value is scrubbed of credentials first.
 */
export interface ErrorReporter {
    /** Records one failure under a scope (`graphql`, `http`, `job.<queue>`); the workspace comes from the context when it is known. */
    report(scope: string, error: unknown, context?: ErrorReportContext): Promise<void>
}
