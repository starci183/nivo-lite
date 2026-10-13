import { randomInt } from "node:crypto"
import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { LoyaltyOtpsError, LoyaltyOtpsErrorCode } from "./errors/loyalty-otps.error"
import { InjectOtpPepper } from "./loyalty-otps.decorators"
import type { CodeCheck, IssuedCode } from "./loyalty-otps.contracts"
import {
    BUMP_ATTEMPTS,
    COUNT_CUSTOMER_CODES,
    COUNT_WORKSPACE_CODES,
    DELETE_CODE,
    INSERT_CODE,
    MARK_USED,
    SELECT_OPEN_CODE,
} from "./persistence/loyalty-otps.sql"
import { OTP_MAX_ATTEMPTS, codeHash, codeText, sameHash } from "./policies/otp.policy"

const CODE_SPACE = 1_000_000

@Injectable()
/** The one-time codes of the public points check: stored hashed, five tries each, and sent to the customer's own chat only. */
export class LoyaltyOtpsService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectClock() private readonly clock: Clock,
        @InjectOtpPepper() private readonly pepper: string,
    ) {}

    /** How many codes a workspace issued since an instant. */
    async workspaceCodesSince(workspaceId: string, sinceIso: string): Promise<number> {
        const rows = await this.entityManager.query<Array<{ total: number }>>(COUNT_WORKSPACE_CODES, [
            workspaceId,
            sinceIso,
        ])
        return rows.reduce((sum, row) => sum + row.total, 0)
    }

    /** How many codes a customer was issued since an instant. */
    async customerCodesSince(customerId: string, sinceIso: string): Promise<number> {
        const rows = await this.entityManager.query<Array<{ total: number }>>(COUNT_CUSTOMER_CODES, [
            customerId,
            sinceIso,
        ])
        return rows.reduce((sum, row) => sum + row.total, 0)
    }

    /** Draws a code, stores its hash and answers the plain code. */
    async issue(workspaceId: string, customerId: string, expiresIso: string): Promise<IssuedCode> {
        const code = codeText(randomInt(0, CODE_SPACE))
        const [row] = await this.entityManager.query<Array<{ id: string }>>(INSERT_CODE, [
            workspaceId,
            customerId,
            codeHash(this.pepper, customerId, code),
            expiresIso,
        ])
        if (row === undefined) throw new LoyaltyOtpsError({ code: LoyaltyOtpsErrorCode.NotIssued })
        return { id: row.id, code }
    }

    /** Drops a code that could not be delivered, so a code nobody received cannot be guessed at. */
    async discard(codeId: string): Promise<void> {
        await this.entityManager.query(DELETE_CODE, [codeId])
    }

    /** Checks the code a customer typed against the newest open one; a right code is used up and a wrong one counts a try. */
    async check(customerId: string, code: string): Promise<CodeCheck> {
        const nowIso = this.clock.now().toISOString()
        const [open] = await this.entityManager.query<Array<{ id: string; code_hash: string; attempts: number }>>(
            SELECT_OPEN_CODE,
            [customerId, nowIso],
        )
        if (open === undefined || open.attempts >= OTP_MAX_ATTEMPTS) return "rejected"
        if (!sameHash(open.code_hash, codeHash(this.pepper, customerId, code))) {
            await this.entityManager.query(BUMP_ATTEMPTS, [open.id])
            return "rejected"
        }
        await this.entityManager.query(MARK_USED, [open.id, nowIso])
        return "accepted"
    }
}
