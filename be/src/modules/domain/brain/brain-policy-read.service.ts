import { Injectable } from "@nestjs/common"
import { BrainFactsReadService } from "@modules/domain/brain-facts"
import { KnowledgeGapsService } from "@modules/domain/knowledge-gaps"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { InjectClock, type Clock } from "@modules/platform/clock"
import { MISSING_MAX } from "./brain-policies.policy"
import type { BrainPoliciesWire, BrainPolicyDetailWire } from "./brain-policies-wire.contracts"
import { brainPoliciesWireOf, brainPolicyDetailWireOf } from "./brain-policies-wire.policy"
import { BrainPolicyCandidatesService, NO_INSTALLATION } from "./brain-policy-candidates.service"
import { BrainPolicyDerivationsService } from "./brain-policy-derivations.service"
import { BrainPolicyStoreService } from "./brain-policy-store.service"
import { MANAGERS } from "./founder.policy"
import { truthKeyOf } from "./policy-derive.policy"
import { derivedPoliciesOf, derivedPolicyDetailOf, isOpenPolicy, type DerivedBrainPolicies, type MaybeDerivedPolicyDetail } from "./policy-derived-view.policy"

/** The most facts of one subject the drawer reads. */
const SUBJECT_WINDOW = 500

@Injectable()
/**
 * The read path of the policy tab of the Second Brain over the DERIVED layer: a row is a truth the AI derived as a policy of the shop
 * (`brain_policies`), its title and group come from that judgement, and its value, source, audience, later value, waiting proposals
 * and history are read from the facts every time (the layer keeps no value, so nothing can drift). Never a model call and never a
 * derive on a read: a workspace whose truths are not judged yet answers `derivation.state` `deriving` / `not_derived` with the rows
 * judged so far. The tab is four statements, the drawer four, whatever the number of rows.
 */
export class BrainPolicyReadService {
    constructor(
        @InjectClock() private readonly clock: Clock,
        private readonly members: WorkspaceMembersService,
        private readonly reads: BrainFactsReadService,
        private readonly gaps: KnowledgeGapsService,
        private readonly store: BrainPolicyStoreService,
        private readonly derivations: BrainPolicyDerivationsService,
        private readonly candidates: BrainPolicyCandidatesService,
    ) {}

    /**
     * The tab, by the JUDGEMENT table's keys (BRAIN-LIMITS item 3; never "the newest 2,000 facts"): the open policy judgements
     * (`brain_policies_ws_status`), then the facts of exactly those truths in force, scheduled or waiting (the ids on
     * `brain_facts_ws_subject`, the rows by primary key) and the proposals of other keys that name them, the open customer questions, the
     * derive state and the SQL count of the truths with no judgement yet. Seven statements whatever the size of the workspace.
     */
    async policies(userId: string, workspaceId: string): Promise<DerivedBrainPolicies> {
        const me = await this.members.require(userId, workspaceId, MANAGERS)
        const [stored, gaps, state, pending] = await Promise.all([
            this.store.openPolicies(workspaceId),
            this.gaps.list(workspaceId, ["open"], MISSING_MAX),
            this.derivations.state(workspaceId),
            this.candidates.unjudged(workspaceId),
        ])
        const keys = stored.map((one) => ({
            subjectKey: one.subjectKey,
            attribute: one.attribute,
            installation: one.installationId ?? NO_INSTALLATION,
        }))
        const ids = await this.candidates.factIdsOf(workspaceId, keys, ["active", "scheduled", "proposed"])
        const against = await this.candidates.proposalsAgainst(workspaceId, ids)
        const facts = await this.reads.byIds(workspaceId, [...new Set([...ids, ...against])])
        // D-BR-11: a judgement whose truth NOTHING holds any more (an undone bulk apply, a retired value) is not a row: it waits for the
        // next pass to retire it (every fact change asks for one); the tab never lists a policy with no value.
        const held = new Set(
            facts.filter((fact) => fact.status === "active" || fact.status === "scheduled").map((fact) => truthKeyOf(fact)),
        )
        const standing = stored.filter((one) => held.has(truthKeyOf(one)))
        return derivedPoliciesOf(facts, gaps, standing, state, me.role === "owner", this.now(), pending)
    }

    /** The tab in the flat shape the Policies screen reads (a parameter's fields all present, null where its type has none). */
    async policiesWire(userId: string, workspaceId: string): Promise<BrainPoliciesWire> {
        return brainPoliciesWireOf(await this.policies(userId, workspaceId))
    }

    /** The drawer of one row in the flat shape the Policies screen reads; null when the fact is unknown or not a derived policy. */
    async detailWire(userId: string, workspaceId: string, factId: string): Promise<BrainPolicyDetailWire | null> {
        return brainPolicyDetailWireOf(await this.detail(userId, workspaceId, factId))
    }

    /**
     * The drawer of one row: the fact (primary key), then its truth's judgement (`brain_policies_truth`) and every fact of its subject
     * (`brain_facts_ws_subject`, its waiting proposals among them) in parallel. Null when the fact is unknown or its truth is not a derived policy.
     */
    async detail(userId: string, workspaceId: string, factId: string): Promise<MaybeDerivedPolicyDetail> {
        const me = await this.members.require(userId, workspaceId, MANAGERS)
        const anchor = await this.reads.get(workspaceId, factId)
        if (anchor === null) return null
        const [derived, subject] = await Promise.all([
            this.store.ofTruth(workspaceId, anchor),
            this.reads.list(workspaceId, { subjectKey: anchor.subjectKey, limit: SUBJECT_WINDOW }),
        ])
        if (!isOpenPolicy(derived)) return null
        // The waiting proposals of the drawer: those of the anchor's own subject (read with it) and those of other keys that name one of
        // its values, never a window of the workspace's newest.
        const held = subject.filter((fact) => fact.status === "active" || fact.status === "scheduled").map((fact) => fact.id)
        const against = await this.reads.byIds(workspaceId, await this.candidates.proposalsAgainst(workspaceId, held))
        const proposals = [...subject.filter((fact) => fact.status === "proposed"), ...against.filter((fact) => fact.subjectKey !== anchor.subjectKey)]
        return derivedPolicyDetailOf(anchor, derived, subject, proposals, me.role === "owner", this.now())
    }

    /** Now, in milliseconds. */
    private now(): number {
        return this.clock.now().getTime()
    }
}
