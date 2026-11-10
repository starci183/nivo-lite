import { Injectable } from "@nestjs/common"
import { WorkspacesService } from "@modules/domain/workspaces"
import type { WorkspaceMembership } from "@modules/domain/workspaces"
import { eachInOrder } from "@modules/platform/primitives"
import { BillingService } from "./billing.service"
import type { LobbyMembership, Plan } from "./billing.contracts"

/** The lobby facts of one membership with the plan it is on: the plan's names, and the seats it may fill. */
const toLobbyMembership = (entry: WorkspaceMembership, plan: Plan | undefined): LobbyMembership => {
    const { seatCount, ...facts } = entry.lobby
    return {
        workspace: entry.workspace,
        member: entry.member,
        lobby: {
            ...facts,
            planNameVi: plan?.nameVi ?? null,
            planNameEn: plan?.nameEn ?? null,
            seatLimit: seatCount ?? plan?.seats ?? null,
        },
    }
}

@Injectable()
/** The workspaces lobby read: every workspace of the person with their seat, its people, and the plan it is on (named here, by billing). */
export class LobbyMembershipsService {
    constructor(
        private readonly workspaces: WorkspacesService,
        private readonly billing: BillingService,
    ) {}

    /** Every living workspace the person belongs to with the lobby facts of each; each plan is read once. */
    async memberships(userId: string): Promise<ReadonlyArray<LobbyMembership>> {
        const memberships = await this.workspaces.memberships(userId)
        const codes = new Set(
            memberships.flatMap((entry) => (entry.lobby.planCode === null ? [] : [entry.lobby.planCode])),
        )
        const plans = new Map<string, Plan>()
        await eachInOrder(codes, async (code) => {
            const plan = await this.billing.findPlan(code)
            if (plan !== null) plans.set(code, plan)
        })
        return memberships.map((entry) =>
            toLobbyMembership(entry, entry.lobby.planCode === null ? undefined : plans.get(entry.lobby.planCode)),
        )
    }
}
