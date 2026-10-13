import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { DomainError } from "@modules/platform/errors"
import { LoyaltyMembersService } from "./loyalty-members.service"
import { LoyaltyPromotionsService } from "./loyalty-promotions.service"
import { LoyaltyPublicService } from "./loyalty-public.service"
import type { LoyaltyCommandRef } from "./loyalty.contracts"
import { FINISH_COMMAND, SELECT_COMMAND } from "./persistence/loyalty-commands.sql"
import type { CommandRow } from "./persistence/loyalty-commands.rows"
import { commandOf } from "./policies/command-params.policy"
import type { LoyaltyCommand } from "./policies/command-params.policy"

/** The code a command settles with when its parameters are not usable. */
const INVALID = "LOYALTY_COMMAND_INVALID"

/** What running a command came to. */
export type LoyaltyCommandOutcome = "done" | "failed" | "skipped"

@Injectable()
/**
 * Runs the loyalty commands the web app queued (see the loyalty_commands table): an owner's correction, redemption, sync, segment preview or promotion
 * draft, and the two steps of the public points check. Each one calls the service that already does the work, as the person who asked, and writes the
 * answer on the row; a refusal of the domain is an answer too (the row fails with the code), anything else is thrown so the queue tries again.
 * Points move on a ledger key made from the command id, so a command run twice posts once.
 */
export class LoyaltyCommandsService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly members: LoyaltyMembersService,
        private readonly promotions: LoyaltyPromotionsService,
        private readonly publicCheck: LoyaltyPublicService,
    ) {}

    /** Runs the command a queue message names; a command that is gone, settled or of another workspace is left alone. */
    async run(ref: LoyaltyCommandRef): Promise<LoyaltyCommandOutcome> {
        const [row] = await this.entityManager.query<Array<CommandRow>>(SELECT_COMMAND, [ref.commandId])
        if (row === undefined || row.status !== "queued" || row.workspace_id !== ref.workspaceId) return "skipped"
        const command = commandOf(row.kind, row.params)
        const isPublic = command?.kind === "request_code" || command?.kind === "verify_code"
        if (command === null || (!isPublic && row.created_by === null)) {
            await this.settle(row, "failed", null, INVALID)
            return "failed"
        }
        try {
            const result = await this.dispatch(row, command, row.created_by ?? "")
            await this.settle(row, "done", result, null)
            return "done"
        } catch (cause) {
            if (!(cause instanceof DomainError)) throw cause
            await this.settle(row, "failed", { params: cause.params }, String(cause.code))
            return "failed"
        }
    }

    private async dispatch(row: CommandRow, command: LoyaltyCommand, userId: string): Promise<object> {
        const workspaceId = row.workspace_id
        if (command.kind === "request_code") return this.publicCheck.requestCode({ slug: command.slug, phone: command.phone })
        if (command.kind === "verify_code") {
            return this.publicCheck.verifyCode({ slug: command.slug, phone: command.phone, typed: command.typed })
        }
        if (command.kind === "adjust") {
            return this.members.adjust(userId, {
                workspaceId,
                customerId: command.customerId,
                points: command.points,
                reason: command.reason,
                token: row.id,
            })
        }
        if (command.kind === "redeem") {
            return this.members.redeem(userId, {
                workspaceId,
                customerId: command.customerId,
                rewardId: command.rewardId,
                token: row.id,
            })
        }
        if (command.kind === "sync") return this.members.sync(userId, { workspaceId })
        if (command.kind === "preview") return this.promotions.preview(userId, { workspaceId, segment: command.segment })
        return this.promotions.draft(userId, {
            workspaceId,
            segment: command.segment,
            name: command.name,
            brief: command.brief,
        })
    }

    private async settle(row: CommandRow, status: "done" | "failed", result: object | null, errorCode: string | null): Promise<void> {
        await this.entityManager.query(FINISH_COMMAND, [
            row.id,
            status,
            result === null ? null : JSON.stringify(result),
            errorCode,
            row.created_by === null,
        ])
    }
}
