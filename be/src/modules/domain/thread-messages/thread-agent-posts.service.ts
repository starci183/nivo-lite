import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { WorkChainsService } from "@modules/domain/work-chains"
import type { ChainActor, MentionRef, RecordedStep, StoppedStep } from "@modules/domain/work-chains"
import { WorkThreadsService } from "@modules/domain/work-threads"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { eachInOrder, unwrapOutcome } from "@modules/platform/primitives"
import { openCard } from "./approval-card.policy"
import { ThreadMessagesError, ThreadMessagesErrorCode } from "./errors/thread-messages.error"
import { vetMentions, vetQuotes } from "./mention.policy"
import { MentionDirectoryService } from "./mention-directory.service"
import type { AgentRow } from "./persistence/thread-messages.rows"
import { FIND_AGENT } from "./persistence/thread-messages.sql"
import { refOf, selfStepOf, tagStepOf } from "./thread-step.policy"
import { stepTitleOf } from "./thread-text.policy"
import type {
    AgentPost,
    ApprovalAsk,
    ApprovalCard,
    MentionView,
    OpenedApproval,
    PostedAgentMessage,
} from "./thread-messages.contracts"
import { InjectAgentRules, InjectApprovalGate } from "./thread-messages.decorators"
import type { AgentRules, ThreadApprovalGate } from "./thread-messages.port"
import { ThreadMessagesService } from "./thread-messages.service"

/** What writing an agent's message needs once its tags and its approval were settled. */
interface AgentWrite {
    readonly post: AgentPost
    readonly quoted: ReadonlyArray<string>
    readonly views: ReadonlyArray<MentionView>
    readonly card: ApprovalCard | null
    readonly asked: RecordedStep | null
}

/** A thread waits while its approval is pending, stops when the chain went back to the owner, and is open otherwise. */
const statusAfter = (card: ApprovalCard | null, ending: StoppedStep | null): "open" | "waiting" | "stopped" => {
    if (ending !== null) return "stopped"
    return card === null ? "open" : "waiting"
}

/** The stopped half of a recorded step, or null when it went on or nothing was recorded. */
const stoppedOf = (recorded: RecordedStep | null): StoppedStep | null =>
    recorded !== null && recorded.verdict === "stopped" ? recorded : null

@Injectable()
/** What an agent writes in a work thread: tags, hand-offs to other agents and approval asks, under the chain limits. */
export class ThreadAgentPostsService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectAgentRules() private readonly rules: AgentRules,
        @InjectApprovalGate() private readonly gate: ThreadApprovalGate,
        private readonly directory: MentionDirectoryService,
        private readonly threads: WorkThreadsService,
        private readonly chains: WorkChainsService,
        private readonly messages: ThreadMessagesService,
    ) {}

    /**
     * An agent writes. Tagging another agent needs the agents capability's say-so; the chain limits can send the work back to
     * the agent's owner instead; an approval ask opens a request and the message carries its card.
     */
    async postAsAgent(post: AgentPost): Promise<PostedAgentMessage> {
        const [agent] = await this.entityManager.query<Array<AgentRow>>(FIND_AGENT, [post.workspaceId, post.agentId])
        if (agent === undefined) throw new ThreadMessagesError({ code: ThreadMessagesErrorCode.AgentNotFound })
        const mentions = unwrapOutcome(vetMentions(post.mentions), ThreadMessagesError)
        const quoted = unwrapOutcome(vetQuotes(post.quoted), ThreadMessagesError)
        const views = await this.directory.resolve(this.entityManager, post.workspaceId, mentions, post.locale)
        await this.messages.proveAgents(
            views,
            (targetId) => this.rules.canTag(agent.id, targetId),
            ThreadMessagesErrorCode.TagNotAllowed,
        )
        if (post.approval === null) return this.writeAgent({ post, quoted, views, card: null, asked: null })
        const asked = await this.chains.record({
            workspaceId: post.workspaceId,
            threadId: post.threadId,
            actor: { kind: "agent", id: agent.id },
            kind: "ask_approval",
            action: stepTitleOf(post.stepTitle, post.approval.title),
            detail: "",
            rule: post.approval.rule,
            target: this.askedGroupOf(views),
            approvalRequestId: null,
            locale: post.locale,
        })
        if (asked.verdict === "stopped") return this.writeAgent({ post, quoted, views, card: null, asked })
        const card = await this.openApproval(post, post.approval, asked)
        return this.writeAgent({ post, quoted, views, card, asked })
    }

    /** The first group the agent tagged is who the approval ask is for; the gate decides who really gets it. */
    private askedGroupOf(views: ReadonlyArray<MentionView>): MentionRef | null {
        const group = views.find((view) => view.kind === "group")
        return group === undefined ? null : refOf(group)
    }

    private async openApproval(post: AgentPost, ask: ApprovalAsk, asked: RecordedStep): Promise<ApprovalCard> {
        let opened: OpenedApproval
        try {
            opened = await this.gate.open({
                workspaceId: post.workspaceId,
                chainStepId: asked.step.id,
                action: ask.actionKey,
                amount: ask.amount,
                unit: ask.unit,
                requestedByAgentId: post.agentId,
            })
        } catch (error) {
            await this.chains.abandon(post.workspaceId, asked.step.id)
            throw error
        }
        const owner = await this.chains.ownerTagOf(post.workspaceId, post.agentId)
        return openCard({
            ask,
            opened,
            names: await this.directory.namesOf(
                this.entityManager,
                post.workspaceId,
                opened.excluded.map((left) => left.memberId),
            ),
            owner: {
                ...owner,
                name: await this.directory.nameOfMember(this.entityManager, post.workspaceId, owner.id),
            },
        })
    }

    private writeAgent(write: AgentWrite): Promise<PostedAgentMessage> {
        const { post, card } = write
        const author: ChainActor = { kind: "agent", id: post.agentId }
        return this.entityManager.transaction(async (tx) => {
            await this.threads.lock(tx, post.workspaceId, post.threadId)
            await this.chains.settleFor(post.workspaceId, post.threadId, author, tx)
            if (card !== null && write.asked !== null) {
                await this.chains.linkApproval(post.workspaceId, write.asked.step.id, card.requestId, tx)
            }
            const ending = (await this.handOffTags(tx, write)) ?? stoppedOf(write.asked)
            const mentions =
                ending === null
                    ? write.views
                    : [
                          {
                              ...ending.ownerTag,
                              name: await this.directory.nameOfMember(tx, post.workspaceId, ending.ownerTag.id),
                          },
                      ]
            const message = await this.messages.append(tx, {
                workspaceId: post.workspaceId,
                threadId: post.threadId,
                author,
                body: ending === null ? post.body : `${post.body}\n${ending.step.detail}`,
                quoted: write.quoted,
                mentions,
                card,
            })
            await this.threads.setStatus(tx, post.workspaceId, post.threadId, statusAfter(card, ending))
            return { message, stopped: ending === null ? null : ending.stopReason }
        })
    }

    /**
     * Records a hand-off step for every tag but the group the approval ask already stands for; the first stopped step ends the run.
     * A message that tags nobody and asks nothing is the agent acting on its own (it confirms, it closes): one step of its own.
     */
    private async handOffTags(tx: EntityManager, write: AgentWrite): Promise<StoppedStep | null> {
        if (stoppedOf(write.asked) !== null) return null
        if (write.asked === null && write.views.length === 0) {
            const own = selfStepOf(
                write.post,
                { kind: "agent", id: write.post.agentId },
                stepTitleOf(write.post.stepTitle, write.post.body),
            )
            return stoppedOf(await this.chains.record(own, tx))
        }
        const askedGroup = write.asked === null ? null : write.views.find((view) => view.kind === "group")
        let stopped: StoppedStep | null = null
        await eachInOrder(
            write.views.filter((view) => view !== askedGroup),
            async (view) => {
                if (stopped !== null) return
                const recorded = await this.chains.record(
                    tagStepOf(
                        write.post,
                        { kind: "agent", id: write.post.agentId },
                        "hand_off",
                        stepTitleOf(write.post.stepTitle, write.post.body),
                        view,
                    ),
                    tx,
                )
                stopped = stoppedOf(recorded) ?? stopped
            },
        )
        return stopped
    }
}
