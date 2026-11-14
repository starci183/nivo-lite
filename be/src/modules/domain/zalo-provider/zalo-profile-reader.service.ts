import { Injectable } from "@nestjs/common"
import type { ChannelProfilePort, OptionalChannelProfile } from "@modules/domain/provider-registry"
import { InjectZalo, type ZaloClient } from "@modules/integrations/zalo"
import { InjectZaloAccessTokens, type ZaloAccessTokens } from "./zalo-access-tokens.port"

@Injectable()
/**
 * The Zalo OA's profile read (its API operation, Open API `GET /v3.0/oa/user/detail`): what Zalo says of one customer of the OA, the
 * display name and the picture link. A message event carries neither, so the provider-neutral profile tool reaches this through the
 * provider registry. It keeps nothing and writes nothing: a connection with no token, or any refusal of Zalo, answers null.
 */
export class ZaloProfileReaderService implements ChannelProfilePort {
    readonly provider = "zalo_oa"

    constructor(
        @InjectZalo() private readonly zalo: ZaloClient,
        @InjectZaloAccessTokens() private readonly tokens: ZaloAccessTokens,
    ) {}

    /** The customer's name and picture as Zalo gives them; null when the connection cannot read yet or Zalo refused. */
    async profileOf(connectionId: string, personId: string): Promise<OptionalChannelProfile> {
        try {
            const access = await this.tokens.tokenOf(connectionId)
            if (access.kind !== "token") return null
            const profile = await this.zalo.userProfile(access.token, personId)
            return { name: profile.name, picture: profile.avatarUrl }
        } catch {
            return null
        }
    }
}
