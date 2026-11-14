import { Injectable, Optional } from "@nestjs/common"
import { BrainExtractionsService } from "@modules/domain/brain-extractions"
import {
  BrainFactsError,
  BrainFactsErrorCode,
  BrainFactsReadService,
  BrainFactsService,
  sameValue,
  valueLineOf,
  valueTypeProblemOf,
  type FactRecord,
} from "@modules/domain/brain-facts"
import type { TruthPassage } from "@modules/domain/knowledge-chunks"
import type { SourceRecord } from "@modules/domain/knowledge-sources"
import { CritiqueDecisionsService } from "@modules/domain/dossier-review"
import { WorkspaceMembersService, type WorkspaceRole } from "@modules/domain/workspace-members"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { eachInOrder } from "@modules/platform/primitives"
import { InjectTruthCritiqueGate } from "./brain.decorators"
import { BrainLogEvent } from "./brain.log-events"
import { BrainError, BrainErrorCode } from "./errors/brain.error"
import { PublicDocumentsService } from "@modules/domain/public-documents"
import {
  NO_CRITIQUE,
  arguesWith,
  overlays,
  passageHashOf,
  putInForceBy,
  settleVerdictOf,
  type PassageCritique,
  type SettleVerdict,
  type TruthCritiqueGate,
} from "./direct-apply.policy"
import { DocumentPartsService } from "./document-parts.service"
import { parkedOf, type MaybeParked, type Reading, type SettleTally } from "./document-truths.contracts"
import { FactEmbeddingsService } from "./fact-embeddings.service"
import { FactReadingLogEvent } from "./fact-reading.log-events"
import { mayJoinInForce } from "./same-fact.policy"
import { TRUTH_CEILING, fits, taken, truthBytesOf, type TruthRoom } from "./truth-ceiling.policy"
import { TruthCeilingService } from "./truth-ceiling.service"

/** The most waiting truths of one document a settle reads (a document holds a few hundred passages). */
const SETTLE_MAX = 2000

/** The member of the workspace who stands behind a document: its truths go in force by themselves, in this person's name. */
interface Uploader {
    /** The name the decision history shows (`decidedBy` of each truth put in force). */
    readonly name: string
    /** Their role in the workspace, written in the decision note. */
    readonly role: WorkspaceRole
}

/** What a settle carries from one truth to the next. */
interface Settling {
    /** The room left under the ceiling. */
    readonly room: TruthRoom
    /** How many truths went each way. */
    readonly tally: SettleTally
    /** The truths put in force. */
    readonly changed: ReadonlyArray<string>
}

/** What a settle found for the waiting truths of a document. */
interface Settled {
    /** How many truths went each way. */
    readonly tally: SettleTally
    /** The truths put in force. */
    readonly changed: ReadonlyArray<string>
}

/** No room left under the ceiling: what a settle carries on once the database refused a truth for room. */
const NO_ROOM: TruthRoom = { truths: 0, bytes: 0 }

/**
 * The verdicts that put a truth in force BY ITSELF (the document's own word): these are bounded by the ceiling and guarded under the
 * in-force lock (`guardOf`). `confirmed` and `corrected` are the founder's answer and are never refused for room.
 */
const BOUNDED: ReadonlySet<SettleVerdict> = new Set<SettleVerdict>(["apply", "updated"])

/**
 * How putting one truth in force ended: written; refused by the ceiling (nothing written); refused under the lock because a value that
 * argues with it came in force from another source meanwhile (asked); joined to the same value that came in force meanwhile; or failed
 * (left for the founder).
 */
type ForceOutcome = "applied" | "full" | "raced" | "joined" | "failed"

/** The tally of a settle that put nothing in force. */
const NONE: SettleTally = { applied: 0, asked: 0, waiting: 0, full: 0 }

/**
 * Why the guard of an automatic write refused it, under the in-force lock (`InForceBoundService`): a value that argues with the truth
 * (`raced`) or the same value (`joined`) came in force for its key since its verdict was read. Thrown by the guard, caught in
 * `putInForce`; nothing was written.
 */
const lostRace = (outcome: "raced" | "joined"): BrainError =>
    new BrainError({ code: BrainErrorCode.SettleLostRace, params: { outcome } })

/**
 * The truths of a document another waiting truth of the SAME document names as the one it disagrees with (the same-meaning
 * judgement's `conflictWith`) with another value under ANOTHER key: the document contradicts itself in other words, in one part or
 * across parts.
 */
export const contestedOf = (whole: ReadonlyArray<FactRecord>): ReadonlySet<string> => {
    const byId = new Map(whole.map((fact) => [fact.id, fact]))
    return new Set(
        whole.flatMap((fact) => {
            const named = fact.conflictWith === null ? undefined : byId.get(fact.conflictWith)
            if (named === undefined || sameValue(valueLineOf(named), valueLineOf(fact))) return []
            // Two values of ONE key are the key's own question, and a window over a standing value is no contradiction at all, whatever
            // its key (D-N-5: the overlay of the standing value).
            const sameKey = named.subjectKey === fact.subjectKey && named.attribute === fact.attribute
            return sameKey || overlays(fact, named) ? [] : [named.id]
        }),
    )
}

/** One truth to settle, with what decides it. */
interface Decision {
    /** The document. */
    readonly source: SourceRecord
    /** The truth. */
    readonly fact: FactRecord
    /** Its verdict. */
    readonly verdict: SettleVerdict
    /** The member who stands behind the document. */
    readonly uploader: Uploader
    /** The critic's word on the document's passages. */
    readonly critique: PassageCritique
    /** Whether the truth may join the same value in force (`mayJoinInForce`): no open point names it. */
    readonly mayJoin: boolean
}

/** The tally with one more truth in a state. */
const counted = (tally: SettleTally, state: keyof SettleTally): SettleTally => ({ ...tally, [state]: tally[state] + 1 })

@Injectable()
/**
 * Stage 3 of a document's truths work: what goes in force, as soon as the document's (or the part's) own reading ends (owner
 * 2026-11-12: documents are entered by the business's own people and are trusted). Each waiting truth gets its verdict
 * (`settleVerdictOf`, the one gate): the truths of a document a MEMBER of the workspace stands behind go in force directly while there
 * is room under the ceiling, a duplicate joins or closes, and only a contradiction (or an open holding point that names a truth) asks
 * the founder. Nothing waits for another document, another part of the file, or the critic. A document no member stands behind waits
 * for a person. The founder's answer to a point settles the truths that answer names, and only those. A value another waiting truth
 * of the same document disagrees with is asked about, never put in force. Every automatic write is guarded under the workspace's
 * in-force lock: a rival value that came in force from another source meanwhile makes it asked, the same value makes it join. The
 * facts store is told ONCE with every truth put in force: one vector batch and one policy request per settle, never one per truth.
 */
export class DocumentSettleService {
    constructor(
        @InjectLogger() private readonly logger: Logger,
        private readonly facts: BrainFactsService,
        private readonly reads: BrainFactsReadService,
        private readonly extractions: BrainExtractionsService,
        private readonly members: WorkspaceMembersService,
        private readonly ceiling: TruthCeilingService,
        private readonly parts: DocumentPartsService,
        private readonly publicDocuments: PublicDocumentsService,
        @InjectTruthCritiqueGate() private readonly critic: TruthCritiqueGate,
        private readonly vectors: FactEmbeddingsService,
        @Optional() private readonly decisions?: CritiqueDecisionsService,
    ) {}

    /** The critic's word on a document; with no critic that can answer, no point holds anything. */
    critiqueOf(workspaceId: string, sourceId: string): Promise<PassageCritique> {
        if (typeof this.critic.truthGateOf !== "function") return Promise.resolve(NO_CRITIQUE)
        return this.critic.truthGateOf(workspaceId, sourceId)
    }

    /**
     * The OTHER documents whose waiting truths this document's critique names: in an open point, or in an answer the founder gave
     * (`decided`). Their settle must run again when the critique changes (TRIAGE-4). By ids and evidence only.
     */
    async otherSourcesNamedBy(workspaceId: string, sourceId: string): Promise<ReadonlyArray<string>> {
        const critique = await this.critiqueOf(workspaceId, sourceId)
        const ids = [...new Set([...(critique.findings ?? []).flatMap((finding) => finding.factIds), ...(critique.decided?.keys() ?? [])])]
        if (ids.length === 0) return []
        const named = await this.reads.byIds(workspaceId, ids)
        return [
            ...new Set(
                named
                    .filter((fact) => fact.status === "proposed")
                    .flatMap((fact) => fact.evidence.flatMap((item) => (item.kind === "document" && item.sourceId !== undefined ? [item.sourceId] : [])))
                    .filter((id) => id !== sourceId),
            ),
        ]
    }

    /** Settles the waiting truths of the document and saves the counts; answers the state the reading now waits in, or null when it is finished. */
    async settle(source: SourceRecord, passages: ReadonlyArray<TruthPassage>, state: Reading): Promise<MaybeParked> {
        const workspaceId = source.workspaceId
        const uploader = await this.uploaderOf(source)
        const waiting = await this.waitingOf(source)
        const settled: Settled =
            uploader === null ? { tally: { ...NONE, waiting: waiting.length }, changed: [] } : await this.decide(source, waiting, uploader)
        await this.facts.announceChanged(workspaceId, settled.changed)
        const before = (await this.extractions.get(workspaceId, source.id))?.counts.factsApplied ?? 0
        const parked = parkedOf(settled.tally)
        await this.extractions.save(workspaceId, source.id, {
            status: parked?.status ?? "running",
            windowsDone: state.done,
            factsProposed: state.filed,
            windowsTotal: state.done,
            error: parked?.note ?? null,
            attempts: 0,
            stage: "settle",
            counts: {
                passagesTotal: passages.length,
                passagesTriaged: passages.length,
                passagesKept: passages.filter((passage) => passage.triage === "rule").length,
                factsApplied: before + settled.tally.applied,
                factsAsked: settled.tally.asked,
                factsWaiting: settled.tally.waiting + settled.tally.full,
            },
        })
        return parked
    }

    /**
     * Decides every waiting truth of a member's document, one after the other (each decision reads what stands for its key now): the
     * document's own waiting truths, and the truths the founder's answers to its points decided (his typed value is a truth of his own,
     * not of the document). The other parts of a long file are read only for what contradicts: their waiting truths are never waited for.
     */
    private async decide(source: SourceRecord, waiting: ReadonlyArray<FactRecord>, uploader: Uploader): Promise<Settled> {
        const workspaceId = source.workspaceId
        const critique = await this.critiqueOf(workspaceId, source.id)
        await this.closeKept(workspaceId, critique, waiting)
        const answered = await this.answeredOf(workspaceId, critique, waiting)
        const all = [...waiting, ...answered]
        if (all.length === 0) return { tally: NONE, changed: [] }
        const others = (await this.parts.wholeOf(workspaceId, source.id)).filter((id) => id !== source.id)
        const elsewhere = others.length === 0 ? [] : await this.reads.ofSources(workspaceId, others, ["proposed"], SETTLE_MAX)
        // Waiting truths of ANY document that name one of these as the truth they disagree with (a same-meaning link): both sides are
        // asked, whichever document settles first.
        const naming = (await this.reads.kinOf(workspaceId, { keys: [], ids: all.map((fact) => fact.id) })).filter(
            (fact) => fact.status === "proposed",
        )
        const contested = contestedOf([...waiting, ...elsewhere, ...naming])
        const start: Settling = { room: await this.ceiling.room(workspaceId), tally: NONE, changed: [] }
        const box = { settling: start }
        const own: ReadonlySet<string> = new Set([...all, ...elsewhere].map((fact) => fact.id))
        // A standing value before the windows over it: one document that states both puts the standing value in force, then the overlay.
        const ordered = [...all].sort((left, right) => Number(left.validTo !== null) - Number(right.validTo !== null))
        try {
            await eachInOrder(ordered, async (fact) => {
                // The same value already in force for the key: the truth joins it (its source is added), nothing is replaced (TRIAGE-4).
                // Never while an open holding point names it (`mayJoinInForce`).
                const joins = critique.decided?.has(fact.id) !== true && mayJoinInForce(fact, passageHashOf(fact, source.id), critique.findings ?? [])
                if (joins && (await this.joinedInForce(workspaceId, fact))) return
                const verdict = await this.verdictOf(source, fact, critique, contested)
                const decided = await this.checkedBeforeForce(source, fact, verdict, critique, contested, own)
                if (decided === null) return
                const decision = { source, fact: decided.fact, verdict: decided.verdict, uploader, critique, mayJoin: joins }
                box.settling = await this.one(decision, box.settling)
            })
        } catch (cause) {
            // A later truth failed the settle: what was already written is in force, so it is announced before the job is retried
            // (the listeners, the critic's among them, run AFTER the write, whatever ends the settle).
            await this.facts.announceChanged(workspaceId, box.settling.changed)
            throw cause
        }
        return { tally: box.settling.tally, changed: box.settling.changed }
    }

    /**
     * The truths the founder's answers KEPT that no longer wait (in force since an earlier settle): the critic is told again, at every
     * settle, that they were decided, so a point of the same rule that still names one closes. The announcement that follows a write
     * (`announceChanged`) already does this; a settle that was cut between the write and the announcement (a crash, a lost process) is
     * retried by the queue and comes through here, so an open twin never keeps a passage of a truth in force hidden from customers.
     * One indexed read of open points on the critic's side; nothing when no answer decided a truth.
     */
    private async closeKept(workspaceId: string, critique: PassageCritique, waiting: ReadonlyArray<FactRecord>): Promise<void> {
        const stillWaiting = new Set(waiting.map((fact) => fact.id))
        const kept = [...(critique.decided?.keys() ?? [])].filter((id) => !stillWaiting.has(id))
        if (this.decisions === undefined || kept.length === 0) return
        await this.decisions.factsChanged(workspaceId, kept)
    }

    /**
     * The waiting truths the founder's answers decided that are not among the document's own: the value he typed on a point (filed as
     * his own proposal), or the other document's value he picked.
     */
    private async answeredOf(
        workspaceId: string,
        critique: PassageCritique,
        waiting: ReadonlyArray<FactRecord>,
    ): Promise<ReadonlyArray<FactRecord>> {
        const own = new Set(waiting.map((fact) => fact.id))
        const ids = [...(critique.decided?.keys() ?? [])].filter((id) => !own.has(id))
        if (ids.length === 0) return []
        return (await this.reads.byIds(workspaceId, ids)).filter((fact) => fact.status === "proposed")
    }

    /** Carries out the verdict of one truth and answers where the settle stands after it. */
    private async one(decision: Decision, settling: Settling): Promise<Settling> {
        const { source, fact, verdict, uploader, critique, mayJoin } = decision
        if (verdict === "asked") return { ...settling, tally: counted(settling.tally, "asked") }
        if (verdict === "waiting") return { ...settling, tally: counted(settling.tally, "waiting") }
        if (verdict === "duplicate") {
            await this.close(source.workspaceId, fact)
            return settling
        }
        const bytes = truthBytesOf(fact)
        // The ceiling stops only a NEW truth that goes in force by itself: the founder's own answer is never refused for room, and a
        // document updating its own value adds none. The room read when the settle started only spares writes that cannot fit: other
        // documents settle at the same time, so THE check is the store's, inside the write (`applyUnannounced` with a bound, D-U-1).
        if (verdict === "apply" && !fits(settling.room, bytes)) return { ...settling, tally: counted(settling.tally, "full") }
        // A truth the founder's answer decided is in force as decided by HIM (the name his answer kept, else the document's member).
        const named = critique.decided?.get(fact.id)?.by ?? ""
        const by = named === "" ? uploader : { ...uploader, name: named }
        const outcome = await this.putInForce({ source, fact, verdict, uploader: by, critique, mayJoin })
        // The store refused it for room (another settle took the last places): it waits, as does every later truth of this settle.
        if (outcome === "full") return { ...settling, room: NO_ROOM, tally: counted(settling.tally, "full") }
        // The same value came in force meanwhile: the truth joined it, nothing was written over it.
        if (outcome === "joined") return settling
        // A rival value came in force from another source meanwhile, or the write failed: the truth is the founder's to decide.
        if (outcome === "raced" || outcome === "failed") return { ...settling, tally: counted(settling.tally, "asked") }
        return {
            room: taken(settling.room, bytes),
            tally: counted(settling.tally, "applied"),
            changed: [...settling.changed, fact.id],
        }
    }

    /**
     * WHOSE document it is, the one place that says so: the person whose approval published the text a PUBLIC document serves now
     * (`PublicDocumentsService.approverOf`: a public document is written and then approved, and the approver answers for it), else
     * the person who uploaded it. Null for a document nobody stands behind (a sync, an API key).
     */
    private async authorOf(source: SourceRecord): Promise<string | null> {
        return (await this.publicDocuments.approverOf(source.workspaceId, source.id)) ?? source.createdBy
    }

    /**
     * The member who stands behind the document (`authorOf`) when that person is a CURRENT, active member of the workspace in any role
     * (owner, manager or staff: owner 2026-11-12, every member's upload applies directly), else null: a document no member stands
     * behind (a sync, an API key, a person who left) keeps its truths as proposals for a person.
     */
    private async uploaderOf(source: SourceRecord): Promise<Uploader | null> {
        const author = await this.authorOf(source)
        if (author === null) return null
        try {
            const member = await this.members.require(author, source.workspaceId)
            return { name: member.displayName, role: member.role }
        } catch (cause) {
            // The membership check refuses anyone who is not an active member: that is the answer, not a failure.
            this.logger.info(FactReadingLogEvent.NotFounderDocument, { sourceId: source.id, refused: cause instanceof Error })
            return null
        }
    }

    /** The truths of the document that wait for a decision. */
    private waitingOf(source: SourceRecord): Promise<ReadonlyArray<FactRecord>> {
        return this.reads.ofSources(source.workspaceId, [source.id], ["proposed"], SETTLE_MAX)
    }

    /**
     * A truth about to go in force by itself is compared once more with the truths put in force since it was filed (TRIAGE-2,
     * `recheckBeforeForce`): the same truth with the same value already standing closes it as a duplicate (null: nothing more to do);
     * flagged with another value, its verdict is read again (an overlay of a standing value still applies; a contradiction is asked).
     */
    private async checkedBeforeForce(
        source: SourceRecord,
        fact: FactRecord,
        verdict: SettleVerdict,
        critique: PassageCritique,
        contested: ReadonlySet<string>,
        own: ReadonlySet<string>,
    ): Promise<{ readonly fact: FactRecord; readonly verdict: SettleVerdict } | null> {
        if (verdict !== "apply") return { fact, verdict }
        const again = await this.vectors.recheckBeforeForce(source.workspaceId, fact, own)
        if (again === "duplicate") return null
        if (again === "clear") return { fact, verdict }
        const flagged = (await this.facts.get(source.workspaceId, fact.id)) ?? fact
        return { fact: flagged, verdict: await this.verdictOf(source, flagged, critique, contested) }
    }

    /**
     * Joins a waiting truth to the value in force of its key when both state the same value (`sameValue`): the store adds its source
     * there and closes it. Applying it instead would write a new version OVER the value in force: harmless when the values are equal,
     * a silent replacement when the equality was misread. Answers whether it was joined.
     */
    private async joinedInForce(workspaceId: string, fact: FactRecord): Promise<boolean> {
        if (fact.proposalKind !== "set") return false
        const inForce = await this.facts.byKey(workspaceId, fact.subjectKey, fact.attribute, "active", fact.installationId)
        const same = inForce.find((other) => other.id !== fact.id && sameValue(valueLineOf(other), valueLineOf(fact)))
        if (same === undefined) return false
        return (await this.facts.mergeDuplicate(workspaceId, fact.id, same.id)) !== null
    }

    /** The verdict of one waiting truth of a member's document, from what stands for its key now. */
    private async verdictOf(
        source: SourceRecord,
        fact: FactRecord,
        critique: PassageCritique,
        contested: ReadonlySet<string>,
    ): Promise<SettleVerdict> {
        const key = [source.workspaceId, fact.subjectKey, fact.attribute] as const
        const others = await this.facts.byKey(...key, "proposed", fact.installationId)
        const inForce = await this.facts.byKey(...key, "active", fact.installationId)
        const sameAs = fact.conflictWith === null ? null : await this.facts.get(source.workspaceId, fact.conflictWith)
        const [current] = inForce
        const arguing = inForce.filter((other) => arguesWith(fact, other, true))
        const foreign = arguing.filter((other) => !putInForceBy(other, source.id))
        const waitingOnKey = others.filter((other) => other.id !== fact.id && other.proposalKind === "set")
        const labels = `${fact.subjectLabel} ${fact.attributeLabel}`
        const typeProblem =
            current !== undefined &&
            valueTypeProblemOf({ value: valueLineOf(current), labels }, { value: valueLineOf(fact), labels }) !== null
        return settleVerdictOf(fact, {
            sourceId: source.id,
            memberDocument: true,
            critique,
            rivals: waitingOnKey.filter((other) => arguesWith(fact, other, false)).length,
            inForce: foreign.length,
            updates: arguing.length > 0 && foreign.length === 0,
            conflictOnKey: [...waitingOnKey, ...inForce].some((other) => other.id === fact.conflictWith),
            sameAs,
            contested: contested.has(fact.id),
            typeProblem,
        })
    }

    /**
     * The guard of an automatic write, run under the workspace's in-force lock just before it (`InForceBoundService`, the race of two
     * documents settled at once): what is in force for the key is read AGAIN; the same value from another truth makes it join (when it
     * may: `mayJoin`), a value that argues with it and was not put there by this document makes it asked. Throws the `SettleLostRace` error; nothing is
     * written.
     */
    private guardOf(source: SourceRecord, fact: FactRecord, mayJoin: boolean): () => Promise<void> {
        return async () => {
            const inForce = await this.facts.byKey(source.workspaceId, fact.subjectKey, fact.attribute, "active", fact.installationId)
            const others = inForce.filter((other) => other.id !== fact.id)
            if (mayJoin && others.some((other) => sameValue(valueLineOf(other), valueLineOf(fact)))) throw lostRace("joined")
            if (others.some((other) => arguesWith(fact, other, true) && !putInForceBy(other, source.id))) throw lostRace("raced")
        }
    }

    /**
     * Puts one truth in force without announcing it, in the name of the decision's `uploader` (the member who stands behind the
     * document, or the founder whose answer decided it). A truth that goes in force by itself (`BOUNDED`) is written under the ceiling as the bound and with its
     * guard (`guardOf`): the store takes the in-force lock, runs the guard, checks the room and writes in one step, and refuses with
     * nothing written. Any other failed write is logged and the truth is left for the founder.
     */
    private async putInForce(decision: Decision): Promise<ForceOutcome> {
        const { source, fact, verdict, uploader: by } = decision
        try {
            const title = source.title.slice(0, 80)
            const notes: Partial<Record<SettleVerdict, string>> = {
                confirmed: `confirmed:${source.id} - The founder confirmed the critic's point about "${title}"`,
                corrected: `corrected:${source.id} - The founder's own value, answering the critic's point about "${title}"`,
                updated: `updated:${source.id} - The document "${title}" (${by.role} ${by.name}) was updated: it states a new value`,
            }
            const note = notes[verdict] ?? `direct:${source.id} - In force from the document "${title}" put in by ${by.role} ${by.name}`
            if (BOUNDED.has(verdict)) {
                const bound = { ...TRUTH_CEILING, guard: this.guardOf(source, fact, decision.mayJoin) }
                await this.facts.applyUnannounced(source.workspaceId, fact.id, by.name, note, bound)
            } else await this.facts.applyUnannounced(source.workspaceId, fact.id, by.name, note)
            return "applied"
        } catch (cause) {
            if (cause instanceof BrainFactsError && cause.code === BrainFactsErrorCode.InForceFull) return "full"
            if (cause instanceof BrainError && cause.code === BrainErrorCode.SettleLostRace) {
                return this.lostRace(source, fact, cause.params.outcome === "joined" ? "joined" : "raced")
            }
            this.logger.error(BrainLogEvent.BulkFactSkipped, cause, { factId: fact.id })
            return "failed"
        }
    }

    /** What a write the guard refused ends as: joined to the same value now in force (after the lock is released), else asked. */
    private async lostRace(source: SourceRecord, fact: FactRecord, outcome: "raced" | "joined"): Promise<ForceOutcome> {
        if (outcome === "joined" && (await this.joinedInForce(source.workspaceId, fact))) return "joined"
        return "raced"
    }

    /** Closes a truth that already stands under other words with the same value; a failed write leaves it waiting. */
    private async close(workspaceId: string, fact: FactRecord): Promise<void> {
        try {
            const note = `duplicate:${fact.conflictWith ?? ""} - The same truth with the same value already stands`
            await this.facts.reject(workspaceId, fact.id, "NIVO", note)
        } catch (cause) {
            this.logger.error(BrainLogEvent.BulkFactSkipped, cause, { factId: fact.id })
        }
    }
}
