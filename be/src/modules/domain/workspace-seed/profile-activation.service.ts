import { Injectable } from "@nestjs/common"
import { InstallationRecordsService } from "@modules/domain/module-installations"
import type { InstallationRecord, InstallationStatus } from "@modules/domain/module-installations"
import { ModuleReadinessService, SetupChatService } from "@modules/domain/modules"
import type { Locale } from "@modules/platform/i18n"
import { eachInOrder } from "@modules/platform/primitives"
import { WorkspaceSeedError, WorkspaceSeedErrorCode } from "./errors/workspace-seed.error"
import type {
    ProfileAgent,
    ProfileInstallation,
    ProfileSetupAnswer,
    ProfileStatuses,
    ProfileTarget,
} from "./workspace-profile.contracts"

/** The language the setup answers are written in; the setup chat writes the agent texts and the event in it. */
const SETUP_LOCALE: Locale = "vi"

@Injectable()
/**
 * Installs the module of each profile agent and brings the installation to its activated state through the real setup path: every
 * gate answer is confirmed as the owner's wording in the open draft and the draft is applied as a context version (the setup chat
 * refuses it while a gate of the module is not confirmed, which fails the run). Each installation is then settled: one whose module
 * requires a capability no connector plays waits in `needs_connection`.
 */
export class ProfileActivationService {
    constructor(
        private readonly installations: InstallationRecordsService,
        private readonly setup: SetupChatService,
        private readonly readiness: ModuleReadinessService,
    ) {}

    /** The installation that drives the agent, installed in `setup` when there is none yet and read back. */
    async install(workspaceId: string, agentId: string, agent: ProfileAgent): Promise<InstallationRecord> {
        const found = await this.installations.ofAgent(workspaceId, agentId)
        if (found !== null) return found
        await this.installations.insert({
            workspaceId,
            moduleKey: agent.module,
            name: agent.name,
            agentId,
            operatingMode: "assist",
        })
        const installed = await this.installations.ofAgent(workspaceId, agentId)
        if (installed === null) throw new WorkspaceSeedError({ code: WorkspaceSeedErrorCode.RowMissing })
        return installed
    }

    /** Applies the setup of every installation in order, settles each and answers its status by agent handle. */
    async activate(target: ProfileTarget, kept: ReadonlyArray<ProfileInstallation>): Promise<ProfileStatuses> {
        const statuses: Array<[string, InstallationStatus]> = []
        await eachInOrder(kept, async ({ handle, installation, answers }) => {
            await this.applySetup(target, installation, answers)
            statuses.push([handle, await this.readiness.settle(target.workspaceId, installation.id)])
        })
        return Object.fromEntries(statuses)
    }

    /**
     * Confirms each answer that the draft does not already hold confirmed with the same text, then applies the draft. When nothing
     * changed on an installation that already runs on a version, applying would only be refused as unchanged, so it is skipped.
     */
    private async applySetup(
        target: ProfileTarget,
        installation: InstallationRecord,
        answers: ReadonlyArray<ProfileSetupAnswer>,
    ): Promise<void> {
        const { ownerId, workspaceId } = target
        const draft = await this.setup.openDraft(installation, SETUP_LOCALE)
        const changed = answers.filter((answer) => {
            const current = draft.gateEvidence[answer.gate]
            return current?.status !== "confirmed" || current.evidence !== answer.evidence
        })
        await eachInOrder(changed, async (answer) => {
            await this.setup.setGate(ownerId, workspaceId, draft.id, answer.gate, "edit", answer.evidence)
        })
        if (changed.length === 0 && installation.activeContextVersionId !== null) return
        await this.setup.apply(ownerId, workspaceId, installation.id, SETUP_LOCALE)
    }
}
