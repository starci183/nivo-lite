import { randomInt } from "node:crypto"
import { Injectable } from "@nestjs/common"
import { IsNull, MoreThan, MoreThanOrEqual } from "typeorm"
import type { EntityManager } from "typeorm"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import type { Secret } from "@modules/platform/config"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { LoyaltyOtpsError, LoyaltyOtpsErrorCode } from "./errors/loyalty-otps.error"
import { InjectOtpPepper } from "./loyalty-otps.decorators"
import type { CodeCheck, IssuedCode } from "./loyalty-otps.contracts"
import { LoyaltyOtpEntity } from "./persistence/entities"
import { OTP_MAX_ATTEMPTS, codeHash, codeText, sameHash } from "./policies/otp.policy"

const CODE_SPACE = 1_000_000

@Injectable()
/** The one-time codes of the public points check: stored hashed, five tries each, and sent to the customer's own chat only. */
export class LoyaltyOtpsService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectClock() private readonly clock: Clock,
        @InjectOtpPepper() private readonly pepper: Secret,
    ) {}

    /** How many codes a workspace issued since an instant. */
    workspaceCodesSince(workspaceId: string, sinceIso: string): Promise<number> {
        return this.entityManager.count(LoyaltyOtpEntity, {
            where: { workspaceId, createdAt: MoreThanOrEqual(new Date(sinceIso)) },
        })
    }

    /** How many codes a customer was issued since an instant. */
    customerCodesSince(customerId: string, sinceIso: string): Promise<number> {
        return this.entityManager.count(LoyaltyOtpEntity, {
            where: { customerId, createdAt: MoreThanOrEqual(new Date(sinceIso)) },
        })
    }

    /** Draws a code, stores its hash and answers the plain code. */
    async issue(workspaceId: string, customerId: string, expiresIso: string): Promise<IssuedCode> {
        const code = codeText(randomInt(0, CODE_SPACE))
        const result = await this.entityManager.insert(LoyaltyOtpEntity, {
            workspaceId,
            customerId,
            codeHash: this.hashCode(customerId, code),
            expiresAt: new Date(expiresIso),
        })
        const [identifier] = result.identifiers
        const id: unknown = identifier?.id
        if (typeof id !== "string") throw new LoyaltyOtpsError({ code: LoyaltyOtpsErrorCode.NotIssued })
        return { id, code }
    }

    /** Drops a code that could not be delivered, so a code nobody received cannot be guessed at. */
    async discard(codeId: string): Promise<void> {
        await this.entityManager.delete(LoyaltyOtpEntity, { id: codeId })
    }

    /** Checks the code a customer typed against the newest open one; a right code is used up and a wrong one counts a try. */
    async check(customerId: string, code: string): Promise<CodeCheck> {
        const nowIso = this.clock.now().toISOString()
        const open = await this.entityManager.findOne(LoyaltyOtpEntity, {
            select: { id: true, codeHash: true, attempts: true },
            where: { customerId, usedAt: IsNull(), expiresAt: MoreThan(new Date(nowIso)) },
            order: { createdAt: "DESC" },
        })
        if (open === null || open.attempts >= OTP_MAX_ATTEMPTS) return "rejected"
        if (!sameHash(open.codeHash, this.hashCode(customerId, code))) {
            await this.entityManager.increment(LoyaltyOtpEntity, { id: open.id }, "attempts", 1)
            return "rejected"
        }
        await this.entityManager.update(LoyaltyOtpEntity, { id: open.id }, { usedAt: new Date(nowIso) })
        return "accepted"
    }

    private hashCode(customerId: string, code: string): string {
        return codeHash(this.pepper.reveal(), customerId, code)
    }
}
