import type { ConnectionRecord, ConnectionsService } from "@modules/domain/connections"
import type { NativeCaller } from "@modules/domain/tools"
import { socialRefusal } from "./social-refusal.policy"

/** A registry that hands the port of a provider, when one serves it. */
interface PortRegistry<Port> {
    /** The port that serves the account (its sandbox one for a sandbox account, lane concept provider-sandbox), or undefined. */
    portFor(account: ConnectionRecord): Port | undefined
}

/**
 * The account the tool runner handed the call and its provider's port for the destination: no account handed, an account of another
 * workspace, or a provider that serves no such destination is `not_connected`. Never a silent pick of another account.
 */
export const socialAccountOf = async <Port extends { readonly provider: string }>(
    connections: ConnectionsService,
    registry: PortRegistry<Port>,
    workspaceId: string,
    caller: NativeCaller,
): Promise<{ readonly connection: ConnectionRecord; readonly port: Port }> => {
    if (caller.connectionId === undefined) throw socialRefusal("not_connected")
    const connection = await connections.find(workspaceId, caller.connectionId)
    const port = connection === null ? undefined : registry.portFor(connection)
    if (connection === null || port === undefined) throw socialRefusal("not_connected")
    return { connection, port }
}
