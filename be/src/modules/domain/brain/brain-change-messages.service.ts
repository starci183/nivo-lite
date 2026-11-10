import { Injectable } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import { BrainChangeRequestsService, BrainFactsError, BrainFactsErrorCode, BrainFactsService } from "@modules/domain/brain-facts"
import type { ChangeFiled, ChangeRequestHook, FactRecord, ReasonedChangeRequest } from "@modules/domain/brain-facts"
import { TeamChatAudienceService, TeamChatCardsService, TeamChatStoreService } from "@modules/domain/team-chat"
import type {
    BrainChangeCurrent,
    BrainChangeEvidence,
    BrainChangeOrigin,
    BrainChangePayload,
    BrainChangePayloadGiven,
} from "@modules/domain/team-chat/brain-change-card.contracts"
import {
    brainChangeKeyOf,
    brainChangeMessageOf,
    brainChangeOfMessage,
    countedPayloadOf,
    decidedPayloadOf,
    supersededPayloadOf,
} from "@modules/domain/team-chat/brain-change-card.policy"
import { WorkspaceMembersReadService, WorkspaceMembersService } from "@modules/domain/workspace-members"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { eachInOrder } from "@modules/platform/primitives"
import { BrainService } from "./brain.service"
import { MANAGERS } from "./founder.policy"

/** A truth-graph change message to post: the change request it is about, why, on what words, who speaks and where. */
export interface BrainChangePost {
    /** The workspace. */
    readonly workspaceId: string
    /** The change request: a proposed fact of the truth graph (filed before, never applied by this post). */
    readonly changeId: string
    /** Where it came from. */
    readonly origin: BrainChangeOrigin
    /** Why the truth changes, in the agent's own plain words; refused when empty or a copy of the value or the quoted words. */
    readonly reason: string
    /** The words it rests on, oldest first (learning: one per similar human answer). */
    readonly evidence: ReadonlyArray<BrainChangeEvidence>
    /** The agent that speaks (the card's author); null = NIVO, which needs no card (`no_room`). */
    readonly agentId: string | null
    /** The room of the card; null = the direct room between the founder and the agent. */
    readonly roomId: string | null
}

/** What posting did: a new card, the card of the same request rewritten, nothing (not a proposal any more, or nowhere to post). */
export interface BrainChangePosted {
    /** `posted`, `updated`, `not_waiting` (the fact is not a proposal), `no_room` (no agent or room to post as or in). */
    readonly outcome: "posted" | "updated" | "not_waiting" | "no_room"
    /** The card's message, or null when nothing was posted. */
    readonly messageId: string | null
    /** The change requests whose open card this one superseded. */
    readonly superseded: ReadonlyArray<string>
}

/** A decision on a card: approve (the founder only) or turn down (the founder or a manager), with an optional note. */
export interface BrainChangeDecide {
    /** The workspace. */
    readonly workspaceId: string
    /** The change request on the card. */
    readonly changeId: string
    /** Đồng ý or Không. */
    readonly action: "approve" | "reject"
    /** The reason given with the decision. */
    readonly note?: string | undefined
}

/** What a decision did, and where the card stands after it. */
export interface BrainChangeDecision {
    /**
     * `applied` / `rejected`: decided and the card rewritten; `founder_only`: a manager pressed Đồng ý, nothing changed;
     * `already_decided`: the card was not open (or the request was decided meanwhile); `not_found`: no card of that request.
     */
    readonly outcome: "applied" | "rejected" | "founder_only" | "already_decided" | "not_found"
    /** Where the card stands; null when there is none. */
    readonly state: BrainChangePayload["state"] | null
    /** How many times the card was written; null when there is none. */
    readonly revision: number | null
}

/** The decisions of the store that put a proposal in force (or take a fact out of force, for a retire proposal). */
const APPLIED: ReadonlyArray<FactRecord["status"]> = ["active", "scheduled", "superseded", "expired"]

/** What a change request does to the graph, read from the proposal and the value in force. */
const kindOf = (fact: FactRecord, current: BrainChangeCurrent | null): BrainChangePayload["kind"] => {
    if (fact.proposalKind === "retire") return "retire"
    return current === null ? "add" : "change"
}

/** Where a fact in force came from, for people: the title or label of its first evidence. */
const sourceOf = (fact: FactRecord): string => {
    const [first] = fact.evidence
    return first?.title ?? first?.label ?? fact.sourceKind
}

/** The payload of a change request's card as it stands now (open), from the proposal, the value in force and the post. */
const givenOf = (post: BrainChangePost, fact: FactRecord, current: BrainChangeCurrent | null): BrainChangePayloadGiven => ({
    version: 1,
    changeId: fact.id,
    origin: post.origin,
    kind: kindOf(fact, current),
    factKey: { subjectLabel: fact.subjectLabel, attributeLabel: fact.attributeLabel },
    oldValue: current?.value ?? null,
    current,
    newValue: fact.proposalKind === "retire" ? "" : fact.value,
    unit: fact.unit,
    validFrom: fact.validFrom,
    validTo: fact.validTo,
    reason: post.reason.trim(),
    evidence: post.evidence,
    state: "open",
    decidedBy: null,
    supersededBy: null,
})

@Injectable()
/**
 * The truth-graph change message (BG4; owner 2026-11-11: "agent in ra message sửa truth graph và lí do"). When a change request is filed
 * from a chat (through `nivo.brain.change.propose`), learnt from repeated human answers (BG5) or found in a document, ONE `brain.change`
 * card goes to the room it came from (the founder's direct room with the agent when it came from no room): the truth, the value in force
 * → the proposed one, the agent's reason and the evidence. It never applies anything. The same request again rewrites its card (more
 * evidence, the newest reason); a newer request for the same truth marks the older open card `superseded`. Only the workspace owner
 * approves on the card (W2's founder-only apply: next version, one year unless stated, edges carried); a manager may turn it down. Every
 * decision rewrites the same card in place.
 */
export class BrainChangeMessagesService implements OnModuleInit, ChangeRequestHook {
    constructor(
        @InjectClock() private readonly clock: Clock,
        private readonly requests: BrainChangeRequestsService,
        private readonly facts: BrainFactsService,
        private readonly brain: BrainService,
        private readonly audience: TeamChatAudienceService,
        private readonly cards: TeamChatCardsService,
        private readonly store: TeamChatStoreService,
        private readonly members: WorkspaceMembersService,
        private readonly people: WorkspaceMembersReadService,
    ) {}

    /** Hooks the card onto every change request filed from a chat in this app. */
    onModuleInit(): void {
        this.requests.whenFiled(this)
    }

    /** Refuses words that are not a person's line of the workspace's team chat (a customer's words never are). */
    async vet(workspaceId: string, request: ReasonedChangeRequest): Promise<void> {
        const [line] = await this.store.messagesByIds(workspaceId, [request.messageId])
        if (line?.authorKind !== "user" || line.authorId === null) {
            throw new BrainFactsError({ code: BrainFactsErrorCode.FactNotFound, params: { field: "messageId" } })
        }
    }

    /** Posts (or rewrites) the card of a request filed from a chat, in the room the words were said in. */
    async filed(workspaceId: string, request: ReasonedChangeRequest, filed: ChangeFiled): Promise<void> {
        if (filed.outcome === "already_true") return
        const [line] = await this.store.messagesByIds(workspaceId, [request.messageId])
        if (line === undefined || line.authorId === null) return
        const [person] = await this.people.namesOf(workspaceId, [line.authorId])
        await this.post({
            workspaceId,
            changeId: filed.fact.id,
            origin: "chat",
            reason: request.reason ?? "",
            evidence: [
                {
                    kind: "message",
                    quote: request.quote.trim(),
                    ref: `team-chat:${line.id}`,
                    by: { name: person?.displayName ?? "", memberId: line.authorId },
                    at: line.createdAt.toISOString(),
                },
            ],
            agentId: request.agentId,
            roomId: line.roomId,
        })
    }

    /**
     * Posts the card of one change request, or rewrites the one it already has (never a second card), and marks the other open cards of
     * the same truth superseded. Nothing is posted for a fact that is not a proposal. The reason is mandatory and must say why.
     */
    async post(change: BrainChangePost): Promise<BrainChangePosted> {
        const fact = await this.facts.get(change.workspaceId, change.changeId)
        if (fact?.status !== "proposed") return { outcome: "not_waiting", messageId: null, superseded: [] }
        this.requests.checkReason(
            change.reason,
            fact.proposalKind === "retire" ? null : fact.value,
            change.evidence.map((one) => one.quote),
        )
        const given = givenOf(change, fact, await this.currentOf(change.workspaceId, fact))
        const key = brainChangeKeyOf(fact.id)
        const before = brainChangeOfMessage(await this.audience.storedCard(change.workspaceId, key))
        const message = brainChangeMessageOf(countedPayloadOf(given, before))
        if (before !== null) {
            const folded = await this.audience.foldTeamCard(change.workspaceId, key, message)
            const superseded = await this.supersedeOthers(change.workspaceId, fact)
            return { outcome: "updated", messageId: folded, superseded }
        }
        const messageId = await this.place(change, key, message)
        if (messageId === null) return { outcome: "no_room", messageId: null, superseded: [] }
        return { outcome: "posted", messageId, superseded: await this.supersedeOthers(change.workspaceId, fact) }
    }

    /**
     * Decides on the card: Đồng ý applies through W2's founder-only path (a competing value of the same truth is turned down with it),
     * Không turns it down; then the same card is rewritten with who and when. A manager's Đồng ý changes nothing (`founder_only`);
     * someone who is neither owner nor manager is refused by the member check.
     */
    async decide(userId: string, decision: BrainChangeDecide): Promise<BrainChangeDecision> {
        const me = await this.members.require(userId, decision.workspaceId, MANAGERS)
        const key = brainChangeKeyOf(decision.changeId)
        const card = brainChangeOfMessage(await this.audience.storedCard(decision.workspaceId, key))
        if (card === null) return { outcome: "not_found", state: null, revision: null }
        if (card.state !== "open") return { outcome: "already_decided", state: card.state, revision: card.revision }
        if (decision.action === "approve" && me.role !== "owner") {
            return { outcome: "founder_only", state: card.state, revision: card.revision }
        }
        const fact = await this.facts.get(decision.workspaceId, decision.changeId)
        if (fact?.status !== "proposed") return this.closed(decision.workspaceId, card, fact)
        try {
            await this.brain.decideFact(userId, {
                workspaceId: decision.workspaceId,
                id: fact.id,
                action: actionOf(decision.action, fact),
                note: decision.note,
            })
        } catch (cause) {
            if (cause instanceof BrainFactsError && cause.code === BrainFactsErrorCode.NotProposed)
                return this.closed(decision.workspaceId, card, await this.facts.get(decision.workspaceId, fact.id))
            throw cause
        }
        const state = decision.action === "approve" ? "applied" : "rejected"
        const decided = decidedPayloadOf(card, state, {
            memberId: userId,
            name: me.displayName,
            at: this.clock.now().toISOString(),
        })
        await this.audience.foldTeamCard(decision.workspaceId, key, brainChangeMessageOf(decided))
        return { outcome: state, state, revision: decided.revision }
    }

    /**
     * Follows a decision taken elsewhere (the Second Brain page): an open card of the request is rewritten applied or rejected, with the
     * name the store keeps. Nothing happens to a card that is not open or a fact still waiting.
     */
    async follow(workspaceId: string, fact: FactRecord): Promise<void> {
        const key = brainChangeKeyOf(fact.id)
        const card = brainChangeOfMessage(await this.audience.storedCard(workspaceId, key))
        if (card?.state !== "open" || fact.status === "proposed") return
        const state = APPLIED.includes(fact.status) ? "applied" : "rejected"
        const decided = decidedPayloadOf(card, state, {
            memberId: "",
            name: fact.decidedBy ?? "",
            at: fact.decidedAt ?? this.clock.now().toISOString(),
        })
        await this.audience.foldTeamCard(workspaceId, key, brainChangeMessageOf(decided))
    }

    /** A card whose request was decided meanwhile: brought in line with the store, answered as already decided. */
    private async closed(
        workspaceId: string,
        card: BrainChangePayload,
        fact: FactRecord | null,
    ): Promise<BrainChangeDecision> {
        if (fact !== null) await this.follow(workspaceId, fact)
        const now = brainChangeOfMessage(await this.audience.storedCard(workspaceId, brainChangeKeyOf(card.changeId)))
        return { outcome: "already_decided", state: now?.state ?? card.state, revision: now?.revision ?? card.revision }
    }

    /** The value in force the proposal would replace (the one it names, else the active one of its key), or null for a new truth. */
    private async currentOf(workspaceId: string, fact: FactRecord): Promise<BrainChangeCurrent | null> {
        const named = fact.conflictWith === null ? null : await this.facts.get(workspaceId, fact.conflictWith)
        const [keyed] =
            named?.status === "active"
                ? [named]
                : await this.facts.byKey(workspaceId, fact.subjectKey, fact.attribute, "active", fact.installationId)
        return keyed === undefined
            ? null
            : { value: keyed.value, version: keyed.version ?? null, source: sourceOf(keyed) }
    }

    /** Posts the card once under its key: in the room named, else in the founder's direct room with the agent. */
    private async place(
        change: BrainChangePost,
        key: string,
        message: ReturnType<typeof brainChangeMessageOf>,
    ): Promise<string | null> {
        if (change.agentId === null) return null
        const line = { body: message.summary, key, agentMessage: JSON.stringify(message) }
        if (change.roomId !== null) {
            const posted = await this.cards.postMessage(change.workspaceId, {
                authorAgentId: change.agentId,
                roomId: change.roomId,
                toUserId: null,
                ...line,
            })
            return posted?.messageId ?? null
        }
        const posted = await this.cards.postAsAgent(change.workspaceId, { agent: change.agentId, toUserId: null, ...line })
        return posted?.messageId ?? null
    }

    /** Marks every other open card of the same truth superseded by this request; answers their change requests. */
    private async supersedeOthers(workspaceId: string, fact: FactRecord): Promise<ReadonlyArray<string>> {
        const waiting = await this.facts.byKey(workspaceId, fact.subjectKey, fact.attribute, "proposed", fact.installationId)
        const superseded: Array<string> = []
        await eachInOrder(
            waiting.filter((other) => other.id !== fact.id),
            async (other) => {
                const key = brainChangeKeyOf(other.id)
                const card = brainChangeOfMessage(await this.audience.storedCard(workspaceId, key))
                if (card?.state !== "open") return
                await this.audience.foldTeamCard(workspaceId, key, brainChangeMessageOf(supersededPayloadOf(card, fact.id)))
                superseded.push(other.id)
            },
        )
        return superseded
    }
}

/** The store's decision for a card's button: Đồng ý on a value chooses it (competing values turned down), on a retire applies it. */
const actionOf = (action: BrainChangeDecide["action"], fact: FactRecord): "choose" | "apply" | "reject" => {
    if (action === "reject") return "reject"
    return fact.proposalKind === "set" ? "choose" : "apply"
}
