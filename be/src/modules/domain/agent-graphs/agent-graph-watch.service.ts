import { Injectable } from "@nestjs/common"
import { BrainFactsService } from "@modules/domain/brain-facts"
import { InstallationRecordsService } from "@modules/domain/module-installations"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { eachInOrder } from "@modules/platform/primitives"
import { AgentGraphDecisionsService } from "./agent-graph-decisions.service"
import { AgentGraphProposalsService } from "./agent-graph-proposals.service"
import { AgentGraphSeedService } from "./agent-graph-seed.service"
import { AgentGraphsService } from "./agent-graphs.service"
import type { BrainSourceInForce } from "./agent-graphs.service"
import { conflictOf } from "./policies/conflict.policy"

/** How many agents one tick seeds. */
const SEED_BATCH = 50
/** How many installations one page of the walk reads, and the most pages one tick walks. */
const PAGE = 200
const PAGES = 10
/** How far back the closed decisions are looked at, milliseconds (two days), and how many are read. */
const LEARN_WINDOW_MS = 172_800_000
const LEARN_READ = 500
/** How many Brain rules one tick compares. */
const BRAIN_BATCH = 500
/** The language a graph is seeded in when nothing says otherwise. */
const SEED_LOCALE = "vi"

/** What one tick did. */
export interface WatchReport {
    /** Agents given their graph. */
    readonly seeded: number
    /** Proposals the closed decisions taught. */
    readonly learned: number
    /** Proposals that a Brain rule was replaced. */
    readonly conflicts: number
}

@Injectable()
/**
 * The tick of the graphs, run in code with no model: it gives an agent that has no graph its seed (in batches of 50), reads the
 * decisions that ended lately and raises what they teach, and compares each Brain rule behind a version that decides with the rule in
 * force. A changed rule raises a conflict for the owner and changes no graph: the agent keeps running on the version the owner confirmed.
 */
export class AgentGraphWatchService {
    constructor(
        @InjectClock() private readonly clock: Clock,
        private readonly installations: InstallationRecordsService,
        private readonly graphs: AgentGraphsService,
        private readonly seed: AgentGraphSeedService,
        private readonly decisions: AgentGraphDecisionsService,
        private readonly proposals: AgentGraphProposalsService,
        private readonly brain: BrainFactsService,
    ) {}

    /** Runs the three passes. */
    async tick(): Promise<WatchReport> {
        const seeded = await this.seedMissing()
        const learned = await this.learn()
        const conflicts = await this.compareBrain()
        return { seeded, learned, conflicts }
    }

    /** Seeds one page of the walk, then the next, until the batch is full or the installations are all seen. */
    private async seedMissing(after = "", page = 0, seeded = 0): Promise<number> {
        if (page >= PAGES || seeded >= SEED_BATCH) return seeded
        const rows = await this.installations.page(after, PAGE)
        const last = rows.at(-1)
        if (last === undefined) return seeded
        const withAgent = rows.flatMap((row) => (row.agentId === null ? [] : [{ id: row.id, agentId: row.agentId }]))
        const missing = new Set(await this.graphs.missingGraph(withAgent.map((row) => row.agentId)))
        const wanted = withAgent.filter((entry) => missing.has(entry.agentId)).slice(0, SEED_BATCH - seeded)
        let made = 0
        await eachInOrder(wanted, async (row) => {
            if ((await this.seed.ensureFor(row.id, SEED_LOCALE)) !== null) made += 1
        })
        return this.seedMissing(last.id, page + 1, seeded + made)
    }

    private async learn(): Promise<number> {
        const since = new Date(this.clock.now().getTime() - LEARN_WINDOW_MS)
        const agents = await this.decisions.agentsClosedSince(since, LEARN_READ)
        const counts = await Promise.all(
            agents.map(async (agentId) => {
                const state = await this.graphs.statesOfAgent(agentId)
                const active = state?.active ?? null
                const versionId = state?.activeVersionId ?? null
                return state === null || active === null || versionId === null
                    ? 0
                    : this.proposals.learn(state.workspaceId, agentId, versionId, active)
            }),
        )
        return counts.reduce((sum, count) => sum + count, 0)
    }

    private async compareBrain(): Promise<number> {
        const sources = await this.graphs.brainSourcesInForce(BRAIN_BATCH)
        const raised = await Promise.all(sources.map((source) => this.compareOne(source)))
        return raised.filter(Boolean).length
    }

    private async compareOne(source: BrainSourceInForce): Promise<boolean> {
        const cited = await this.brain.get(source.workspaceId, source.factId)
        if (cited === null) return false
        const inForce =
            cited.status === "active"
                ? null
                : ((await this.brain.byKey(source.workspaceId, cited.subjectKey, cited.attribute, "active", null))[0] ?? null)
        const conflict = conflictOf(
            source.nodeKey,
            source.valueHash,
            { id: cited.id, status: cited.status, value: cited.value },
            inForce === null ? null : { id: inForce.id, status: inForce.status, value: inForce.value },
        )
        return conflict === null
            ? false
            : this.proposals.raiseConflict(source.workspaceId, source.agentId, source.versionId, {
                  nodeKey: source.nodeKey,
                  branchKey: source.branchKey,
                  oldFactId: source.factId,
                  ...conflict,
              })
    }
}
