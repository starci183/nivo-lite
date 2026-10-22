import type { MentionDirectory, ThreadListing, ThreadMessage, ThreadView } from "@modules/domain/thread-messages"
import type { WorkThread } from "@modules/domain/work-threads"
import type { ChainStep, ChainView } from "@modules/domain/work-chains"
import type { Locale } from "@modules/platform/i18n"
import type { CreateWorkThreadRequest } from "../../application/create-work-thread.contracts"
import type { DecideThreadApprovalRequest } from "../../application/decide-thread-approval.contracts"
import type { ListWorkThreadsRequest } from "../../application/list-work-threads.contracts"
import type { PostThreadMessageRequest } from "../../application/post-thread-message.contracts"
import type { ReadMentionDirectoryRequest } from "../../application/read-mention-directory.contracts"
import type { ReadWorkChainRequest } from "../../application/read-work-chain.contracts"
import type { ReadWorkThreadRequest } from "../../application/read-work-thread.contracts"
import type { ChainStepType } from "./dto/chain-step.type"
import type { CreateWorkThreadInput } from "./dto/create-work-thread.input"
import type { DecideThreadApprovalInput } from "./dto/decide-thread-approval.input"
import type { ListWorkThreadsInput } from "./dto/list-work-threads.input"
import type { MentionDirectoryType } from "./dto/mention-directory.type"
import type { PostThreadMessageInput } from "./dto/post-thread-message.input"
import type { ThreadMessageType } from "./dto/thread-message.type"
import type { WorkChainType } from "./dto/work-chain.type"
import type { WorkThreadIdInput } from "./dto/work-thread-id.input"
import type { WorkThreadListingType } from "./dto/work-thread-listing.type"
import type { WorkThreadType } from "./dto/work-thread.type"
import type { WorkThreadViewType } from "./dto/work-thread-view.type"

/** Maps the list input of the request to the query request. */
export const toListWorkThreadsRequest = (workspaceId: string, input: ListWorkThreadsInput): ListWorkThreadsRequest => ({
    workspaceId,
    leadId: input.leadId,
})

/** Maps the thread an input names to the read request. */
export const toReadWorkThreadRequest = (workspaceId: string, input: WorkThreadIdInput): ReadWorkThreadRequest => ({
    workspaceId,
    threadId: input.threadId,
})

/** Maps the thread an input names to the chain request. */
export const toReadWorkChainRequest = (workspaceId: string, input: WorkThreadIdInput): ReadWorkChainRequest => ({
    workspaceId,
    threadId: input.threadId,
})

/** Maps the workspace and locale of the request to the directory request. */
export const toReadMentionDirectoryRequest = (workspaceId: string, locale: Locale): ReadMentionDirectoryRequest => ({
    workspaceId,
    locale,
})

/** Maps the input of a new thread to the command request. */
export const toCreateWorkThreadRequest = (
    workspaceId: string,
    input: CreateWorkThreadInput,
): CreateWorkThreadRequest => ({
    workspaceId,
    title: input.title,
    leadId: input.leadId,
    orderId: input.orderId,
})

/** Maps the input of a message to the command request. */
export const toPostThreadMessageRequest = (
    workspaceId: string,
    input: PostThreadMessageInput,
    locale: Locale,
): PostThreadMessageRequest => ({
    workspaceId,
    threadId: input.threadId,
    body: input.body,
    mentions: input.mentions.map((mention) => ({ kind: mention.kind, id: mention.id })),
    quoted: input.quoted,
    locale,
})

/** Maps the decision input to the command request. */
export const toDecideThreadApprovalRequest = (
    workspaceId: string,
    input: DecideThreadApprovalInput,
    locale: Locale,
): DecideThreadApprovalRequest => ({ workspaceId, messageId: input.messageId, verdict: input.verdict, locale })

/** Maps a thread to the GraphQL type. */
export const toWorkThreadType = (thread: WorkThread): WorkThreadType => ({ ...thread })

/** Maps the thread list to the GraphQL type. */
export const toWorkThreadListingsType = (listing: ReadonlyArray<ThreadListing>): Array<WorkThreadListingType> =>
    listing.map((thread) => ({ ...thread }))

/** Maps a message to the GraphQL type. */
export const toThreadMessageType = (message: ThreadMessage): ThreadMessageType => ({ ...message })

/** Maps a thread with its messages to the GraphQL type. */
export const toWorkThreadViewType = (view: ThreadView): WorkThreadViewType => ({
    thread: { ...view.thread },
    messages: view.messages.map((message) => ({ ...message })),
})

const toChainStepType = (step: ChainStep): ChainStepType => ({
    ...step,
    actorKind: step.actor.kind,
    actorId: step.actor.id,
})

/** Maps the chain of a thread to the GraphQL type. */
export const toWorkChainType = (chain: ChainView): WorkChainType => ({
    steps: chain.steps.map(toChainStepType),
    summary: { ...chain.summary },
})

/** Maps the composer's directory to the GraphQL type. */
export const toMentionDirectoryType = (directory: MentionDirectory): MentionDirectoryType => ({
    members: directory.members.map((option) => ({ ...option })),
    agents: directory.agents.map((option) => ({ ...option })),
    groups: directory.groups.map((option) => ({ ...option })),
})
