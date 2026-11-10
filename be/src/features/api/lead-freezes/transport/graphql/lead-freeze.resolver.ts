import type { CommandBus, QueryBus } from "@nestjs/cqrs"
import { Args, Mutation, Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus, InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { AcceptedLocale } from "@modules/platform/i18n"
import type { Locale } from "@modules/platform/i18n"
import { DecideLeadFreezeCommand } from "../../application/decide-lead-freeze.command"
import { ReadLeadFreezeQuery } from "../../application/read-lead-freeze.query"
import { DecideLeadFreezeType } from "./dto/decide-lead-freeze.type"
import { DecideLeadFreezeInput, LeadFreezeInput } from "./dto/lead-freeze.input"
import { LeadFreezeType } from "./dto/lead-freeze.type"
import { toDecideLeadFreezeRequest, toReadLeadFreezeRequest } from "./lead-freeze.mapper"

@Resolver()
/** GraphQL door of the freezes of customers: whether one waits for the owner, and the owner's answer. */
export class LeadFreezeResolver {
    constructor(
        @InjectQueryBus() private readonly queryBus: QueryBus,
        @InjectCommandBus() private readonly commandBus: CommandBus,
    ) {}

    /** Whether a lead, or the customer of a run, waits for the owner to handle a failed run; null when nothing holds them. */
    @Query(() => LeadFreezeType, { name: "leadFreeze", nullable: true })
    async leadFreeze(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: LeadFreezeInput,
    ): Promise<LeadFreezeType | null> {
        return this.queryBus.execute(
            new ReadLeadFreezeQuery({ request: toReadLeadFreezeRequest(workspaceId, input), principal }),
        )
    }

    /** The owner's answer to a frozen customer: retry the failed run, take the conversation over, or skip the turn. */
    @Mutation(() => DecideLeadFreezeType, { name: "decideLeadFreeze" })
    async decideLeadFreeze(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @AcceptedLocale() locale: Locale,
        @Args("input") input: DecideLeadFreezeInput,
    ): Promise<DecideLeadFreezeType> {
        return this.commandBus.execute(
            new DecideLeadFreezeCommand({ request: toDecideLeadFreezeRequest(workspaceId, locale, input), principal }),
        )
    }
}
