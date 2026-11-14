import { DataSourcesError, DataSourcesErrorCode } from "@modules/integrations/data-sources"
import { invalid } from "./database-config.policy"
import { DATABASE_SANDBOX_LOGIN_REFUSAL, DATABASE_SANDBOX_UNREACHABLE } from "./database-sandbox.catalogue"

/**
 * The failure the live pull throws when NO table could be read: the plain refusal `invalid` carrying the first table's reason
 * (`<schema>.<table>: <reason>`), the SAME helper the live sync calls. The sandbox service builds no error itself: it reaches no
 * integration.
 */
export const databaseNoTableRead = (firstProblem: string): Error => invalid(firstProblem)

/** The database's engine refused the user and password: the SAME `DataSourcesError` (`Rejected`, the engine's words as detail) the live reader throws on opening. */
export const databaseLoginRefused = (): Error =>
    new DataSourcesError({ code: DataSourcesErrorCode.Rejected, params: { detail: DATABASE_SANDBOX_LOGIN_REFUSAL } })

/** The database could not be reached in time: the SAME `DataSourcesError` (`Unavailable`) the live reader throws. */
export const databaseUnreachable = (): Error =>
    new DataSourcesError({ code: DataSourcesErrorCode.Unavailable, params: { detail: DATABASE_SANDBOX_UNREACHABLE } })
