import { Injectable } from "@nestjs/common"
import type { ConnectionRecord } from "@modules/domain/connections"
import type { ChannelProfilePort, OptionalChannelProfile } from "@modules/domain/provider-registry"
import { ProviderSandboxService } from "@modules/domain/provider-sandbox"
import { ZALO_PROFILE_NONE_CASE, ZALO_PROFILE_OPERATION, zaloSandboxProfileOf } from "./zalo-sandbox.catalogue"

@Injectable()
/**
 * The sandbox twin of the Zalo profile read: the catalogue's customers (`ZALO-4`, the default) answer their name and picture, any other person
 * answers null, never a failure, as the live read does; the account's next case `ZALO-5` makes the read answer null for everyone. It never calls Zalo and needs no access token.
 *
 * The port hands the read only the connection's ID, not the account (its workspace and sandbox flag), which the call log needs, so
 * `profileOf` answers from the catalogue WITHOUT a logged call: the registry only reaches it for a sandbox account (`portFor`). Once the
 * port passes the connection, `profileOfAccount` is the logged form it moves to.
 */
export class ZaloSandboxProfileService implements ChannelProfilePort {
    readonly provider = "zalo_oa"

    constructor(private readonly sandbox: ProviderSandboxService) {}

    /** The catalogue's profile of the person; null for one it does not know. */
    profileOf(_connectionId: string, personId: string): Promise<OptionalChannelProfile> {
        return Promise.resolve(zaloSandboxProfileOf(personId))
    }

    /** The same answer as one logged call of a sandbox account (a live account, or the sandbox off, is refused). */
    profileOfAccount(connection: ConnectionRecord, personId: string): Promise<OptionalChannelProfile> {
        return this.sandbox.call(connection, ZALO_PROFILE_OPERATION, { personId }, {
            key: personId,
            answer: (state) => (state.nextCase === ZALO_PROFILE_NONE_CASE ? null : zaloSandboxProfileOf(personId)),
        })
    }
}
