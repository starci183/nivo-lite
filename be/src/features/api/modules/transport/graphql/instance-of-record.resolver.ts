import type { QueryBus } from "@nestjs/cqrs"
import { Args, ID, Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { InstanceOfRecordQuery } from "../../application/instance-of-record.query"
import { toInstanceOfRecordId, toInstanceOfRecordRequest } from "./instance-of-record.mapper"
import { InstanceOfRecordInput } from "./dto/instance-of-record.input"

@Resolver()
/** GraphQL door of the installation that owns a record. */
export class InstanceOfRecordResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** The installation of a work item, conversation, booking, lead flow or lead; null when none says. */
    @Query(() => ID, { name: "instanceOfRecord", nullable: true })
    async instanceOfRecord(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: InstanceOfRecordInput,
    ): Promise<string | null> {
        const result = await this.queryBus.execute(
            new InstanceOfRecordQuery({ request: toInstanceOfRecordRequest(workspaceId, input), principal }),
        )
        return toInstanceOfRecordId(result)
    }
}
