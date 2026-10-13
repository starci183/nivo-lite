/**
 * Client-safe rules of agent access to connections, kept at this path for the lanes that still import them (agent bindings, agent
 * dashboard, channels, engine, the settings page and the agent connections card). The rules live in `hooks/connection-access`; the
 * server enforces the same table in `be/src/modules/domain/connection-grants`. Wave 3 deletes this file.
 */
export { ACCESS_LEVELS, isAccess, purposeFor } from "@/hooks/connection-access"
export type { Access, Purpose } from "@/modules/types"
import { isDataConnector } from "@/hooks/connection-access"

/** True for the providers every agent may read from (data connectors), whatever its module. */
export const isDataProvider = (provider: string): boolean => isDataConnector(provider)
