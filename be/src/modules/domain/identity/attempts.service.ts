import { Injectable } from "@nestjs/common"
import { InjectRateLimitStore } from "@modules/platform/database"
import type { RateLimitStore } from "@modules/platform/database"
import { IdentityError, IdentityErrorCode } from "./errors/identity.error"
import type { AttemptKind } from "./identity-auth.contracts"
import { InjectIdentityAuthOptions } from "./identity-auth.decorators"
import type { IdentityAuthOptions } from "./identity-auth.options"
import { digestOf } from "./password.policy"

@Injectable()
/** Counts sign-in, reset and signup attempts per address in a window every replica shares, and refuses an address over its limit. */
export class IdentityAttemptsService {
    constructor(
        @InjectRateLimitStore() private readonly limits: RateLimitStore,
        @InjectIdentityAuthOptions() private readonly options: IdentityAuthOptions,
    ) {}

    /** Counts one attempt of this kind for an address (hashed in the counter key); throws when the address is over its limit. */
    async admit(kind: AttemptKind, address: string): Promise<void> {
        const limit = kind === "login" ? this.options.loginAttempts : this.options.resetAttempts
        const allowed = await this.limits.consume(`${kind}:${digestOf(address)}`, this.options.attemptWindowMs, limit)
        if (!allowed) throw new IdentityError({ code: IdentityErrorCode.TooManyAttempts })
    }
}
