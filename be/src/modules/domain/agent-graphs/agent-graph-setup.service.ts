import { Injectable } from "@nestjs/common"
import type { SetupApplicant, SetupApplier, SetupBranchChange, SetupGraphPort } from "@modules/domain/modules"
import { MemberGrantsService } from "@modules/domain/member-grants"
import { InstallationRecordsService } from "@modules/domain/module-installations"
import { WorkspaceMemberSeatsService } from "@modules/domain/workspace-members"
import { AgentGraphContextService } from "./agent-graph-context.service"
import { AgentGraphPublishService } from "./agent-graph-publish.service"
import { AgentGraphSeedService } from "./agent-graph-seed.service"
import { AgentGraphsError, AgentGraphsErrorCode } from "./errors/agent-graphs.error"
import { AgentGraphsService } from "./agent-graphs.service"
import type { GraphState } from "./agent-graphs.service"
import { applyBranchSetup } from "./policies/branch-setup.policy"
import { firstGapOf } from "./policies/graph-gaps.policy"

/** The language a graph is seeded in when the setup chat is the first thing to open it. */
const SEED_LOCALE = "vi"

/** What names a person the same way however it is cased, accented or spaced. */
const nameKey = (name: string): string =>
    name
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
        .toLowerCase()
        .replace(/\s+/g, " ")
        .trim()

@Injectable()
/**
 * The action graph of an installation as the setup chat sees it: a confirmed branch is written into the draft with the words of the owner
 * as its source, the first vague place of the draft is what the next turn asks about, and applying the setup publishes the draft with the
 * context version and the number it became (under the right of the seat that applies; a widening stays the owner's).
 */
export class AgentGraphSetupService implements SetupGraphPort {
    constructor(
        private readonly graphs: AgentGraphsService,
        private readonly seed: AgentGraphSeedService,
        private readonly installations: InstallationRecordsService,
        private readonly context: AgentGraphContextService,
        private readonly publishing: AgentGraphPublishService,
        private readonly members: MemberGrantsService,
        private readonly seats: WorkspaceMemberSeatsService,
    ) {}

    /** Writes a confirmed branch into the draft of the graph of the installation. */
    async applyBranch(change: SetupBranchChange): Promise<void> {
        const state = await this.stateOf(change.workspaceId, change.installationId)
        const document = applyBranchSetup(state.draft, {
            action: change.action,
            boundaryVnd: change.boundaryVnd,
            belongsTo: change.belongsTo,
            approverMemberId: change.approverMemberId,
            source: { kind: "chat", messageId: change.messageId ?? "setup", quote: change.quote },
        })
        if (document === null) throw new AgentGraphsError({ code: AgentGraphsErrorCode.BranchNotApplicable })
        await this.graphs.saveDraft(state.workspaceId, state.agentId, state.draftRev, document)
    }

    /** The code of the first vague place of the draft, or an empty text when it has none or the installation has no graph yet. */
    async firstGap(workspaceId: string, installationId: string): Promise<string> {
        const state = await this.graphs.stateOfInstallation(installationId)
        const installation = state === null ? null : await this.installations.findById(installationId)
        if (state === null || installation === null || state.workspaceId !== workspaceId) return ""
        const context = await this.context.contextOf({ ...state, moduleKey: installation.moduleKey }, state.draft)
        return firstGapOf(state.draft, context)?.code ?? ""
    }

    /** The seat of the person the owner named, or an empty text when nobody or more than one answers to that name. */
    async seatNamed(workspaceId: string, name: string): Promise<string> {
        const [only, ...others] = (await this.members.directory(workspaceId)).filter(
            (person) => person.status === "active" && nameKey(person.name) === nameKey(name),
        )
        return only !== undefined && others.length === 0 ? only.memberId : ""
    }

    /**
     * Refuses, before the setup writes anything, when publishing the draft would be refused (a problem in the graph, or a widening applied
     * by a manager), and answers the number of the newest graph version, 0 when the installation has no graph.
     */
    async checkPublish(applicant: SetupApplicant): Promise<number> {
        const state = await this.graphs.stateOfInstallation(applicant.installationId)
        if (state === null) return 0
        const seat = await this.seats.activeSeatOfUser(applicant.workspaceId, applicant.principalId)
        if (seat !== null)
            await this.publishing.requirePublishable(applicant.workspaceId, state.agentId, {
                memberId: seat.memberId,
                role: seat.role,
            })
        return this.graphs.latestVersionOf(applicant.workspaceId, state.agentId)
    }

    /**
     * Publishes the draft of the graph as the version the setup became, with its context version and its number, even when the map did
     * not change; an owner applying makes the graph decide, a manager leaves the mode as it was.
     */
    async publish(applier: SetupApplier): Promise<void> {
        const state = await this.graphs.stateOfInstallation(applier.installationId)
        if (state === null) return
        const seat = await this.seats.activeSeatOfUser(applier.workspaceId, applier.principalId)
        if (seat === null) return
        await this.publishing.publishDraft(
            applier.workspaceId,
            state.agentId,
            { memberId: seat.memberId, role: seat.role },
            "",
            "chat",
            applier.contextVersionId,
            applier.version,
        )
    }

    private async stateOf(workspaceId: string, installationId: string): Promise<GraphState> {
        const state =
            (await this.graphs.stateOfInstallation(installationId)) ??
            (await this.seed.ensureFor(installationId, SEED_LOCALE))
        if (state?.workspaceId !== workspaceId) throw new AgentGraphsError({ code: AgentGraphsErrorCode.GraphNotFound })
        return state
    }
}
