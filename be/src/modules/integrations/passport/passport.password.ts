import { Injectable } from "@nestjs/common"
import bcrypt from "bcryptjs"
import { InjectPasswordsOptions } from "./passport.decorators"
import type { PasswordsOptions } from "./passport.options"

/** A valid bcrypt hash nobody can match, compared when no account exists so a missing account costs the same time as a wrong password. */
const DECOY_HASH = "$2b$10$6RdlN0g82RrrsKDj5Hb7pu4B48ZqLbJd7F245q9CktC/LrHJyag9."

@Injectable()
/** The one owner of bcrypt: hashes new passwords and verifies hashes, including any written by another bcrypt implementation. */
export class PassportPasswordsClient {
    constructor(@InjectPasswordsOptions() private readonly options: PasswordsOptions) {}

    /** A bcrypt hash of a new password. */
    hash(plain: string): Promise<string> {
        return bcrypt.hash(plain, this.options.bcryptCost)
    }

    /** True when the password matches the stored hash (constant time); an empty stored hash is compared against a decoy and never matches. */
    async verify(plain: string, stored: string): Promise<boolean> {
        if (stored === "") {
            await bcrypt.compare(plain, DECOY_HASH)
            return false
        }
        return bcrypt.compare(plain, stored)
    }
}
