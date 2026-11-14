import type { PollFailure } from "@modules/domain/connection-poll"
import { injector, type TypedParameterDecorator } from "@modules/platform/composition"

/** The OA's access token now, or why the connection has none to read with: no usable credential yet, or no token yet. */
export type ZaloAccessToken =
    | { readonly kind: "token"; readonly token: string }
    | { readonly kind: "skipped"; readonly reason: "not_ready" | "no_token" }

/**
 * The access token of a Zalo OA connection, as the provider's poll reads with it (the provider's own credential: providers concept, the
 * account is the one place its credentials are read). The app binds it to the connection's credential keeper (the token refresh with its
 * single-use refresh token lives there), so this provider names no other capability.
 */
export interface ZaloAccessTokens {
    /** The token of the connection, refreshed when it is due. */
    tokenOf(connectionId: string): Promise<ZaloAccessToken>
    /** How a failure of the credential side reads for the poll scheduler; null when the error is not one of the credential's. */
    failureOf(error: unknown): PollFailure | null
}

/** Token of the port the app binds. */
export const ZALO_ACCESS_TOKENS: unique symbol = Symbol("domain.zalo-provider.access-tokens")

/** Injects the access tokens of the Zalo connections. Parameter type: ZaloAccessTokens. */
export const InjectZaloAccessTokens = (): TypedParameterDecorator<ZaloAccessTokens> =>
    injector<ZaloAccessTokens>(ZALO_ACCESS_TOKENS)
