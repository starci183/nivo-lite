import type { QueryBus } from "@nestjs/cqrs"
import { Args, Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus, type Principal } from "@modules/platform/cqrs"
import { GetBrainCritiqueQuery } from "../../application/get-brain-critique.query"
import { ListBrainCritiquesQuery } from "../../application/list-brain-critiques.query"
import { BrainCritiqueInput } from "./dto/brain-critique.input"
import { BrainCritiqueSourceType, BrainCritiqueType } from "./dto/brain-critique.type"

@Resolver()
/** GraphQL doors of the document critique reads. */
export class BrainCritiqueResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** The critique of one shop document: its review state, what customers may read, and its points. */
    @Query(() => BrainCritiqueType, { name: "brainCritique" })
    brainCritique(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: BrainCritiqueInput,
    ): Promise<BrainCritiqueType> {
        return this.queryBus.execute(
            new GetBrainCritiqueQuery({ request: { workspaceId, sourceId: input.sourceId, states: input.states }, principal }),
        )
    }

    /** The critiqued documents with their open and open-high counts. */
    @Query(() => [BrainCritiqueSourceType], { name: "brainCritiqueSources" })
    brainCritiqueSources(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
    ): Promise<ReadonlyArray<BrainCritiqueSourceType>> {
        return this.queryBus.execute(new ListBrainCritiquesQuery({ request: { workspaceId }, principal }))
    }
}
