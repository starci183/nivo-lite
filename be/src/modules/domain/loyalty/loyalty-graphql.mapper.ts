import type { RewardKind } from "@modules/domain/loyalty-rewards"
import type { MemberDetail } from "./loyalty.contracts"
import type { SaveProgramParams, SaveRewardParams, UpdateCustomerParams } from "./loyalty-setup.contracts"
import type {
    MemberDetailView,
    MemberSubmission,
    ProgramSubmission,
    RewardSubmission,
} from "./loyalty-graphql.contracts"

/** Preserves saved fields when a programme edit omitted them. */
export const toSaveLoyaltyProgramRequest = (input: ProgramSubmission, workspaceId: string): SaveProgramParams => ({
    workspaceId,
    ...(input.name == null ? {} : { name: input.name }),
    ...(input.enabled == null ? {} : { enabled: input.enabled }),
    ...(input.config == null
        ? {}
        : {
              config: {
                  ...input.config,
                  earn: { ...input.config.earn, trigger: input.config.earn.trigger === "order" ? "order" : "payment" },
              },
          }),
})

/** Chooses a supported reward kind and expresses omitted limits as unlimited. */
export const toSaveLoyaltyRewardRequest = (input: RewardSubmission, workspaceId: string): SaveRewardParams => ({
    workspaceId,
    ...(input.id == null ? {} : { id: input.id }),
    ...(input.key == null ? {} : { key: input.key }),
    name: input.name,
    kind: submittedRewardKind(input.kind),
    valueVnd: input.valueVnd,
    percent: input.percent ?? null,
    pointsCost: input.pointsCost,
    stock: input.stock ?? null,
    perCustomerLimit: input.perCustomerLimit ?? null,
    minTierKey: input.minTierKey ?? null,
    note: input.note,
    active: input.active,
})

/** Preserves omitted profile fields while retaining an explicit birthday clear. */
export const toUpdateLoyaltyMemberRequest = (input: MemberSubmission, workspaceId: string): UpdateCustomerParams => ({
    workspaceId,
    customerId: input.customerId,
    ...(input.name == null ? {} : { name: input.name }),
    ...(input.birthday === undefined ? {} : { birthday: input.birthday }),
    ...(input.note == null ? {} : { note: input.note }),
})

/** Represents redemption refusal parameters as named fields for the browser. */
export const toLoyaltyMemberType = (result: MemberDetail): MemberDetailView => ({
    ...result,
    rewards: result.rewards.map((option) => ({
        reward: option.reward,
        block:
            option.block === null
                ? null
                : {
                      code: option.block.code,
                      params: Object.entries(option.block.params).map(([key, value]) => ({
                          key,
                          value: String(value),
                      })),
                  },
    })),
})

/** Selects the supported catalogue kind for a submitted edit. */
const submittedRewardKind = (kind: string): RewardKind => {
    if (kind === "percent") return "percent"
    return kind === "item" ? "item" : "voucher"
}
