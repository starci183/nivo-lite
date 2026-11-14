import { Injectable, Optional } from "@nestjs/common"
import {
  BrainFactsError,
  BrainFactsErrorCode,
  BrainFactsReadService,
  BrainFactsService,
  windowMovedOf,
  type Evidence,
  type FactRecord,
} from "@modules/domain/brain-facts"
import { CritiqueDecisionsService } from "@modules/domain/dossier-review"
import { WorkspaceMembersService, type WorkspaceMember } from "@modules/domain/workspace-members"
import { InjectClock, type Clock } from "@modules/platform/clock"
import type {
    SetPolicyProblem,
    SetPolicyRequest,
    SetPolicyResult,
    UnsetPolicyRequest,
    UnsetPolicyResult,
} from "./brain-policies.contracts"
import { POLICY_EDIT_REF, truthOf } from "./brain-policies.policy"
import { MANAGERS } from "./founder.policy"
import { OWNER_EDIT_LABEL, managerEditLabelOf } from "./messages/brain-policies.messages"
import { editedPolicyValue, policyValueOf, samePolicyValue, writtenPolicyValue, type PolicyValue } from "./policy-value.policy"

/** The most facts of one subject the drawer reads. */
const SUBJECT_WINDOW = 500

/** A value of the truth as typed, refused, or absent (only the audience changes). */
type Edited = { readonly value: PolicyValue } | { readonly problem: SetPolicyProblem } | null

/**
 * The note of a waiting value the founder corrected: his own value for the truth is in force (or scheduled, or he kept the value in
 * force), so the value he corrected is closed and names the fact that holds his word.
 */
const CORRECTED_NOTE = "corrected-by-founder:"

/** An edit that passed the checks, with what it is written against. */
interface CheckedEdit {
    /** The value the edit is typed against: the one in force, else the scheduled one, else the fact pointed at. */
    readonly base: FactRecord
    /** The value in force, or null. */
    readonly current: FactRecord | null
    /** The value as typed, or null when only the audience or the window changes. */
    readonly value: PolicyValue | null
    /** True when the typed value is the value in force (or none was typed). */
    readonly sameValue: boolean
    /** True when the validity window of the value in force moves. */
    readonly windowMoves: boolean
    /** True when who reads it changes. */
    readonly audienceChanges: boolean
}

/** The refusal of an edit. */
const invalid = (problem: SetPolicyProblem): SetPolicyResult => ({
    outcome: "invalid",
    problem,
    factId: null,
    value: null,
})

@Injectable()
/**
 * THE DOOR by which the founder corrects a truth he points at (`setBrainPolicy` / `unsetBrainPolicy`; the policy tab and the
 * truth list both call it, D-U-8). ANY truth of the workspace can be corrected, whatever its subject type, whatever the policy layer
 * made of it (that layer decides which tab lists a truth, never whether the founder may correct it), and whatever its state:
 * - IN FORCE: the founder's value is the next version of the fact (applied at once, or scheduled from a later date), shown as the
 *   owner's direct edit (`OWNER_EDIT_LABEL`); the old value is superseded and kept.
 * - WAITING (proposed, with or without a question on it) and never in force: the same value as the waiting one approves it (it goes in
 *   force as decided by him); another value goes in force as his own truth, and the waiting value he corrected is CLOSED, naming the
 *   fact that holds his word (`CORRECTED_NOTE`). A truth never waits beside the founder's correction of it.
 * How his word ranks: it is written as source `owner` through the one facts write path (`BrainFactsService.propose`, auto-applied),
 * the same path `saveBrainFact` takes for a truth he states by its labels. A value in force that he wrote is never a document's own
 * to update (`putInForceBy`): a later document that states another value is ASKED about (`settleVerdictOf`), never applied over it;
 * one that states the same value only adds its evidence. A manager's edit is a proposal for the owner (W2's founder rule); staff are
 * refused. No model call on any path.
 */
export class BrainPoliciesService {
    constructor(
        @InjectClock() private readonly clock: Clock,
        private readonly members: WorkspaceMembersService,
        private readonly reads: BrainFactsReadService,
        private readonly facts: BrainFactsService,
        @Optional() private readonly decisions?: CritiqueDecisionsService,
    ) {}

    /**
     * Sets a policy: the owner writes the next version of the truth (in force at once, or scheduled when `validFrom` is later), the old
     * value superseded and kept; a manager files the same value as a proposal for the owner. The value must read as the row's type; the
     * same value as the one in force writes nothing (`unchanged`) unless its validity window moves (a new `validTo`, or a later
     * `validFrom`): that is the next version with the same value (`applied` / `scheduled`, a manager's a proposal; its vector is
     * adopted from the same line, no embedding call). A window that ends before it starts stays `invalid` / `window`. Upkeep runs first, so a value whose start has come is the one replaced.
     */
    async set(userId: string, request: SetPolicyRequest): Promise<SetPolicyResult> {
        const { workspaceId } = request
        const me = await this.members.require(userId, workspaceId, MANAGERS)
        await this.facts.maintain(workspaceId)
        const anchor = await this.reads.get(workspaceId, request.factId)
        if (anchor === null) return invalid("not_found")
        const subject = await this.reads.list(workspaceId, { subjectKey: anchor.subjectKey, limit: SUBJECT_WINDOW })
        const { current, scheduled } = truthOf(anchor, subject, this.now())
        const base = current ?? scheduled ?? anchor
        const edited: Edited =
            request.value === undefined ? null : editedPolicyValue(policyValueOf(base.value, base.unit), request.value)
        if (edited !== null && "problem" in edited) return invalid(edited.problem)
        const windowProblem = this.windowProblem(request)
        if (windowProblem !== null) return invalid(windowProblem)
        const audienceChanges = request.audience !== undefined && request.audience !== base.scope
        // A new end (or a later start) of the value in force is a change on its own: the next version with the same value.
        const windowMoves = current !== null && windowMovedOf(current, request, this.now())
        if (edited === null && !audienceChanges && !windowMoves) return invalid("nothing_to_change")
        const sameValue =
            edited === null ||
            (current !== null && samePolicyValue(edited.value, policyValueOf(current.value, current.unit)))
        const result = await this.carriedOut(me, { base, current, value: edited?.value ?? null, sameValue, windowMoves, audienceChanges }, request)
        // His word on the VALUE closes the waiting value he corrected; the audience switch alone says nothing about it.
        return edited === null ? result : this.closingCorrected(me, workspaceId, anchor, result)
    }

    /** Carries out an edit that passed the checks: the next version, the audience alone, or nothing when the value already stands. */
    private carriedOut(
        me: WorkspaceMember,
        edit: CheckedEdit,
        request: SetPolicyRequest,
    ): Promise<SetPolicyResult> {
        const { base, current, value, sameValue, windowMoves, audienceChanges } = edit
        if (sameValue && windowMoves && current !== null) return this.written(me, base, current, current.value, request)
        if (sameValue || value === null) {
            // Only who reads it changes: that needs a value in force (a waiting or later value takes the reach of the one in force).
            if (current === null) return Promise.resolve(invalid("not_in_force"))
            if (request.audience === undefined || !audienceChanges)
                return Promise.resolve({ outcome: "unchanged", problem: null, factId: current.id, value: current.value })
            return this.reached(me, current, request.workspaceId, request.audience)
        }
        // The store keeps the value and its unit in its one normal form (`unitFormOf`): "30.000 VND" with unit "VND" is stored "30.000".
        return this.written(me, base, current, writtenPolicyValue(value), request)
    }

    /**
     * The founder's word on a truth closes the WAITING value he corrected (D-U-8: a truth never in force could not be corrected, and a
     * corrected one would have waited beside his own value as a question nobody asked). Once his edit landed (applied, scheduled, or
     * the value in force kept as it is), the value he pointed at, when it still waits, is turned down with the fact that holds his
     * word. Nothing for a manager (his edit is itself a proposal), for a refused edit, or when the waiting value is the one that went
     * in force (he typed the same value: that is its approval).
     */
    private async closingCorrected(
        me: WorkspaceMember,
        workspaceId: string,
        anchor: FactRecord,
        result: SetPolicyResult,
    ): Promise<SetPolicyResult> {
        const landed = result.outcome === "applied" || result.outcome === "scheduled" || result.outcome === "unchanged"
        if (me.role !== "owner" || !landed || anchor.status !== "proposed" || anchor.proposalKind !== "set") return result
        const waiting = await this.reads.get(workspaceId, anchor.id)
        if (waiting?.status !== "proposed") return result
        try {
            await this.facts.reject(workspaceId, anchor.id, me.displayName, `${CORRECTED_NOTE}${result.factId ?? ""}`)
            // The store announces no rejection: the critic is told here, so every other open point that names the closed truth (and no
            // truth that still waits) closes with it and holds no passage back for a question the founder has settled.
            await this.decisions?.turnedDown(workspaceId, [anchor.id])
        } catch (cause) {
            // Decided by someone else between the read and the write: it no longer waits, which is all this step wants.
            if (!(cause instanceof BrainFactsError && cause.code === BrainFactsErrorCode.NotProposed)) throw cause
        }
        return result
    }

    /**
     * Takes a policy out of force: the owner retires the value in force (kept in history); a manager files a proposal to stop using it.
     * `unchanged` when nothing is in force.
     */
    async unset(userId: string, request: UnsetPolicyRequest): Promise<UnsetPolicyResult> {
        const { workspaceId } = request
        const me = await this.members.require(userId, workspaceId, MANAGERS)
        await this.facts.maintain(workspaceId)
        const anchor = await this.reads.get(workspaceId, request.factId)
        if (anchor === null) return { outcome: "unchanged" }
        const subject = await this.reads.list(workspaceId, { subjectKey: anchor.subjectKey, limit: SUBJECT_WINDOW })
        const { current } = truthOf(anchor, subject, this.now())
        if (current?.status !== "active") return { outcome: "unchanged" }
        const trimmedNote = request.note?.trim()
        const note = trimmedNote === "" ? undefined : trimmedNote
        if (me.role === "owner") {
            await this.facts.retire(workspaceId, current.id, me.displayName, note ?? OWNER_EDIT_LABEL)
            return { outcome: "retired" }
        }
        await this.facts.proposeRetire(
            workspaceId,
            current,
            this.evidenceOf(me, current.id, note ?? current.value),
            me.displayName,
            "manager",
        )
        return { outcome: "proposed" }
    }

    /** The next version of the truth (owner) or a proposal (manager), through the brain-facts write path. */
    private async written(
        me: WorkspaceMember,
        base: FactRecord,
        current: FactRecord | null,
        value: string,
        request: SetPolicyRequest,
    ): Promise<SetPolicyResult> {
        const owner = me.role === "owner"
        if (!owner && request.audience !== undefined && request.audience !== base.scope) return invalid("owner_only")
        const later = request.validFrom !== undefined && Date.parse(request.validFrom) > this.now()
        const result = await this.facts.propose(request.workspaceId, {
            subjectType: base.subjectType,
            subjectLabel: base.subjectLabel,
            attributeLabel: base.attributeLabel,
            value,
            unit: base.unit,
            // A new value keeps the audience of the value in force unless the owner changes it.
            scope: request.audience ?? (current === null ? base.scope : undefined),
            modules: base.modules,
            sourceKind: owner ? "owner" : "manager",
            autoApply: owner,
            validFrom: later ? request.validFrom : undefined,
            validTo: request.validTo,
            installationId: base.installationId,
            proposedBy: me.displayName,
            evidence: [this.evidenceOf(me, base.id, value)],
        })
        const { fact } = result
        if (fact.status === "scheduled")
            return { outcome: "scheduled", problem: null, factId: fact.id, value: fact.value }
        if (fact.status === "active") return { outcome: "applied", problem: null, factId: fact.id, value: fact.value }
        return { outcome: "proposed", problem: null, factId: fact.id, value: fact.value }
    }

    /**
     * Who reads the value in force changes, the value stays (the "customers may know" switch alone): the owner only, as the next version of the fact
     * (`BrainFactsService.setReach`: same value, new scope, the old version kept; no model or embedding call).
     */
    private async reached(
        me: WorkspaceMember,
        current: FactRecord,
        workspaceId: string,
        audience: "public" | "internal",
    ): Promise<SetPolicyResult> {
        if (me.role !== "owner") return invalid("owner_only")
        const fact = await this.facts.setReach(
            workspaceId,
            current.id,
            { scope: audience, modules: [] },
            me.displayName,
        )
        return { outcome: "applied", problem: null, factId: fact.id, value: fact.value }
    }

    /** The window of an edit: a stated end must come after its start (or after now). */
    private windowProblem(request: SetPolicyRequest): SetPolicyProblem | null {
        const from = request.validFrom === undefined ? this.now() : Date.parse(request.validFrom)
        const to = request.validTo === undefined ? null : Date.parse(request.validTo)
        if (Number.isNaN(from) || (to !== null && (Number.isNaN(to) || to <= Math.max(from, this.now()))))
            return "window"
        return null
    }

    /** The evidence of an edit on the tab. */
    private evidenceOf(me: WorkspaceMember, factId: string, quote: string): Evidence {
        const at = new Date(this.now()).toISOString()
        return {
            kind: "manual",
            ref: `${POLICY_EDIT_REF}${factId}:${String(this.now())}`,
            label: me.role === "owner" ? OWNER_EDIT_LABEL : managerEditLabelOf(me.displayName),
            quote,
            at,
        }
    }

    /** Now, in milliseconds. */
    private now(): number {
        return this.clock.now().getTime()
    }
}
