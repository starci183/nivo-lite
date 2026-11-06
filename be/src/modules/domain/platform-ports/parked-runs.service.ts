import { Injectable } from "@nestjs/common"
import type { ParkedRunFilter, ParkedRunRow, ParkedRuns } from "@nivo-lite/blocks-core/modules"
import { AgentRunParkStoreService, AgentRunResumeService } from "@modules/domain/agent-runs"
import { AgentDirectoryService } from "@modules/domain/agents"
import { InjectMessageCatalog } from "@modules/platform/i18n"
import type { Locale, MessageCatalog } from "@modules/platform/i18n"
import { PARKED_LOOKED_AT, errorKeyOf } from "./parked-runs.policy"

/** Who asks and in which language: the words of the parked runs are theirs, and so is the seat that resumes one. */
export interface ParkedRunsAsker {
    /** The workspace. */
    readonly workspaceId: string
    /** The seat that asks; null when none. */
    readonly memberId: string | null
    /** The viewer's language. */
    readonly locale: Locale
}

/** The reason the engine keeps on a run a person resumed. */
const OWNER_REASON = "resumed by the owner from the agent page"

@Injectable()
/**
 * The `platform.parked-runs` port over the engine's own park and resume of runs on records: it lists the runs the engine parked with the
 * step and the failure, and resumes one exactly as the engine's resume does. It decides nothing about retry; rights are checked by the action
 * that asks.
 */
export class ParkedRunsService {
    constructor(
        @InjectMessageCatalog() private readonly catalog: MessageCatalog,
        private readonly parks: AgentRunParkStoreService,
        private readonly resumes: AgentRunResumeService,
        private readonly directory: AgentDirectoryService,
    ) {}

    /** The port for one asker. */
    portFor(asker: ParkedRunsAsker): ParkedRuns {
        return {
            list: (filter, limit) => this.list(asker, filter, limit),
            find: async (runId) => {
                const standing = await this.parks.standingOf(asker.workspaceId, runId)
                if (standing === null) return null
                const agent = await this.directory.find(asker.workspaceId, standing.agentId)
                return { module: agent?.module ?? "", parked: standing.parked }
            },
            resume: async (runId) => {
                const result = await this.resumes.resume({
                    workspaceId: asker.workspaceId,
                    runId,
                    actor: asker.memberId ?? "owner",
                    reason: OWNER_REASON,
                })
                return result.kind === "resumed"
            },
        }
    }

    private async list(asker: ParkedRunsAsker, filter: ParkedRunFilter, limit: number) {
        const facts = await this.parks.parkedFacts(asker.workspaceId, PARKED_LOOKED_AT)
        const rows: Array<ParkedRunRow> = await Promise.all(
            facts.map(async (fact) => {
                const agent = await this.directory.find(asker.workspaceId, fact.agentId)
                const key = errorKeyOf(fact.errorCode)
                const words = this.catalog.get(key, {}, asker.locale)
                return {
                    id: fact.runId,
                    module: agent?.module ?? "",
                    subjectKind: fact.subjectKind,
                    subjectId: fact.subjectId,
                    step: fact.stepKey,
                    errorCode: fact.errorCode,
                    errorWords: words === key ? fact.errorCode : words,
                    parkedAt: fact.parkedAt,
                }
            }),
        )
        const matching = rows.filter(
            (row) =>
                (filter.module === undefined || row.module === filter.module) &&
                (filter.subjectKind === undefined || row.subjectKind === filter.subjectKind) &&
                (filter.subjectId === undefined || row.subjectId === filter.subjectId),
        )
        return { total: matching.length, rows: matching.slice(0, limit) }
    }
}
