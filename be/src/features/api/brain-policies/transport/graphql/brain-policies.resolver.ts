import type { CommandBus, QueryBus } from "@nestjs/cqrs"
import { Args, Mutation, Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus, InjectQueryBus, type Principal } from "@modules/platform/cqrs"
import { DeriveBrainPoliciesCommand } from "../../application/derive-brain-policies.command"
import { GetBrainPoliciesQuery } from "../../application/get-brain-policies.query"
import { GetBrainPolicyQuery } from "../../application/get-brain-policy.query"
import { SetBrainPolicyCommand, UnsetBrainPolicyCommand } from "../../application/set-brain-policy.command"
import {
    BrainPoliciesType,
    BrainPolicyDetailType,
    SetBrainPolicyResultType,
    UnsetBrainPolicyResultType,
} from "./dto/brain-policies.type"
import { DeriveBrainPoliciesResultType } from "./dto/brain-policy-derivation.type"
import { BrainPolicyInput, SetBrainPolicyInput, UnsetBrainPolicyInput } from "./dto/brain-policy.input"
import {
    toSetBrainPolicyResultType,
    toSetPolicyRequest,
    toUnsetBrainPolicyResultType,
    toUnsetPolicyRequest,
} from "./brain-policies.mapper"

@Resolver()
/** GraphQL door of the Policies tab of the Second Brain. Owner and manager read; only the owner's edits apply. */
export class BrainPoliciesResolver {
    constructor(
        @InjectQueryBus() private readonly queryBus: QueryBus,
        @InjectCommandBus() private readonly commandBus: CommandBus,
    ) {}

    /** The tab: the shop's rules in the truth graph as parameters, grouped by subject, with the waiting count for the chip. */
    @Query(() => BrainPoliciesType, { name: "brainPolicies" })
    brainPolicies(@CurrentPrincipal() principal: Principal, @WorkspaceId() workspaceId: string): Promise<BrainPoliciesType> {
        return this.queryBus.execute(new GetBrainPoliciesQuery({ request: { workspaceId }, principal }))
    }

    /** The drawer of one row: its value, the waiting proposals ("Use" / "Drop" call `decideBrainFact`) and the history. */
    @Query(() => BrainPolicyDetailType, { name: "brainPolicy", nullable: true })
    brainPolicy(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: BrainPolicyInput,
    ): Promise<BrainPolicyDetailType | null> {
        return this.queryBus.execute(new GetBrainPolicyQuery({ request: { workspaceId, factId: input.factId }, principal }))
    }

    /** Sets a policy: the next version of its fact (the owner; now or from a date) or a proposal (a manager). */
    @Mutation(() => SetBrainPolicyResultType, { name: "setBrainPolicy" })
    async setBrainPolicy(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: SetBrainPolicyInput,
    ): Promise<SetBrainPolicyResultType> {
        const result = await this.commandBus.execute(
            new SetBrainPolicyCommand({ request: toSetPolicyRequest(workspaceId, input), principal }),
        )
        return toSetBrainPolicyResultType(result)
    }

    /** Takes a policy out of force (the owner) or asks the owner to (a manager). */
    @Mutation(() => UnsetBrainPolicyResultType, { name: "unsetBrainPolicy" })
    async unsetBrainPolicy(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: UnsetBrainPolicyInput,
    ): Promise<UnsetBrainPolicyResultType> {
        const result = await this.commandBus.execute(
            new UnsetBrainPolicyCommand({ request: toUnsetPolicyRequest(workspaceId, input), principal }),
        )
        return toUnsetBrainPolicyResultType(result)
    }

    /**
     * Asks for a derive pass of the workspace's policies (owner or manager): the backfill of a workspace that has none yet, or a retry
     * after a failed pass. It only queues the pass; `brainPolicies.derivation` says where it stands.
     */
    @Mutation(() => DeriveBrainPoliciesResultType, { name: "deriveBrainPolicies" })
    async deriveBrainPolicies(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
    ): Promise<DeriveBrainPoliciesResultType> {
        const outcome = await this.commandBus.execute(new DeriveBrainPoliciesCommand({ request: { workspaceId }, principal }))
        return { outcome }
    }
}
