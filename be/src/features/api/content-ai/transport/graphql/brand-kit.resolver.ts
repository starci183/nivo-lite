import type { CommandBus, QueryBus } from "@nestjs/cqrs"
import { Args, Mutation, Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus, InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { AcceptedLocale } from "@modules/platform/i18n"
import type { Locale } from "@modules/platform/i18n"
import { DecideBrandProposalCommand } from "../../application/decide-brand-proposal.command"
import { ListBrandProposalsQuery } from "../../application/list-brand-proposals.query"
import { ProposeBrandKitCommand } from "../../application/propose-brand-kit.command"
import { BrandProposalsInput, DecideBrandProposalInput, ProposeBrandKitInput } from "./dto/brand-kit.input"
import { BrandProposalType } from "./dto/brand-kit.type"

@Resolver()
/** GraphQL doors of the AI Marketing brand kit: read a guideline PDF, list and decide the proposals. */
export class BrandKitResolver {
    constructor(
        @InjectCommandBus() private readonly commandBus: CommandBus,
        @InjectQueryBus() private readonly queryBus: QueryBus,
    ) {}

    /** Reads an attached guideline PDF into a brand proposal (and its lines in the setup chat). */
    @Mutation(() => BrandProposalType, { name: "proposeBrandKit" })
    async proposeBrandKit(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @AcceptedLocale() locale: Locale,
        @Args("input") input: ProposeBrandKitInput,
    ): Promise<BrandProposalType> {
        return this.commandBus.execute(
            new ProposeBrandKitCommand({
                request: {
                    workspaceId,
                    installationId: input.installationId,
                    setupSessionId: input.setupSessionId,
                    file: input.file,
                    locale,
                },
                principal,
            }),
        )
    }

    /** The brand proposals of an agent instance, newest first. */
    @Query(() => [BrandProposalType], { name: "brandProposals" })
    async brandProposals(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: BrandProposalsInput,
    ): Promise<ReadonlyArray<BrandProposalType>> {
        return this.queryBus.execute(
            new ListBrandProposalsQuery({ request: { workspaceId, installationId: input.installationId }, principal }),
        )
    }

    /** Confirms (with edits) or rejects a brand proposal. */
    @Mutation(() => BrandProposalType, { name: "decideBrandProposal" })
    async decideBrandProposal(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: DecideBrandProposalInput,
    ): Promise<BrandProposalType> {
        return this.commandBus.execute(
            new DecideBrandProposalCommand({
                request: {
                    workspaceId,
                    proposalId: input.proposalId,
                    decision: { decision: input.decision, kit: input.kit },
                },
                principal,
            }),
        )
    }
}
