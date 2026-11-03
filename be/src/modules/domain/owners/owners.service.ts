import { randomBytes } from "node:crypto"
import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { IdentityError, IdentityErrorCode } from "@modules/domain/identity"
import { isAcceptablePassword, normalizeEmail } from "@modules/integrations/passport"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { callDbFunction, InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectIds } from "@modules/platform/ids"
import type { Ids } from "@modules/platform/ids"
import { OwnersError, OwnersErrorCode } from "./errors/owners.error"
import { InjectOwnersOptions } from "./owners.decorators"
import type { OwnersOptions } from "./owners.options"

/** The bcrypt cost of the password hash the database writes. */
const BCRYPT_COST = 10

/** The bytes of the password an account made without one is given: nobody is told it. */
const UNKNOWN_PASSWORD_BYTES = 24

/** The account that has a sign-in address. */
interface AccountRow {
    /** The account id. */
    readonly id: string
}

@Injectable()
/** Bootstraps the first account of a clean database: confirmed, with a password, no email round trip. */
export class OwnersService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectClock() private readonly clock: Clock,
        @InjectIds() private readonly ids: Ids,
        @InjectOwnersOptions() private readonly options: OwnersOptions,
    ) {}

    /** Creates the account, or sets the password of the one that already has the address (running it twice is safe). */
    async createOwner(email: string, password: string): Promise<void> {
        if (!isAcceptablePassword(password)) throw new IdentityError({ code: IdentityErrorCode.PasswordInvalid })
        const address = normalizeEmail(email)
        const now = this.clock.now()
        const [existing] = await callDbFunction<AccountRow>(this.entityManager, "public.be_auth_user_by_email", [
            address,
        ])
        const hash = await this.hashPassword(password)
        if (existing === undefined) {
            await callDbFunction(this.entityManager, "public.be_auth_create_user", [
                this.ids.next(),
                address,
                hash,
                true,
                "{}",
                now,
            ])
            this.options.print("owner created")
            return
        }
        await callDbFunction(this.entityManager, "public.be_auth_set_password", [existing.id, hash, now])
        this.options.print("owner password updated")
    }

    /**
     * The id of the account that has the address. A missing one is made confirmed, with a password nobody knows, so the person it
     * belongs to opens it by resetting the password or by `create-owner run`; an existing one is left as it is.
     */
    async ensureAccount(email: string): Promise<string> {
        const address = normalizeEmail(email)
        const [existing] = await callDbFunction<AccountRow>(this.entityManager, "public.be_auth_user_by_email", [
            address,
        ])
        if (existing !== undefined) return existing.id
        const id = this.ids.next()
        const hash = await this.hashPassword(randomBytes(UNKNOWN_PASSWORD_BYTES).toString("base64url"))
        await callDbFunction(this.entityManager, "public.be_auth_create_user", [
            id,
            address,
            hash,
            true,
            "{}",
            this.clock.now(),
        ])
        this.options.print("owner account created")
        return id
    }

    /** The bcrypt hash of a password, computed by the database so it matches the hashes the sign-in verifies. */
    private async hashPassword(password: string): Promise<string> {
        const [salt] = await callDbFunction<{ gen_salt: string }>(this.entityManager, "extensions.gen_salt", [
            "bf",
            BCRYPT_COST,
        ])
        const [hashed] = await callDbFunction<{ crypt: string }>(this.entityManager, "extensions.crypt", [
            password,
            salt?.gen_salt,
        ])
        if (hashed === undefined) throw new OwnersError({ code: OwnersErrorCode.PasswordNotHashed })
        return hashed.crypt
    }
}
