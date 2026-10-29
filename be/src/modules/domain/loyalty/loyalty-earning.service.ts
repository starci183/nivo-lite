import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { LoyaltyCustomersService } from "@modules/domain/loyalty-customers"
import { LoyaltyLedgerService, expiryDate, pointsFor } from "@modules/domain/loyalty-ledger"
import { LoyaltyProgramsService, tierFor, tierByKey, tierRank } from "@modules/domain/loyalty-programs"
import type { LoyaltyConfig } from "@modules/domain/loyalty-programs"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectMessageCatalog } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { LoyaltyError, LoyaltyErrorCode } from "./errors/loyalty.error"
import type { NotePart } from "./loyalty.contracts"
import { earnNoteParts } from "./policies/ledger-note.policy"

const STORED_LOCALE = "vi"

/** A sale to turn into points. */
export interface EarningParams {
    /** The workspace. */
    readonly workspaceId: string
    /** The normalised phone of the customer. */
    readonly phone: string
    /** The name of the customer, or empty. */
    readonly name: string
    /** The amount of the sale in VND. */
    readonly amountVnd: number
    /** The items sold. */
    readonly items: string
    /** The idempotency key: the same sale posted twice earns once. */
    readonly ref: string
    /** Who reports the sale. */
    readonly by: string
    /** When the sale happened, ISO 8601, or empty for now. */
    readonly occurredAt: string
}

/** What a sale came to. */
export interface EarningOutcome {
    /** The customer who earned. */
    readonly customerId: string
    /** `done` when points were written, `duplicate` when the sale was posted before, `no_points` when it earns none. */
    readonly status: "done" | "duplicate" | "no_points"
}

@Injectable()
/** Turns a sale into points on the ledger and lifts the customer to the tier their spend reaches. */
export class LoyaltyEarningService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectClock() private readonly clock: Clock,
        @InjectMessageCatalog() private readonly messages: MessageCatalog,
        private readonly customers: LoyaltyCustomersService,
        private readonly ledger: LoyaltyLedgerService,
        private readonly programs: LoyaltyProgramsService,
    ) {}

    /** Earns the points of a sale for the customer of a phone, creating the customer when the phone is new. */
    async earn(params: EarningParams): Promise<EarningOutcome> {
        const config = await this.programs.configOf(params.workspaceId)
        const nowIso = this.clock.now().toISOString()
        const whenMs = Date.parse(params.occurredAt === "" ? nowIso : params.occurredAt)
        const outcome = await this.entityManager.transaction(async (manager) => {
            const customerId = await this.customers.ensureByPhone(manager, {
                workspaceId: params.workspaceId,
                name:
                    params.name.trim() === ""
                        ? this.messages.get(
                              "loyalty.customer.defaultName",
                              { last4: params.phone.slice(-4) },
                              STORED_LOCALE,
                          )
                        : params.name.trim(),
                phone: params.phone,
                email: null,
                birthday: null,
            })
            if (customerId === null) throw new LoyaltyError({ code: LoyaltyErrorCode.CustomerNotCreated })
            const member = await this.ledger.member(params.workspaceId, customerId)
            const tier = tierByKey(config, member?.tierKey ?? null) ?? tierFor(config, member?.lifetimeSpendVnd ?? 0)
            const calc = pointsFor(config, { amountVnd: params.amountVnd, items: params.items }, tier)
            if (calc.points <= 0) return { customerId, status: "no_points" as const }
            const entry = await this.ledger.post({
                manager,
                workspaceId: params.workspaceId,
                customerId,
                kind: "earn",
                points: calc.points,
                ref: params.ref,
                by: params.by,
                amountVnd: Math.round(params.amountVnd),
                orderId: null,
                invoiceId: null,
                rewardId: null,
                evidence: earnNoteParts(calc)
                    .map((part: NotePart) => this.messages.get(part.key, part.params, STORED_LOCALE))
                    .join(", "),
                expiresAt: expiryDate(config, whenMs),
                occurredAt: new Date(whenMs).toISOString(),
            })
            return { customerId, status: entry === null ? ("duplicate" as const) : ("done" as const) }
        })
        if (outcome.status === "done") await this.liftTier(params.workspaceId, outcome.customerId, config, nowIso)
        return outcome
    }

    private async liftTier(
        workspaceId: string,
        customerId: string,
        config: LoyaltyConfig,
        nowIso: string,
    ): Promise<void> {
        const member = await this.ledger.member(workspaceId, customerId)
        const earned = member === null ? null : tierFor(config, member.lifetimeSpendVnd)
        if (member === null || earned === null) return
        if (member.tierKey !== null && tierRank(config, member.tierKey) >= tierRank(config, earned.key)) return
        await this.entityManager.transaction(async (manager) => {
            await this.customers.moveTier({
                manager,
                workspaceId,
                customerId,
                toKey: earned.key,
                fromKey: member.tierKey,
                nowIso,
            })
        })
    }
}
