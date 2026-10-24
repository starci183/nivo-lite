import type { QueryBus } from "@nestjs/cqrs"
import { Args, Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { AcceptedLocale } from "@modules/platform/i18n"
import type { Locale } from "@modules/platform/i18n"
import { ListWorkThreadsQuery } from "../../application/list-work-threads.query"
import { ReadMentionDirectoryQuery } from "../../application/read-mention-directory.query"
import { ReadWorkChainQuery } from "../../application/read-work-chain.query"
import { ReadWorkThreadQuery } from "../../application/read-work-thread.query"
import { ListWorkThreadsInput } from "./dto/list-work-threads.input"
import { MentionDirectoryType } from "./dto/mention-directory.type"
import { WorkChainType } from "./dto/work-chain.type"
import { WorkThreadIdInput } from "./dto/work-thread-id.input"
import { WorkThreadConnectionType } from "./dto/work-thread-connection.type"
import { WorkThreadViewType } from "./dto/work-thread-view.type"
import {
    toListWorkThreadsRequest,
    toMentionDirectoryType,
    toReadMentionDirectoryRequest,
    toReadWorkChainRequest,
    toReadWorkThreadRequest,
    toWorkChainType,
    toWorkThreadListingsType,
    toWorkThreadViewType,
} from "./work-threads.mapper"

@Resolver()
/** GraphQL doors that read work threads: the list, one thread, its chain and the composer's tag directory. */
export class WorkThreadsResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Lists the newest threads of the workspace, optionally only those about one lead. */
    @Query(() => WorkThreadConnectionType, { name: "workThreads" })
    async workThreads(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input", { defaultValue: {} }) input: ListWorkThreadsInput,
    ): Promise<WorkThreadConnectionType> {
        const result = await this.queryBus.execute(
            new ListWorkThreadsQuery({ request: toListWorkThreadsRequest(workspaceId, input), principal }),
        )
        return toWorkThreadListingsType(result)
    }

    /** Reads one thread with its newest messages. */
    @Query(() => WorkThreadViewType, { name: "workThread" })
    async workThread(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: WorkThreadIdInput,
    ): Promise<WorkThreadViewType> {
        const result = await this.queryBus.execute(
            new ReadWorkThreadQuery({ request: toReadWorkThreadRequest(workspaceId, input), principal }),
        )
        return toWorkThreadViewType(result)
    }

    /** Reads the chain of one thread: its steps and its summary line. */
    @Query(() => WorkChainType, { name: "workChain" })
    async workChain(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: WorkThreadIdInput,
    ): Promise<WorkChainType> {
        const result = await this.queryBus.execute(
            new ReadWorkChainQuery({ request: toReadWorkChainRequest(workspaceId, input), principal }),
        )
        return toWorkChainType(result)
    }

    /** Lists the people, agents and groups the composer can tag. */
    @Query(() => MentionDirectoryType, { name: "mentionDirectory" })
    async mentionDirectory(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @AcceptedLocale() locale: Locale,
    ): Promise<MentionDirectoryType> {
        const result = await this.queryBus.execute(
            new ReadMentionDirectoryQuery({ request: toReadMentionDirectoryRequest(workspaceId, locale), principal }),
        )
        return toMentionDirectoryType(result)
    }
}
