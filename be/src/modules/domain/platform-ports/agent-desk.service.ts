import { Injectable } from "@nestjs/common"
import { InstallationRecordsService } from "@modules/domain/module-installations"
import type {
    AgentDesk,
    AgentFlowsView,
    AgentReachView,
    AgentTodayView,
    ApprovalDecideAnswer,
    DeskAsker,
    WaitingOnPersonView,
} from "./agent-desk.contracts"
import { dayWindowOf } from "./agent-desk.mapper"
import { deskDecideTargetOf } from "./desk-decide.policy"
import { DeskFlowsService } from "./desk-flows.service"
import { DeskReachService } from "./desk-reach.service"
import { DeskRunsService } from "./desk-runs.service"
import { DeskWaitingService } from "./desk-waiting.service"

/** What an installation the workspace does not have (or that drives no agent) shows. */
const NO_FLOWS: AgentFlowsView = { flows: [] }
const NOTHING_WAITS: WaitingOnPersonView = { count: 0, rows: [] }
const NO_REACH: AgentReachView = { accounts: [], auto: [], ask: [], none: [] }
const NOT_HERE: ApprovalDecideAnswer = { kind: "refused", code: "not_waiting_here" }
const ROW_INVALID: ApprovalDecideAnswer = { kind: "refused", code: "row_invalid" }

@Injectable()
/**
 * The `platform.agent-desk` port: an agent's work desk, scoped by installation. The door has proven the seat's membership in the
 * workspace (and the read's permission); each read first resolves the installation to its agent inside that workspace, so an
 * installation of another workspace, or one that drives no agent, reads as empty and decides nothing.
 */
export class AgentDeskService {
    constructor(
        private readonly installations: InstallationRecordsService,
        private readonly desk: DeskFlowsService,
        private readonly waits: DeskWaitingService,
        private readonly runs: DeskRunsService,
        private readonly reaches: DeskReachService,
    ) {}

    /** The port for one asker. */
    portFor(asker: DeskAsker): AgentDesk {
        const { workspaceId } = asker
        const agentOf = async (installation: string): Promise<string | null> =>
            (await this.installations.find(workspaceId, installation))?.agentId ?? null
        return {
            flows: async (installation) => {
                const agentId = await agentOf(installation)
                return agentId === null ? NO_FLOWS : this.desk.flows(workspaceId, agentId, asker.locale)
            },
            waiting: async (installation) => {
                const agentId = await agentOf(installation)
                return agentId === null ? NOTHING_WAITS : this.waits.waiting(asker, agentId)
            },
            decide: async (installation, ask) => {
                const target = deskDecideTargetOf(installation, ask.id)
                if (target === null) return ROW_INVALID
                const agentId = await agentOf(target.installation)
                return agentId === null ? NOT_HERE : this.waits.decide(asker, agentId, { ...ask, id: target.id })
            },
            runFacts: async (installation, runIds) => {
                const agentId = await agentOf(installation)
                return agentId === null ? [] : this.runs.runFacts(workspaceId, agentId, runIds)
            },
            today: async (installation, day): Promise<AgentTodayView> => {
                const agentId = await agentOf(installation)
                if (agentId === null)
                    return { day: dayWindowOf(day).day, answered: 0, recordsRead: 0, recordsChanged: 0, uncounted: 0 }
                return this.runs.today(workspaceId, agentId, day)
            },
            reach: async (installation) => {
                const agentId = await agentOf(installation)
                return agentId === null ? NO_REACH : this.reaches.reach(asker, agentId)
            },
        }
    }
}
