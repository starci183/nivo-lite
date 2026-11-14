import { Injectable } from "@nestjs/common"
import { In, IsNull, type EntityManager, type FindOptionsWhere } from "typeorm"
import { WorkspaceTimeZoneService } from "@modules/domain/workspace-settings"
import { InjectClock, type Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { eachInOrder } from "@modules/platform/primitives"
import { BrainFactsMaintenanceService } from "./brain-facts-maintenance.service"
import { BrainFactsReadService } from "./brain-facts-read.service"
import { BrainFactsError, BrainFactsErrorCode } from "./errors/brain-facts.error"
import { toFactRecord } from "./fact-record.mapper"
import {
    normalFact,
    mergeEvidence,
    shopInstantOf,
    unitFormOf,
    unitOrNull,
    valueLineOf,
    type NormalFact,
    type UnitForm,
} from "./fact-input.policy"
import type { UnchangedPassages } from "./fact-evidence.policy"
import { AUTO_APPLY_TRUST, TRUST, numberOf, sameValue, valueTypeProblemOf } from "./fact-key.policy"
import {
    BRAIN_ACTOR,
    readersOfEvidence,
    readersOfNewValue,
    founderChoseReaders,
    reachNoteOf,
    widensReaders,
    type Readers,
} from "./fact-audience.policy"
import { windowMovedOf, windowsArgue } from "./fact-window.policy"
import type {
    Evidence,
    FactAudience,
    FactFilter,
    FactFlag,
    FactInput,
    FactReach,
    FactRecord,
    FactSource,
    FactStatus,
    InstallationScope,
    MaintenanceResult,
    MaybeFact,
    ProposeResult,
    WithdrawnFacts,
} from "./brain-facts.contracts"
import { RETURNED, factKeyOf, returnedFacts, type FactChanges, type NewFact } from "./fact-columns.policy"
import {
    DEFAULT_VALIDITY,
    SUPERSEDE,
    activateChanges,
    decisionOf,
    nextVersion,
    scheduleChanges,
} from "./fact-write.policy"
import { BrainFactRelationsService } from "./brain-fact-relations.service"
import { InForceBoundService } from "./in-force-bound.service"
import type { InForceBound } from "./in-force.policy"
import { BrainFactEntity } from "./persistence/entities"

/** Who acts for the brain itself when no person decides. */
const BRAIN = BRAIN_ACTOR

/** The statuses of a truth a duplicate of another key may join (`mergeDuplicate`): in force, scheduled for a later start, waiting. */
const JOINABLE: ReadonlySet<FactStatus> = new Set<FactStatus>(["active", "scheduled", "proposed"])

/** The note of a proposal approved after its stated end: it is kept as history and never comes in force. */
const ENDED_NOTE = "Recorded as history: its stated end had already passed"

/** The note of a waiting proposal another one was merged over (flag `same_meaning`). */
export const MERGED_NOTE = "Merged: the founder approved the same fact in other words"

/** The most facts in force (and turned-down lines) one audience repair reads (the list's own bound applies too). */
const REPAIR_MAX = 2000

/** Why a version widened its audience: a source read by a wider audience states the same value. */
const WIDER_EVIDENCE = "a source read by a wider audience states the same value"

/** The note of a proposal closed as a duplicate: the same truth with the same value in other words; its source joined that truth. */
const duplicateNoteOf = (into: FactRecord): string =>
    `Same truth, same value as "${into.subjectLabel} / ${into.attributeLabel}": its source was added there`

/** The note of a standing value that comes back after a time-boxed value ends (D-BR-18). */
const restoredNoteOf = (boxed: FactRecord): string => `Back in force after the time-boxed value "${boxed.value}" ends`

/** The audience of a fact. */
const readersOf = (fact: Pick<FactRecord, "scope" | "modules">): Readers => ({
    scope: fact.scope,
    modules: [...fact.modules],
})

/** The audience a writer states, or null when it states none (the truth it replaces then decides). */
const statedReadersOf = (input: Pick<FactInput, "scope" | "modules">): Readers | null =>
    input.scope === undefined
        ? null
        : { scope: input.scope, modules: input.scope === "restricted" ? [...(input.modules ?? [])] : [] }

/** Answers which of some document ids are public (what the audience repair asks the documents). */
export type PublicSourcesOf = (sourceIds: ReadonlyArray<string>) => Promise<ReadonlySet<string>>

/** The audience a founder's switch asks for: who may read, and which modules for a restricted fact. */
export type ReachChoice = Pick<FactReach, "scope" | "modules">

/** What a new version rests on: its evidence and trust. */
interface VersionSupport {
    /** What supports it. */
    readonly evidence: ReadonlyArray<Evidence>
    /** How far it is believed. */
    readonly trust: number
}

/** What a copied version changes from the row it copies. */
interface VersionOf {
    /** Its status: in force now, or scheduled for later. */
    readonly status: "active" | "scheduled"
    /** Who may read it. */
    readonly audience: Readers
    /** What supports it. */
    readonly evidence: ReadonlyArray<Evidence>
    /** How far it is believed. */
    readonly trust: number
    /** The fact it follows. */
    readonly supersedesId: string
    /** From when it holds, as an instant; null = now. */
    readonly validFrom: string | null
    /** Until when it holds, as an instant; null = the old row's end, else one year. */
    readonly validTo: string | null
    /** Its version number; null for a scheduled row (numbered when it comes in force). */
    readonly version: number | null
    /** Who decided it. */
    readonly decidedBy: string
    /** Why. */
    readonly note: string
}

/** A column of the old version, read in the same statement (its vector is copied, never recomputed). */
const copied = (column: string) => (): string =>
    `(SELECT o.${column} FROM public.brain_facts o WHERE o.workspace_id = :workspaceId AND o.id = :oldId)`

/** The number a stored value reads as, as the column keeps it. */
const valueNumberOf = (value: string): string | null => {
    const number = numberOf(value)
    return number === null ? null : String(number)
}

/** Whether two module lists name the same modules. */
const sameModules = (one: ReadonlyArray<string>, other: ReadonlyArray<string>): boolean =>
    one.length === other.length && one.every((module) => other.includes(module))

/** What one `propose` call works from: the input read once, the fact in force of its key, and the audience, trust and instant it needs. */
interface ProposeDoor {
    /** The workspace. */
    readonly workspaceId: string
    /** The input, its dates in the shop's clock. */
    readonly input: FactInput
    /** The subject and attribute as the store keys them. */
    readonly normal: NormalFact
    /** The value with its unit in the one stored form. */
    readonly form: UnitForm
    /** The value line (value and unit) the "same value" comparison reads. */
    readonly line: string
    /** The fact in force of the key and scope, when there is one. */
    readonly active: FactRecord | undefined
    /** The instance scope of the key (null = workspace-wide). */
    readonly scopeId: string | null
    /** The audience the writer states, or null. */
    readonly stated: Readers | null
    /** What supports the value. */
    readonly evidence: ReadonlyArray<Evidence>
    /** How far the source is believed. */
    readonly trust: number
    /** The shop's now, in milliseconds. */
    readonly nowMs: number
}

/**
 * What a new value disagrees with, read with the periods (date arithmetic): the value in force when the two argue (a value stated for a
 * period over the standing one, or beside a period it does not overlap, disagrees with nothing: a seasonal price is not a contradiction
 * of the everyday one); else the newest other waiting value it argues with (`values` is newest first). Null when it disagrees with
 * nothing. The one value in force per key and scope is unchanged: that is the store's unique index, not this name.
 */
const rivalOf = (door: ProposeDoor, values: ReadonlyArray<FactRecord>): string | null => {
    const dates = { validFrom: door.input.validFrom ?? null, validTo: door.input.validTo ?? null }
    const arguedInForce = door.active !== undefined && windowsArgue(dates, door.active, true) ? door.active : undefined
    const arguedWaiting = values.find((other) => windowsArgue(dates, other, false) || windowsArgue(other, dates, false))
    return arguedInForce?.id ?? arguedWaiting?.id ?? null
}

/** A note, trimmed; null when it says nothing. */
const noteOrNull = (note: string | undefined): string | null => {
    const trimmed = note?.trim()
    return trimmed === undefined || trimmed === "" ? null : trimmed
}

/**
 * Who listens to the facts store: the derived policy layer (PO2) and the vectors of the facts in force (`FactEmbeddingsService`: a
 * value that comes in force gets its vector here, whatever door wrote it). It is told AFTER a write committed that what is in force in
 * a workspace changed: a value applied (or scheduled), retired, taken over at its start, expired, or given another reach. It must never
 * throw: the write already stands, and the listener records its own failure.
 */
export interface FactsChangedHook {
    /**
     * What is in force changed in the workspace; `changedIds` are the facts the write produced (the value now in force or scheduled, the
     * retired one, the next version of a new reach, the values that took over at their start), so a listener whose work is per fact
     * (the vectors) touches only those, and one that compares the whole workspace (the policy layer) may ignore them.
     */
    factsChanged(workspaceId: string, changedIds: ReadonlyArray<string>): Promise<void>
}

@Injectable()
/**
 * The facts of a workspace. Exactly one ACTIVE fact per subject, attribute and scope: applying a new value supersedes the old one,
 * which is kept as history; the same value again only adds evidence; a different value from a source below the auto-apply trust is a
 * proposal that names the fact it disagrees with; nothing is ever deleted, a wrong fact is rejected or retired.
 */
export class BrainFactsService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectClock() private readonly clock: Clock,
        private readonly reads: BrainFactsReadService,
        private readonly maintenance: BrainFactsMaintenanceService,
        private readonly relations: BrainFactRelationsService,
        private readonly bounds: InForceBoundService,
        private readonly zones: WorkspaceTimeZoneService,
    ) {}

    /** The listeners told when what is in force changes; none until one registers (an app without the brain module). */
    private readonly changeHooks: Array<FactsChangedHook> = []

    /**
     * Registers a listener of fact changes (the derived policy layer and the fact vectors register themselves when their module
     * starts); the same listener twice is kept once.
     */
    whenChanged(hook: FactsChangedHook): void {
        if (!this.changeHooks.includes(hook)) this.changeHooks.push(hook)
    }

    /**
     * Tells every listener, after the write, one after the other; answers whether one was told. A listener that fails all the same
     * never fails the write nor the next listener: it logs its own failure, and its next pass compares the whole workspace.
     */
    private async announce(workspaceId: string, changedIds: ReadonlyArray<string>): Promise<boolean> {
        const ids = [...new Set(changedIds)]
        await eachInOrder(this.changeHooks, (hook) =>
            Promise.resolve()
                .then(() => hook.factsChanged(workspaceId, ids))
                .then(
                    () => undefined,
                    () => undefined,
                ),
        )
        return this.changeHooks.length > 0
    }

    /** The fact a write that changed what is in force produced, announced (with its id) once the write committed. */
    private async announced(workspaceId: string, write: Promise<FactRecord>): Promise<FactRecord> {
        const done = await write
        await this.announce(workspaceId, [done.id])
        return done
    }

    /**
     * Tells every listener ONCE that these facts changed: the closing call of a caller that applied many facts with `applyUnannounced`
     * (the bulk apply of a document), so N facts are one announcement, never N. Nothing for no fact.
     */
    async announceChanged(workspaceId: string, changedIds: ReadonlyArray<string>): Promise<void> {
        if (changedIds.length > 0) await this.announce(workspaceId, changedIds)
    }

    /** One fact of the workspace. */
    get(workspaceId: string, id: string): Promise<MaybeFact> {
        return this.reads.get(workspaceId, id)
    }

    /** The facts of the workspace, newest change first. */
    list(workspaceId: string, filter: FactFilter): Promise<ReadonlyArray<FactRecord>> {
        return this.reads.list(workspaceId, filter)
    }

    /** The facts of a key in one status and scope. */
    byKey(
        workspaceId: string,
        subjectKey: string,
        attribute: string,
        status: FactStatus,
        installationId: InstallationScope,
    ): Promise<ReadonlyArray<FactRecord>> {
        return this.reads.byKey(workspaceId, subjectKey, attribute, status, installationId)
    }

    /** The active facts one agent may use right now: in force and inside its view. */
    forView(
        workspaceId: string,
        audience: FactAudience,
        module: string,
        installationId: InstallationScope,
        limit: number,
    ): Promise<ReadonlyArray<FactRecord>> {
        return this.reads.forView(workspaceId, audience, module, installationId, limit)
    }

    /** The facts of a view that match a question, best first. */
    search(
        workspaceId: string,
        audience: FactAudience,
        module: string,
        installationId: InstallationScope,
        query: string,
        limit: number,
    ): Promise<ReadonlyArray<FactRecord>> {
        return this.reads.search(workspaceId, audience, module, installationId, query, limit)
    }

    /**
     * Records what a source says. The same value AND the same validity window as the active fact only grows its evidence (a stated new
     * end, or a later start, is a change: the next version with the same value, `windowMovedOf`); the same value as a waiting proposal grows
     * that proposal; otherwise a new row: applied at once from a trusted source (or when `autoApply`), else a proposal naming what it
     * disagrees with: the active fact it would replace, or, with no value in force, the newest other value waiting for the same key (so
     * two documents that disagree make ONE choice for the founder, never two silent proposals). A value whose stated end has already
     * passed is never applied at once: it is a proposal flagged `stale`. The value and its unit (the caller's, else the fact in force's)
     * are stored in the one normal form (`unitFormOf`: the value never says its unit again), and "the same value" compares the values
     * with their units, so every door (the policy tab, a chat change request, a document) writes and matches alike.
     *
     * The rules every door shares, held HERE once: a date with no time is the start of that day in the shop's clock (`shopInstantOf`,
     * D-BR-16); no code reads a line for whether it addresses an AI (owner 2026-11-12: no word list decides what a text means; the readings
     * are told documents are data, and the critic's security read flags such text); a value written straight into force must read as the type
     * of the truth it replaces (`valueTypeProblemOf`, D-BR-12); and who may read the truth follows the evidence (`readersOfEvidence`,
     * D-BR-1): the same value from a source read by a wider audience makes the NEXT VERSION with that audience (never a silent narrowing),
     * and a new value keeps the audience of the truth it replaces, widened by its own source's.
     */
    async propose(workspaceId: string, raw: FactInput): Promise<ProposeResult> {
        const timeZone = await this.zones.timeZoneOf(workspaceId)
        const input: FactInput = {
            ...raw,
            validFrom: shopInstantOf(raw.validFrom, timeZone),
            validTo: shopInstantOf(raw.validTo, timeZone),
        }
        const normal = normalFact(input)
        if (normal === null) throw new BrainFactsError({ code: BrainFactsErrorCode.FactIncomplete })
        const scopeId = input.installationId ?? null
        const [active] = await this.reads.keyed(
            this.entityManager,
            workspaceId,
            normal.subjectKey,
            normal.attribute,
            "active",
            scopeId,
        )
        const form = unitFormOf({ value: normal.value, unit: unitOrNull(input.unit) ?? active?.unit ?? null })
        const door: ProposeDoor = {
            workspaceId,
            input,
            normal,
            form,
            line: valueLineOf(form),
            active,
            scopeId,
            stated: statedReadersOf(input),
            evidence: input.evidence ?? [],
            trust: TRUST[input.sourceKind],
            nowMs: this.clock.now().getTime(),
        }
        // The same value with a moved validity window (a new end, a later start) is a CHANGE: the next version, never "reinforced".
        if (active !== undefined && sameValue(valueLineOf(active), door.line) && !windowMovedOf(active, input, door.nowMs))
            return this.reinforce(door, active)
        const proposals = await this.reads.keyed(
            this.entityManager,
            workspaceId,
            normal.subjectKey,
            normal.attribute,
            "proposed",
            scopeId,
        )
        const values = proposals.filter((proposal) => proposal.proposalKind === "set")
        const waiting = values.find(
            (proposal) => sameValue(valueLineOf(proposal), door.line) && !windowMovedOf(proposal, input, door.nowMs),
        )
        const stale = this.ended(input.validTo ?? null)
        const direct = !stale && (input.autoApply ?? door.trust >= AUTO_APPLY_TRUST)
        if (waiting !== undefined) return this.growWaiting(door, waiting, direct)
        if (direct && active !== undefined) this.refuseOtherType(active, normal, door.line)
        return this.fileValue(door, rivalOf(door, values), stale, direct)
    }

    /**
     * The same value as the one in force again: a source confirms it, so its evidence grows (and its audience widens when the source is
     * read by more people), and a waiting proposal to stop using it no longer holds.
     */
    private async reinforce(door: ProposeDoor, active: FactRecord): Promise<ProposeResult> {
        const { workspaceId, normal, evidence, scopeId } = door
        const fact = await this.confirmed(workspaceId, active, door.stated, door.input.sourceKind, evidence, door.trust)
        // A source confirms the value again: a waiting proposal to stop using it no longer holds.
        if (evidence.length > 0) {
            await this.entityManager.update(
                BrainFactEntity,
                {
                    ...factKeyOf(workspaceId, normal.subjectKey, normal.attribute, scopeId),
                    status: "proposed",
                    proposalKind: "retire",
                },
                decisionOf("rejected", "A source confirmed this value again"),
            )
        }
        return { fact, outcome: "reinforced" }
    }

    /** The same value as a waiting proposal: it grows that proposal's evidence, and is applied when the door applies at once. */
    private async growWaiting(door: ProposeDoor, waiting: FactRecord, direct: boolean): Promise<ProposeResult> {
        const reach = readersOfEvidence(door.stated, waiting, door.input.sourceKind)
        const fact = await this.grow(
            this.entityManager,
            door.workspaceId,
            waiting,
            door.evidence,
            door.trust,
            widensReaders(readersOf(waiting), reach) ? reach : undefined,
        )
        if (direct)
            return { fact: await this.apply(door.workspaceId, fact.id, door.input.proposedBy), outcome: "applied" }
        return { fact, outcome: door.active === undefined && fact.conflictWith === null ? "proposed" : "conflict" }
    }

    /** A new row for a value no fact or proposal of the key holds: applied at once when `direct`, else a proposal naming its rival. */
    private async fileValue(
        door: ProposeDoor,
        rival: string | null,
        stale: boolean,
        direct: boolean,
    ): Promise<ProposeResult> {
        const { workspaceId, input, normal, form, active } = door
        // A new value for a known fact keeps that fact's type and unit unless the caller says otherwise. Its AUDIENCE is its own source's
        // (`readersOfNewValue`): a value from an internal-area document never inherits the public audience of the value it replaces.
        const reach = readersOfNewValue(door.stated, active ?? null, input.sourceKind)
        const scope = reach.scope
        // What the brain noticed (`stale`) and what the reading that files it states about it (`period_unclear`; migration 20261112022200).
        const noticed: ReadonlyArray<FactFlag> = stale ? ["stale"] : []
        const flags: Array<FactFlag> = [...new Set<FactFlag>([...noticed, ...(input.flags ?? [])])]
        const fact = await this.insert(this.entityManager, {
            workspaceId,
            subjectType: input.subjectType ?? active?.subjectType ?? "business",
            subjectKey: normal.subjectKey,
            subjectLabel: normal.subjectLabel,
            attribute: normal.attribute,
            attributeLabel: normal.attributeLabel,
            value: form.value,
            valueNumber: valueNumberOf(form.value),
            unit: form.unit,
            scope,
            modules: scope === "restricted" ? [...reach.modules] : [],
            sourceKind: input.sourceKind,
            trust: door.trust,
            validFrom: input.validFrom ?? null,
            validTo: input.validTo ?? null,
            conflictWith: rival,
            evidence: door.evidence,
            proposedBy: input.proposedBy,
            installationId: door.scopeId,
            proposalKind: "set",
            // What the brain noticed (`stale`) and what the reading that files it states about it (`period_unclear`; migration 20261112022200).
            ...(flags.length === 0 ? {} : { reviewFlags: flags }),
        })
        if (direct) {
            return { fact: await this.apply(workspaceId, fact.id, input.proposedBy), outcome: "applied", created: true }
        }
        return { fact, outcome: rival === null ? "proposed" : "conflict", created: true }
    }

    /**
     * A value written straight into force must read as the type of the value it replaces (D-BR-12): "maybe" on a yes/no rule, "abc" on a
     * money rule are refused with the policy tab's own problem code (`params.problem`), whatever door wrote them. A value that only waits
     * for the founder is not refused: he sees it beside the value in force.
     */
    private refuseOtherType(
        active: FactRecord,
        normal: Pick<NormalFact, "subjectLabel" | "attributeLabel">,
        line: string,
    ): void {
        const problem = valueTypeProblemOf(
            { value: valueLineOf(active), labels: `${active.subjectLabel} ${active.attributeLabel}` },
            { value: line, labels: `${normal.subjectLabel} ${normal.attributeLabel}` },
        )
        if (problem !== null)
            throw new BrainFactsError({ code: BrainFactsErrorCode.ValueNotOfType, params: { problem } })
    }

    /**
     * A source states the value in force again: its evidence is added and the trust lifted to the source's when higher. When the source
     * is read by a WIDER audience than the truth (a public document repeats an internal truth: D-BR-1), the truth becomes the next version
     * with the wider audience, decided by the brain, so the history shows why (the old version is superseded and kept, its vector copied,
     * its relations carried, the values waiting for the key take the new audience) and the change is announced. A narrower source never
     * narrows it.
     */
    private confirmed(
        workspaceId: string,
        active: FactRecord,
        stated: Readers | null,
        sourceKind: FactSource,
        evidence: ReadonlyArray<Evidence>,
        trust: number,
    ): Promise<FactRecord> {
        const reach = readersOfEvidence(stated, active, sourceKind)
        if (!widensReaders(readersOf(active), reach) || founderChoseReaders(active))
            return this.grow(this.entityManager, workspaceId, active, evidence, trust)
        return this.announced(
            workspaceId,
            this.entityManager.transaction((tx) =>
                this.reachTx(tx, workspaceId, active, reach, BRAIN, reachNoteOf(active, reach, WIDER_EVIDENCE), {
                    evidence: mergeEvidence(active.evidence, evidence),
                    trust: Math.max(active.trust, trust),
                }),
            ),
        )
    }

    /**
     * Closes a waiting proposal the same-meaning judgement found to be the SAME truth with the SAME value as another fact of another key
     * (a duplicate in other words; D-BR-9): its evidence joins that fact (in force: `confirmed`, which widensReaders the audience when the
     * duplicate's source is read by more people; waiting, or SCHEDULED for a later start: grown in place, a wider audience included:
     * neither has a version in force whose history must be kept) and the duplicate is turned down saying where it went. Nothing is
     * asked of the founder: one truth, one value. Answers the fact that holds the truth now, or null when either side was decided meanwhile.
     * A scheduled truth joins only through this door (Round W, D-W-2: the same dated window stated by a second document was scheduled
     * a second time); the change of a scheduled truth is announced, so its point in the vector index follows its audience.
     */
    async mergeDuplicate(workspaceId: string, id: string, intoId: string): Promise<MaybeFact> {
        if (id === intoId) return null
        const [duplicate, into] = await Promise.all([this.get(workspaceId, id), this.get(workspaceId, intoId)])
        if (duplicate?.status !== "proposed" || duplicate.proposalKind !== "set") return null
        if (into?.proposalKind !== "set" || !JOINABLE.has(into.status)) return null
        await this.reject(workspaceId, id, BRAIN, duplicateNoteOf(into))
        const stated = readersOf(duplicate)
        if (into.status === "active")
            return this.confirmed(workspaceId, into, stated, duplicate.sourceKind, duplicate.evidence, duplicate.trust)
        const reach = readersOfEvidence(stated, into, duplicate.sourceKind)
        const grown = this.grow(
            this.entityManager,
            workspaceId,
            into,
            duplicate.evidence,
            duplicate.trust,
            widensReaders(readersOf(into), reach) ? reach : undefined,
        )
        return into.status === "scheduled" ? this.announced(workspaceId, grown) : grown
    }

    /**
     * Gives back to customers the truths a public source states that an older build left internal (D-BR-1 on data written before the
     * rule): (1) a truth in force whose evidence names a public document; (2) a truth in force a public proposal was merged into
     * ("Merged...", decided in the same instant by the same person), which also takes the merged line's evidence. Each becomes the next
     * version with the wider audience, decided by the brain; a truth whose audience the founder set with the switch is left alone. Run by
     * `maintainBrain`; idempotent (a truth already public is skipped). `publicOf` answers which of some document ids are public. Answers
     * the facts that widened.
     */
    async repairAudience(
        workspaceId: string,
        publicOf: PublicSourcesOf,
    ): Promise<ReadonlyArray<FactRecord>> {
        const [inForce, rejected] = await Promise.all([
            this.reads.list(workspaceId, { statuses: ["active"], limit: REPAIR_MAX }),
            this.reads.list(workspaceId, { statuses: ["rejected"], limit: REPAIR_MAX }),
        ])
        const narrow = inForce.filter((fact) => fact.scope !== "public" && !founderChoseReaders(fact))
        const sourceIds = [
            ...new Set(
                narrow.flatMap((fact) =>
                    fact.evidence.flatMap((item) =>
                        item.kind === "document" && item.sourceId !== undefined ? [item.sourceId] : [],
                    ),
                ),
            ),
        ]
        const open = sourceIds.length === 0 ? new Set<string>() : await publicOf(sourceIds)
        const plans = new Map<string, { readonly fact: FactRecord; readonly evidence: Array<Evidence> }>()
        narrow
            .filter((fact) => fact.evidence.some((item) => item.sourceId !== undefined && open.has(item.sourceId)))
            .forEach((fact) => plans.set(fact.id, { fact, evidence: [] }))
        rejected
            .filter((loser) => loser.decisionNote === MERGED_NOTE && loser.scope === "public")
            .forEach((loser) => {
                const winner = narrow.find(
                    (fact) =>
                        fact.decidedAt !== null &&
                        fact.decidedAt === loser.decidedAt &&
                        fact.decidedBy === loser.decidedBy &&
                        (fact.subjectKey !== loser.subjectKey || fact.attribute !== loser.attribute),
                )
                if (winner === undefined) return
                const plan = plans.get(winner.id) ?? { fact: winner, evidence: [] }
                plans.set(winner.id, { fact: winner, evidence: [...plan.evidence, ...loser.evidence] })
            })
        const widened: Array<FactRecord> = []
        await eachInOrder([...plans.values()], async ({ fact, evidence }) => {
            const to: Readers = { scope: "public", modules: [] }
            widened.push(
                await this.entityManager.transaction((tx) =>
                    this.reachTx(tx, workspaceId, fact, to, BRAIN, reachNoteOf(fact, to, WIDER_EVIDENCE), {
                        evidence: mergeEvidence(fact.evidence, evidence),
                        trust: fact.trust,
                    }),
                ),
            )
        })
        await this.announceChanged(
            workspaceId,
            widened.map((fact) => fact.id),
        )
        return widened
    }

    /**
     * The next version of a truth in force with another audience, decided by `decidedBy` with `note`, in a transaction of its own:
     * the one audience door (`reachTx`) as a document's move uses it (`BrainFactAreasService`). The caller announces. Answers it.
     */
    reachFor(workspaceId: string, fact: FactRecord, to: Readers, decidedBy: string, note: string): Promise<FactRecord> {
        return this.entityManager.transaction((tx) =>
            this.reachTx(tx, workspaceId, fact, to, decidedBy, note, { evidence: fact.evidence, trust: fact.trust }),
        )
    }

    /**
     * Files the model's judgement that a waiting proposal says the SAME fact as another one in other words (another subject or attribute
     * label): the proposal is flagged `same_meaning` and names that fact in `conflictWith`, for the founder; nothing is merged here. Only a
     * proposal that still waits and disagrees with nothing is flagged. Answers whether it was.
     */
    async flagSameMeaning(workspaceId: string, id: string, sameAsId: string): Promise<boolean> {
        if (id === sameAsId) return false
        const updated = await this.entityManager
            .createQueryBuilder(BrainFactEntity, "bf")
            .update()
            .set({ conflictWith: sameAsId, reviewFlags: () => "array_append(review_flags, 'same_meaning')" })
            .where({ workspaceId, id, status: "proposed", proposalKind: "set", conflictWith: IsNull() })
            .execute()
        return (updated.affected ?? 0) > 0
    }

    /**
     * The founder keeps both values (FX5, "Giu ca hai" on a change card): a waiting proposal flagged `same_meaning` no longer names the
     * fact of the other truth, so approving it merges nothing. Answers whether it was a flagged proposal still waiting.
     */
    async keepApart(workspaceId: string, id: string): Promise<boolean> {
        const updated = await this.entityManager
            .createQueryBuilder(BrainFactEntity, "bf")
            .update()
            .set({ conflictWith: null, reviewFlags: () => "array_remove(review_flags, 'same_meaning')" })
            .where({ workspaceId, id, status: "proposed" })
            .andWhere("'same_meaning' = ANY(review_flags)")
            .execute()
        return (updated.affected ?? 0) > 0
    }

    /**
     * Approves a proposal. Valid from now (or undated) it becomes the active fact, the next version of its key, holding for one year
     * unless its end was stated; the current one is superseded and its relations are carried to the new value. Valid from a later date
     * it is scheduled and the current value stays in force until then. Approving a proposal to stop using a fact retires that fact.
     * A proposal whose stated end has passed is recorded as history (expired) and never comes in force. A proposal flagged
     * `same_meaning` merges: the fact of the other key it names is replaced too (superseded with its relations carried, or, still
     * waiting, rejected). Who may approve is the caller's to check: the Second Brain page lets the founder alone.
     */
    apply(workspaceId: string, id: string, decidedBy: string, note?: string): Promise<FactRecord> {
        return this.announced(workspaceId, this.applyUnannounced(workspaceId, id, decidedBy, note))
    }

    /**
     * `apply` without the announcement: for a caller that applies many facts in a row and then calls `announceChanged` once with their
     * ids (one vector batch and one policy request for the whole batch instead of one per fact). The caller MUST announce.
     * With `bound` (the automatic path of a document's truths) the write is checked against it in the same step (`InForceBoundService`).
     */
    applyUnannounced(workspaceId: string, id: string, decidedBy: string, note?: string, bound?: InForceBound): Promise<FactRecord> {
        return this.entityManager.transaction((tx) => this.bounds.within(tx, workspaceId, bound, () => this.applyIn(tx, workspaceId, id, decidedBy, note)))
    }

    /** The apply itself, in the caller's transaction. */
    private async applyIn(tx: EntityManager, workspaceId: string, id: string, decidedBy: string, note?: string): Promise<FactRecord> {
        const fact = await this.reads.fetch(tx, workspaceId, id)
        if (fact === null) throw new BrainFactsError({ code: BrainFactsErrorCode.FactNotFound })
        if (fact.status !== "proposed") throw new BrainFactsError({ code: BrainFactsErrorCode.NotProposed })
        const [current] = await this.reads.keyed(tx, workspaceId, fact.subjectKey, fact.attribute, "active", fact.installationId)
        const reason = noteOrNull(note)
        if (fact.proposalKind === "retire") {
            if (current !== undefined)
                await this.stop(tx, workspaceId, current.id, decidedBy, reason ?? "No source supports this value any more")
            return this.changed(
                tx,
                { workspaceId, id, status: "proposed" },
                decisionOf("expired", reason ?? "Stopped using", decidedBy),
                BrainFactsErrorCode.NotProposed,
            )
        }
        if (this.ended(fact.validTo)) {
            return this.changed(
                tx,
                { workspaceId, id, status: "proposed" },
                decisionOf("expired", reason ?? ENDED_NOTE, decidedBy),
                BrainFactsErrorCode.NotProposed,
            )
        }
        const merged = await this.mergedOf(tx, workspaceId, fact, current?.id ?? null)
        if (merged?.status === "proposed") {
            await this.changed(
                tx,
                { workspaceId, id: merged.id, status: "proposed" },
                decisionOf("rejected", MERGED_NOTE, decidedBy),
                BrainFactsErrorCode.NotProposed,
            )
        }
        const replaced = [current, merged?.status === "active" ? merged : undefined].filter(
            (one): one is FactRecord => one !== undefined,
        )
        // The value a window stands over (D-BR-18 overlay): the value in force of its key, else the truth of another key the
        // same-meaning judgement merged it over (D-N-5: "Delivery fee, branch 1 (Tet season)" over "Delivery fee, branch 1"), which comes back after it.
        const standing = current ?? (merged?.status === "active" ? merged : undefined)
        // One truth, one audience: the values it replaces and the line merged over it are all read by the union (D-BR-1), unless
        // the founder set their audience himself; the merged line's evidence joins it.
        await this.reshaped(tx, workspaceId, fact, replaced, merged)
        const shaped = (await this.reads.fetch(tx, workspaceId, id)) ?? fact
        if (shaped.validFrom !== null && Date.parse(shaped.validFrom) > this.clock.now().getTime()) {
            const scheduled = await this.schedule(tx, workspaceId, shaped, replaced, decidedBy, reason)
            await this.restoreAfter(tx, workspaceId, standing, scheduled, decidedBy, fact.validTo !== null)
            return scheduled
        }
        await eachInOrder(replaced, (old) =>
            tx.update(BrainFactEntity, { workspaceId, id: old.id, status: "active" }, SUPERSEDE),
        )
        const [first] = replaced
        const activated = await this.changed(
            tx,
            { workspaceId, id, status: "proposed" },
            activateChanges(first?.id ?? null, decidedBy, reason, nextVersion(first)),
            BrainFactsErrorCode.NotProposed,
        )
        await eachInOrder(replaced, (old) => this.relations.carry(tx, workspaceId, old.id, id))
        await this.restoreAfter(tx, workspaceId, standing, activated, decidedBy, fact.validTo !== null)
        return activated
    }

    /**
     * A proposal about to come in force takes the audience of the truth it continues (D-BR-1): the union of its own and that of every
     * value it replaces or merges over (`readersOfEvidence`: the founder's own statement or switch wins), and the evidence of the line
     * merged over it. One statement, nothing when nothing changes.
     */
    private async reshaped(
        tx: EntityManager,
        workspaceId: string,
        fact: FactRecord,
        replaced: ReadonlyArray<FactRecord>,
        merged: FactRecord | null,
    ): Promise<void> {
        const reach = [...replaced, ...(merged === null || replaced.includes(merged) ? [] : [merged])].reduce(
            (sum: Readers, old) => readersOfEvidence(sum, old, fact.sourceKind),
            readersOf(fact),
        )
        const evidence = merged === null ? fact.evidence : mergeEvidence(fact.evidence, merged.evidence)
        const wider = widensReaders(readersOf(fact), reach)
        if (!wider && evidence.length === fact.evidence.length) return
        await tx
            .createQueryBuilder(BrainFactEntity, "bf")
            .update()
            .set({
                ...(wider ? { scope: reach.scope, modules: [...reach.modules] } : {}),
                evidence: () => ":evidence::jsonb",
            })
            .where({ workspaceId, id: fact.id, status: "proposed" })
            .setParameters({ evidence: JSON.stringify(evidence) })
            .execute()
    }

    /**
     * A time-boxed value over a standing one is an OVERLAY (D-BR-18, a holiday surcharge window): when a value with a stated end replaces a
     * value in force that holds longer (or with no end), the standing value is scheduled to come back at the window's end, until its own
     * end, as the next version after the window (same value, audience, source, evidence; its vector copied). The upkeep tick puts it in
     * force when the window ends, as any scheduled value. Nothing when the new value states no end (it replaces for good) or outlasts the
     * standing one. A newer schedule of the key replaces this plan like any other (`schedule`).
     */
    private async restoreAfter(
        tx: EntityManager,
        workspaceId: string,
        standing: FactRecord | undefined,
        boxed: FactRecord,
        decidedBy: string,
        statedEnd: boolean,
    ): Promise<void> {
        // `standing` is the value in force as it was read before the write (its own end, not the one the write gave it).
        const windowEnd = boxed.validTo
        if (standing === undefined || !statedEnd || boxed.proposalKind !== "set" || windowEnd === null) return
        const standingEnd = standing.validTo
        if (standingEnd !== null && Date.parse(standingEnd) <= Date.parse(windowEnd)) return
        await this.copyVersion(tx, workspaceId, standing, {
            status: "scheduled",
            audience: readersOf(standing),
            evidence: standing.evidence,
            trust: standing.trust,
            supersedesId: boxed.id,
            validFrom: windowEnd,
            validTo: standingEnd,
            version: null,
            decidedBy,
            note: restoredNoteOf(boxed),
        })
    }

    /**
     * The fact of another key a `same_meaning` proposal merges over: the truth it names as it stands NOW (D-BR-4a). Still in force or
     * waiting: that fact. Replaced since (another value of its key came in force while this one waited): the value of its key in force
     * now, so approving the proposal is a CHANGE of that truth and never a second value beside it. Null for any other proposal, or when
     * the truth has no value in force or waiting any more.
     */
    private async mergedOf(
        tx: EntityManager,
        workspaceId: string,
        fact: FactRecord,
        currentId: string | null,
    ): Promise<FactRecord | null> {
        const other = fact.conflictWith
        if (!(fact.flags ?? []).includes("same_meaning") || other === null || other === currentId) return null
        const found = await this.reads.fetch(tx, workspaceId, other)
        if (found === null) return null
        if (found.status === "active" || found.status === "proposed") return found
        if (found.status !== "superseded") return null
        const [now] = await this.reads.keyed(
            tx,
            workspaceId,
            found.subjectKey,
            found.attribute,
            "active",
            found.installationId,
        )
        const sameKey = now?.subjectKey === fact.subjectKey && now.attribute === fact.attribute
        return now === undefined || now.id === currentId || now.id === fact.id || sameKey ? null : now
    }

    /** Whether a stated end has already passed. */
    private ended(validTo: string | null): boolean {
        return validTo !== null && Date.parse(validTo) <= this.clock.now().getTime()
    }

    /** Turns a proposal down; it stays in the history with the reason. */
    reject(workspaceId: string, id: string, decidedBy: string, note?: string): Promise<FactRecord> {
        return this.changed(
            this.entityManager,
            { workspaceId, id, status: "proposed" },
            decisionOf("rejected", noteOrNull(note), decidedBy),
            BrainFactsErrorCode.NotProposed,
        )
    }

    /** Stops an active fact without a replacement (no longer true): it expires now. */
    retire(workspaceId: string, id: string, decidedBy: string, note?: string): Promise<FactRecord> {
        return this.announced(
            workspaceId,
            this.stop(this.entityManager, workspaceId, id, decidedBy, noteOrNull(note)),
        )
    }

    /**
     * Changes who reads the value in force; the value stays (the owner's "customers may know" switch on the policy tab). The next version
     * of the fact: same key, instance, value, unit, source, trust, end and evidence, the new scope (modules only for `restricted`), valid
     * from now, decided by the caller; the old row is superseded and kept, so the history shows who read each version. Its relations are
     * carried and its vector copied (the embedded line holds no audience: no embedding call; an old row with no vector copies none, and
     * the vectors listener then copies one of the same line or embeds it once). The values of the key not yet in force (the
     * scheduled one, the waiting ones) take the new reach too and point at the new version, so approving one later does not undo the
     * switch. The same reach writes nothing and answers the fact. Who may call it is the caller's to check: the workspace owner alone.
     */
    setReach(
        workspaceId: string,
        factId: string,
        reach: ReachChoice,
        decidedBy: string,
    ): Promise<FactRecord> {
        return this.announced(
            workspaceId,
            this.entityManager.transaction(async (tx) => {
                const old = await this.reads.fetch(tx, workspaceId, factId)
                if (old === null) throw new BrainFactsError({ code: BrainFactsErrorCode.FactNotFound })
                if (old.status !== "active" || this.ended(old.validTo))
                    throw new BrainFactsError({ code: BrainFactsErrorCode.NotActive })
                const to: Readers = {
                    scope: reach.scope,
                    modules: reach.scope === "restricted" ? [...new Set(reach.modules)] : [],
                }
                if (old.scope === to.scope && sameModules(old.modules, to.modules)) return old
                return this.reachTx(tx, workspaceId, old, to, decidedBy, reachNoteOf(old, to), {
                    evidence: old.evidence,
                    trust: old.trust,
                })
            }),
        )
    }

    /**
     * The next version of a fact in force with another audience, in the caller's transaction: the old row is superseded and kept, the new
     * one carries the same key, instance, value, unit, source and end with the given evidence and trust, valid from now, its vector
     * copied and its relations carried; the values of the key not yet in force take the new audience and point at the new version. The
     * one write behind the founder's switch (`setReach`) and the brain's widening on wider evidence (`confirmed`, `repairAudience`).
     */
    private async reachTx(
        tx: EntityManager,
        workspaceId: string,
        old: FactRecord,
        to: Readers,
        decidedBy: string,
        note: string,
        support: VersionSupport,
    ): Promise<FactRecord> {
        // The one-active index: the old version leaves force before the new one is written.
        await this.changed(tx, { workspaceId, id: old.id, status: "active" }, SUPERSEDE, BrainFactsErrorCode.NotActive)
        const fact = await this.copyVersion(tx, workspaceId, old, {
            status: "active",
            audience: to,
            evidence: support.evidence,
            trust: support.trust,
            supersedesId: old.id,
            validFrom: null,
            validTo: old.validTo,
            version: nextVersion(old),
            decidedBy,
            note,
        })
        await this.relations.carry(tx, workspaceId, old.id, fact.id)
        const key = factKeyOf(workspaceId, old.subjectKey, old.attribute, old.installationId)
        await tx.update(
            BrainFactEntity,
            { ...key, status: In(["scheduled", "proposed"]) },
            { scope: to.scope, modules: [...to.modules] },
        )
        await tx.update(
            BrainFactEntity,
            { workspaceId, status: "scheduled", supersedesId: old.id },
            { supersedesId: fact.id },
        )
        await tx.update(
            BrainFactEntity,
            { workspaceId, status: "proposed", conflictWith: old.id },
            { conflictWith: fact.id },
        )
        return fact
    }

    /** Chooses one of several competing proposals: it is applied and every other waiting proposal of the key is rejected. */
    async choose(workspaceId: string, id: string, decidedBy: string): Promise<FactRecord> {
        const winner = await this.get(workspaceId, id)
        if (winner?.status !== "proposed") throw new BrainFactsError({ code: BrainFactsErrorCode.NotProposed })
        if (winner.proposalKind !== "set") throw new BrainFactsError({ code: BrainFactsErrorCode.NotAValue })
        const fact = await this.apply(workspaceId, id, decidedBy, "Chosen among several different values")
        const others = await this.byKey(
            workspaceId,
            winner.subjectKey,
            winner.attribute,
            "proposed",
            winner.installationId,
        )
        await eachInOrder(
            others.filter((other) => other.id !== id),
            (other) =>
                this.reject(
                    workspaceId,
                    other.id,
                    decidedBy,
                    other.proposalKind === "retire"
                        ? "A new value was chosen"
                        : `Another value was chosen: ${winner.value}`,
                ),
        )
        return fact
    }

    /** Keeps the value in force: every proposal waiting for the key is rejected. Answers how many. */
    async keepCurrent(
        workspaceId: string,
        subjectKey: string,
        attribute: string,
        decidedBy: string,
        installationId: InstallationScope,
    ): Promise<number> {
        const waiting = await this.byKey(workspaceId, subjectKey, attribute, "proposed", installationId)
        await eachInOrder(waiting, (proposal) =>
            this.reject(workspaceId, proposal.id, decidedBy, "Kept the value in force"),
        )
        return waiting.length
    }

    /**
     * Keeps both values: the proposal becomes its own fact for the situation it names, and the current value stays. `inForce` (the
     * founder's decision, which IS the approval) puts the situational value in force at once; otherwise (a manager) it is filed as a
     * WAITING proposal for the founder. Either way the original proposal is turned down (a manager may turn a proposal down). Who may call
     * which is the caller's to check.
     */
    async split(
        workspaceId: string,
        id: string,
        situation: string,
        decidedBy: string,
        inForce?: boolean,
    ): Promise<FactRecord> {
        const proposal = await this.get(workspaceId, id)
        if (proposal?.status !== "proposed") throw new BrainFactsError({ code: BrainFactsErrorCode.NotProposed })
        if (proposal.proposalKind !== "set") throw new BrainFactsError({ code: BrainFactsErrorCode.NotAValue })
        const label = situation.trim()
        if (label === "") throw new BrainFactsError({ code: BrainFactsErrorCode.SituationRequired })
        const { fact } = await this.propose(workspaceId, {
            subjectType: proposal.subjectType,
            subjectLabel: proposal.subjectLabel,
            attributeLabel: `${proposal.attributeLabel} (${label})`,
            value: proposal.value,
            unit: proposal.unit,
            scope: proposal.scope,
            modules: proposal.modules,
            sourceKind: proposal.sourceKind,
            validFrom: proposal.validFrom,
            validTo: proposal.validTo,
            evidence: proposal.evidence,
            proposedBy: proposal.proposedBy,
            installationId: proposal.installationId,
            autoApply: inForce ?? true,
        })
        await this.reject(workspaceId, id, decidedBy, `Split into its own fact: ${proposal.attributeLabel} (${label})`)
        return fact
    }

    /**
     * Files a proposal to stop using an active fact; one waiting proposal per fact. Answers whether one was filed. A document that no
     * longer says it files as `document`; a chat change request names its own source.
     */
    async proposeRetire(
        workspaceId: string,
        active: FactRecord,
        why: Evidence,
        proposedBy: string,
        sourceKind: FactSource = "document",
    ): Promise<boolean> {
        const waiting = await this.byKey(
            workspaceId,
            active.subjectKey,
            active.attribute,
            "proposed",
            active.installationId,
        )
        if (waiting.some((proposal) => proposal.proposalKind === "retire")) return false
        await this.insert(this.entityManager, {
            workspaceId,
            subjectType: active.subjectType,
            subjectKey: active.subjectKey,
            subjectLabel: active.subjectLabel,
            attribute: active.attribute,
            attributeLabel: active.attributeLabel,
            value: active.value,
            valueNumber: active.valueNumber === null ? null : String(active.valueNumber),
            unit: active.unit,
            scope: active.scope,
            modules: [...active.modules],
            sourceKind,
            trust: TRUST[sourceKind],
            validFrom: null,
            validTo: null,
            conflictWith: active.id,
            evidence: [why],
            proposedBy,
            installationId: active.installationId,
            proposalKind: "retire",
        })
        return true
    }

    /** Takes one document's contribution back; answers the ids of active document facts left with no evidence. */
    withdrawSource(workspaceId: string, sourceId: string, note: string): Promise<ReadonlyArray<string>> {
        return this.maintenance.withdrawSource(workspaceId, sourceId, note)
    }

    /** Takes back what a changed document no longer says, chunk by chunk; a fact born from an unchanged passage is not touched. */
    withdrawChanged(
        workspaceId: string,
        sourceId: string,
        note: string,
        unchanged: UnchangedPassages,
    ): Promise<WithdrawnFacts> {
        return this.maintenance.withdrawChanged(workspaceId, sourceId, note, unchanged)
    }

    /**
     * Active facts that lost their last evidence are not deleted: a proposal to stop using each is filed for the owner. A fact that got
     * evidence again, or has a competing value waiting, is skipped. Answers how many proposals were filed.
     */
    async finalizeOrphans(workspaceId: string, ids: ReadonlyArray<string>, why: Evidence): Promise<number> {
        let filed = 0
        await eachInOrder(ids, async (id) => {
            const fact = await this.get(workspaceId, id)
            if (fact?.status !== "active" || fact.evidence.length > 0) return
            const waiting = await this.byKey(
                workspaceId,
                fact.subjectKey,
                fact.attribute,
                "proposed",
                fact.installationId,
            )
            if (waiting.some((proposal) => proposal.proposalKind === "set")) return
            if (await this.proposeRetire(workspaceId, fact, why, BRAIN)) filed += 1
        })
        return filed
    }

    /** Scheduled facts whose time has come take over and ended facts expire. */
    async maintain(workspaceId: string): Promise<MaintenanceResult> {
        const done = await this.maintenance.maintain(workspaceId)
        if (done.activated.length > 0 || done.expired > 0)
            await this.announce(
                workspaceId,
                done.activated.map((fact) => fact.id),
            )
        return done
    }

    /**
     * Adds evidence to a fact and lifts its trust to the new source's when that is higher; a WAITING value, or one SCHEDULED for a later
     * start, may also take a wider audience in place (neither has a version in force whose history must be kept: D-BR-1).
     */
    private grow(
        em: EntityManager,
        workspaceId: string,
        fact: FactRecord,
        evidence: ReadonlyArray<Evidence>,
        trust: number,
        wider?: Readers,
    ): Promise<FactRecord> {
        return this.changed(
            em,
            { workspaceId, id: fact.id },
            {
                evidence: () => ":evidence::jsonb",
                trust: Math.max(fact.trust, trust),
                ...(wider === undefined || (fact.status !== "proposed" && fact.status !== "scheduled")
                    ? {}
                    : { scope: wider.scope, modules: [...wider.modules] }),
            },
            BrainFactsErrorCode.NotProposed,
            { evidence: JSON.stringify(mergeEvidence(fact.evidence, evidence)) },
        )
    }

    /** Expires an active fact. */
    private stop(
        em: EntityManager,
        workspaceId: string,
        id: string,
        decidedBy: string,
        note: string | null,
    ): Promise<FactRecord> {
        return this.changed(
            em,
            { workspaceId, id, status: "active" },
            { ...decisionOf("expired", note, decidedBy), validTo: () => "now()" },
            BrainFactsErrorCode.NotActive,
        )
    }

    /** The fact of the one row a write answers. */

    /** Approves a proposal that starts later: older plans of the key are dropped and the values in force it replaces end at the start. */
    private async schedule(
        tx: EntityManager,
        workspaceId: string,
        fact: FactRecord,
        replaced: ReadonlyArray<FactRecord>,
        decidedBy: string,
        reason: string | null,
    ): Promise<FactRecord> {
        // Only one scheduled change per key: a newer approval replaces an older plan.
        await tx.update(
            BrainFactEntity,
            { ...factKeyOf(workspaceId, fact.subjectKey, fact.attribute, fact.installationId), status: "scheduled" },
            { status: "rejected", decisionNote: "Replaced by a newer schedule" },
        )
        await eachInOrder(replaced, (old) =>
            tx
                .createQueryBuilder(BrainFactEntity, "bf")
                .update()
                .set({ validTo: () => ":validTo::timestamptz" })
                .where({ workspaceId, id: old.id, status: "active" })
                .setParameter("validTo", fact.validFrom)
                .execute(),
        )
        return this.changed(
            tx,
            { workspaceId, id: fact.id, status: "proposed" },
            scheduleChanges(replaced[0]?.id ?? null, decidedBy, reason),
            BrainFactsErrorCode.NotProposed,
        )
    }

    /**
     * Stores another version of a fact (the same key, instance, value, unit and source) with what `version` says, its vector copied from
     * the old row in the same statement (no embedding call), and answers it: the next version in force with another audience, or the
     * standing value scheduled to come back after a time-boxed one.
     */
    private async copyVersion(
        tx: EntityManager,
        workspaceId: string,
        old: FactRecord,
        version: VersionOf,
    ): Promise<FactRecord> {
        const inserted = await tx
            .createQueryBuilder(BrainFactEntity, "bf")
            .insert()
            .values({
                workspaceId,
                installationId: old.installationId,
                subjectType: old.subjectType,
                subjectKey: old.subjectKey,
                subjectLabel: old.subjectLabel,
                attribute: old.attribute,
                attributeLabel: old.attributeLabel,
                value: old.value,
                valueNumber: old.valueNumber === null ? null : String(old.valueNumber),
                unit: old.unit,
                scope: version.audience.scope,
                modules: [...version.audience.modules],
                status: version.status,
                sourceKind: old.sourceKind,
                trust: version.trust,
                supersedesId: version.supersedesId,
                proposalKind: "set",
                proposedBy: version.status === "active" ? version.decidedBy : old.proposedBy,
                decidedBy: version.decidedBy,
                decidedAt: () => "now()",
                decisionNote: version.note,
                version: version.version,
                validFrom: () => "coalesce(:validFrom::timestamptz, now())",
                validTo: () =>
                    `coalesce(:validTo::timestamptz, coalesce(:validFrom::timestamptz, now()) + ${DEFAULT_VALIDITY})`,
                evidence: () => ":evidence::jsonb",
                embedding: copied("embedding"),
                embeddingModel: copied("embedding_model"),
                embeddingHash: copied("embedding_hash"),
            })
            .setParameters({
                workspaceId,
                oldId: old.id,
                validFrom: version.validFrom,
                validTo: version.validTo,
                evidence: JSON.stringify(version.evidence),
            })
            .returning(RETURNED)
            .execute()
        const [row] = returnedFacts(inserted.raw)
        if (row === undefined) throw new BrainFactsError({ code: BrainFactsErrorCode.FactNotFound })
        return toFactRecord(row)
    }

    /** Stores a new proposal and answers it. */
    private async insert(em: EntityManager, fact: NewFact): Promise<FactRecord> {
        const { validFrom, validTo, evidence, ...rest } = fact
        const inserted = await em
            .createQueryBuilder(BrainFactEntity, "bf")
            .insert()
            .values({
                ...rest,
                status: "proposed",
                validFrom: () => ":validFrom::timestamptz",
                validTo: () => ":validTo::timestamptz",
                evidence: () => ":evidence::jsonb",
            })
            .setParameters({ validFrom, validTo, evidence: JSON.stringify(evidence) })
            .returning(RETURNED)
            .execute()
        const [row] = returnedFacts(inserted.raw)
        if (row === undefined) throw new BrainFactsError({ code: BrainFactsErrorCode.FactNotFound })
        return toFactRecord(row)
    }

    /** Changes the one fact a condition names in one atomic statement and answers it; refuses with the code when no row matched. */
    private async changed(
        em: EntityManager,
        where: FindOptionsWhere<BrainFactEntity>,
        changes: FactChanges,
        code: BrainFactsErrorCode,
        parameters: Record<string, string> = {},
    ): Promise<FactRecord> {
        const updated = await em
            .createQueryBuilder(BrainFactEntity, "bf")
            .update()
            .set(changes)
            .where(where)
            .setParameters(parameters)
            .returning(RETURNED)
            .execute()
        const [row] = returnedFacts(updated.raw)
        if (row === undefined) throw new BrainFactsError({ code })
        return toFactRecord(row)
    }
}
