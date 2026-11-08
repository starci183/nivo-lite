import { Injectable } from "@nestjs/common"
import { BrainFactsService } from "@modules/domain/brain-facts"
import { InstallationRecordsService } from "@modules/domain/module-installations"
import { WorkspacesService } from "@modules/domain/workspaces"
import { InjectClock, type Clock } from "@modules/platform/clock"
import { eachInOrder } from "@modules/platform/primitives"
import { AgentGraphDecisionsService } from "./agent-graph-decisions.service"
import { AgentGraphProposalsService } from "./agent-graph-proposals.service"
import { AgentGraphSeedService } from "./agent-graph-seed.service"
import { AgentGraphsService, type BrainSourceInForce } from "./agent-graphs.service"
import { conflictOf } from "./policies/conflict.policy"

/** How many agents one tick seeds. */
const SEED_BATCH = 50
/** How many installations one page of the walk reads, and the most pages one tick walks. */
const PAGE = 200
const PAGES = 10
/** How far back the closed decisions are looked at, milliseconds (two days), and how many are read. */
const LEARN_WINDOW_MS = 172_800_000
const LEARN_READ = 500
/** How many Brain rules one tick compares in one workspace. */
const BRAIN_BATCH = 500
/** How many workspaces the learning and the Brain comparison visit in one tick: the engine scopes a transaction to one workspace. */
const WORKSPACE_SLICE = 50
/** The language a graph is seeded in when nothing says otherwise. */
const SEED_LOCALE = "vi"

/** What one tick did. */
export interface WatchReport {
    /** Agents given their graph. */
    readonly seeded: number
    /** Seeds brought up to the rule they came from. */
    readonly refreshed: number
    /** Proposals the closed decisions taught. */
    readonly learned: number
    /** Proposals that a Brain rule was replaced. */
    readonly conflicts: number
}

@Injectable()
/**
 * The tick of the graphs, run in code with no model: it gives an agent that has no graph its seed (in batches of 50), keeps a seed
 * in step with the rule it came from, reads the decisions that ended lately and raises what they teach, and compares each Brain rule behind a version that decides with the rule in
 * force. A changed rule raises a conflict for the owner and changes no graph: the agent keeps running on the version the owner confirmed.
 */
export class AgentGraphWatchService {
    private after: string | undefined

    constructor(
        @InjectClock() private readonly clock: Clock,
        private readonly installations: InstallationRecordsService,
        private readonly graphs: AgentGraphsService,
        private readonly seed: AgentGraphSeedService,
        private readonly decisions: AgentGraphDecisionsService,
        private readonly proposals: AgentGraphProposalsService,
        private readonly brain: BrainFactsService,
        private readonly workspaces: WorkspacesService,
    ) {}

    /** Runs the four passes. */
    async tick(): Promise<WatchReport> {
        const seeded = await this.seedMissing()
        const refreshed = await this.refreshSeeds()
        const slice = await this.nextWorkspaces()
        const learned = await this.learn(slice)
        const conflicts = await this.compareBrain(slice)
        return { seeded, refreshed, learned, conflicts }
    }

    /** Walks the installations and brings each seed up to its rule, at most the batch in one tick. */
    private async refreshSeeds(after = "", page = 0, moved = 0): Promise<number> {
        if (page >= PAGES || moved >= SEED_BATCH) return moved
        const rows = await this.installations.page(after, PAGE)
        const last = rows.at(-1)
        if (last === undefined) return moved
        let made = 0
        await eachInOrder(rows, async (row) => {
            const state = row.agentId === null ? null : await this.graphs.stateOfAgent(row.workspaceId, row.agentId)
            if (
                state !== null &&
                made + moved < SEED_BATCH &&
                (await this.seed.refresh(state, row.moduleKey, SEED_LOCALE))
            )
                made += 1
        })
        return this.refreshSeeds(last.id, page + 1, moved + made)
    }

    /** Seeds one page of the walk, then the next, until the batch is full or the installations are all seen. */
    private async seedMissing(after = "", page = 0, seeded = 0): Promise<number> {
        if (page >= PAGES || seeded >= SEED_BATCH) return seeded
        const rows = await this.installations.page(after, PAGE)
        const last = rows.at(-1)
        if (last === undefined) return seeded
        const withAgent = rows.flatMap((row) =>
            row.agentId === null ? [] : [{ id: row.id, agentId: row.agentId, workspaceId: row.workspaceId }],
        )
        const missing = await this.missingOf(withAgent)
        const wanted = withAgent.filter((entry) => missing.has(entry.agentId)).slice(0, SEED_BATCH - seeded)
        let made = 0
        await eachInOrder(wanted, async (row) => {
            if ((await this.seed.ensureFor(row.id, SEED_LOCALE)) !== null) made += 1
        })
        return this.seedMissing(last.id, page + 1, seeded + made)
    }

    /** The agents of the rows that have no graph yet, asked one workspace at a time. */
    private async missingOf(
        rows: ReadonlyArray<{ readonly agentId: string; readonly workspaceId: string }>,
    ): Promise<ReadonlySet<string>> {
        const missing = new Set<string>()
        const workspaceIds = [...new Set(rows.map((row) => row.workspaceId))]
        await eachInOrder(workspaceIds, async (workspaceId) => {
            const found = await this.graphs.missingGraph(
                workspaceId,
                rows.filter((row) => row.workspaceId === workspaceId).map((row) => row.agentId),
            )
            found.forEach((agentId) => missing.add(agentId))
        })
        return missing
    }

    /** The next slice of workspaces by id, the first again after the last: every workspace is reached and no tick reads more than a slice. */
    private async nextWorkspaces(): Promise<ReadonlyArray<string>> {
        const found = await this.workspaces.list(WORKSPACE_SLICE, this.after)
        this.after = found.length < WORKSPACE_SLICE ? undefined : found.at(-1)?.id
        return found.map((workspace) => workspace.id)
    }

    private async learn(workspaceIds: ReadonlyArray<string>): Promise<number> {
        const since = new Date(this.clock.now().getTime() - LEARN_WINDOW_MS)
        const counts = await Promise.all(
            workspaceIds.map(async (workspaceId) => {
                const agents = await this.decisions.agentsClosedSince(workspaceId, since, LEARN_READ)
                const raised = await Promise.all(agents.map((agentId) => this.learnOne(workspaceId, agentId)))
                return raised.reduce((sum, count) => sum + count, 0)
            }),
        )
        return counts.reduce((sum, count) => sum + count, 0)
    }

    private async learnOne(workspaceId: string, agentId: string): Promise<number> {
        const state = await this.graphs.stateOfAgent(workspaceId, agentId)
        const active = state?.active ?? null
        const versionId = state?.activeVersionId ?? null
        return state === null || active === null || versionId === null
            ? 0
            : this.proposals.learn(workspaceId, agentId, versionId, active)
    }

    private async compareBrain(workspaceIds: ReadonlyArray<string>): Promise<number> {
        const found = await Promise.all(
            workspaceIds.map((workspaceId) => this.graphs.brainSourcesInForce(workspaceId, BRAIN_BATCH)),
        )
        const raised = await Promise.all(found.flat().map((source) => this.compareOne(source)))
        return raised.filter(Boolean).length
    }

    private async compareOne(source: BrainSourceInForce): Promise<boolean> {
        const cited = await this.brain.get(source.workspaceId, source.factId)
        if (cited === null) return false
        const inForce =
            cited.status === "active"
                ? null
                : ((await this.brain.byKey(source.workspaceId, cited.subjectKey, cited.attribute, "active", null))[0] ??
                  null)
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
