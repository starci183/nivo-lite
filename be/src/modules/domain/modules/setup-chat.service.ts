import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { AgentsService } from "@modules/domain/agents"
import type { AgentTexts } from "@modules/domain/agents"
import { EventsService } from "@modules/domain/events"
import { ContextVersionsService } from "@modules/domain/module-context-versions"
import type { DraftSnapshot } from "@modules/domain/module-context-versions"
import { InstallationRecordsService } from "@modules/domain/module-installations"
import type { InstallationRecord } from "@modules/domain/module-installations"
import { SetupMessagesService } from "@modules/domain/module-setup-messages"
import type { SetupMessageRecord } from "@modules/domain/module-setup-messages"
import { SetupSessionsService } from "@modules/domain/module-setup-sessions"
import type { SetupSessionRecord } from "@modules/domain/module-setup-sessions"
import { AgentSyncService } from "@modules/domain/openclaw-agent-sync"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import type { WorkspaceRole } from "@modules/domain/workspace-members"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectMessageCatalog } from "@modules/platform/i18n"
import type { Locale, MessageCatalog } from "@modules/platform/i18n"
import { InjectAgentsQueue } from "@modules/queues/agents"
import type { AgentsQueue } from "@modules/queues/agents"
import { ModulesError, ModulesErrorCode } from "./errors/modules.error"
import type { SetupState, SetupVersions } from "./module-setup.contracts"
import { ModulesService } from "./modules.service"
import {
    agentTextsOf,
    allGatesConfirmed,
    gateAfter,
    gateEntry,
    sameSnapshot,
    snapshotOf,
    stripSetupBlock,
} from "./policies/setup-gates.policy"
import type { GateAction } from "./policies/setup-gates.policy"
import { SetupCardsService } from "./setup-cards.service"

const GOVERNORS: ReadonlyArray<WorkspaceRole> = ["owner", "manager"]
const MESSAGE_MAX = 4000
const EVIDENCE_MAX = 800
const EMPTY_DRAFT: DraftSnapshot = { summary: "", facts: [] }

@Injectable()
/**
 * The setup chat of an installed agent: the open draft (created on first open), the private chat with NIVO, the gates the owner
 * confirms, the context versions and applying a draft as the next version. Owners and managers only; an owner message queues the turn.
 */
export class SetupChatService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectClock() private readonly clock: Clock,
        @InjectMessageCatalog() private readonly catalog: MessageCatalog,
        @InjectAgentsQueue() private readonly queue: AgentsQueue,
        private readonly installations: InstallationRecordsService,
        private readonly sessions: SetupSessionsService,
        private readonly messages: SetupMessagesService,
        private readonly versions: ContextVersionsService,
        private readonly members: WorkspaceMembersService,
        private readonly modules: ModulesService,
        private readonly agents: AgentsService,
        private readonly events: EventsService,
        private readonly sync: AgentSyncService,
        private readonly cards: SetupCardsService,
    ) {}

    /** Everything the Setup tab needs: the draft (opened on first visit), the revisions, the whole chat and the confirm cards. */
    async state(principalId: string, workspaceId: string, installationId: string, locale: Locale): Promise<SetupState> {
        await this.members.require(principalId, workspaceId, GOVERNORS)
        const installation = await this.installationOf(workspaceId, installationId)
        const session = await this.openDraft(installation, locale)
        const [revisions, messages] = await Promise.all([
            this.sessions.revisions(installation.id),
            this.messages.ofInstallation(installation.id),
        ])
        const cards = await this.cards.viewsOf(
            workspaceId,
            revisions.map((revision) => revision.id),
        )
        return {
            installation,
            session,
            revisions,
            messages,
            cards,
            turnPending: messages.filter((message) => message.setupSessionId === session.id).at(-1)?.role === "user",
        }
    }

    /** The applied context versions of an installation, newest first, and the one in use. */
    async versionsOf(principalId: string, workspaceId: string, installationId: string): Promise<SetupVersions> {
        await this.members.require(principalId, workspaceId, GOVERNORS)
        const installation = await this.installationOf(workspaceId, installationId)
        return {
            versions: await this.versions.list(installation.id),
            activeVersionId: installation.activeContextVersionId,
        }
    }

    /** Stores one message of the owner in the open draft and queues the answer of NIVO. */
    async postMessage(
        principalId: string,
        workspaceId: string,
        sessionId: string,
        text: string,
        locale: Locale,
    ): Promise<SetupMessageRecord> {
        const member = await this.members.require(principalId, workspaceId, GOVERNORS)
        await this.draftOf(workspaceId, sessionId)
        const message = await this.messages.post({
            workspaceId,
            setupSessionId: sessionId,
            role: "user",
            author: member.displayName,
            body: text.trim().slice(0, MESSAGE_MAX),
        })
        await this.entityManager.transaction((tx) =>
            this.queue.enqueueSetupTurn({ workspaceId, messageId: message.id, setupSessionId: sessionId, locale }, tx),
        )
        return message
    }

    /** Confirms, reopens or edits one gate of the open draft; editing sets the own wording of the owner and confirms it. */
    async setGate(
        principalId: string,
        workspaceId: string,
        sessionId: string,
        gateKey: string,
        action: GateAction,
        evidence: string,
    ): Promise<SetupSessionRecord> {
        const member = await this.members.require(principalId, workspaceId, GOVERNORS)
        const session = await this.draftOf(workspaceId, sessionId)
        const installation = await this.installationOf(workspaceId, session.installationId)
        const module = await this.modules.find(installation.moduleKey)
        if (!module.gates.some((gate) => gate.key === gateKey)) {
            throw new ModulesError({ code: ModulesErrorCode.GateUnknown })
        }
        const next = gateAfter(
            action,
            gateEntry(session.gateEvidence, gateKey),
            evidence.trim().slice(0, EVIDENCE_MAX),
            member.displayName,
            this.clock.now(),
        )
        if (next === null) throw new ModulesError({ code: ModulesErrorCode.GateEmpty })
        const saved = await this.sessions.save(session.id, {
            draft: session.draft,
            gateEvidence: { ...session.gateEvidence, [gateKey]: next },
        })
        if (saved === null) throw new ModulesError({ code: ModulesErrorCode.SetupSessionClosed })
        return saved
    }

    /**
     * Applies the open draft: a new immutable context version becomes the one in use and the agent of the installation runs on it right
     * away (its instructions and notes carry the confirmed setup, its OpenClaw copy is synced). Answers the number of the version.
     */
    async apply(principalId: string, workspaceId: string, installationId: string, locale: Locale): Promise<number> {
        const member = await this.members.require(principalId, workspaceId, GOVERNORS)
        const installation = await this.installationOf(workspaceId, installationId)
        const module = await this.modules.find(installation.moduleKey)
        const draft = await this.openDraft(installation, locale)
        if (!allGatesConfirmed(module, draft.gateEvidence)) {
            throw new ModulesError({ code: ModulesErrorCode.GatesUnconfirmed })
        }
        const snapshot = snapshotOf(draft.draft, draft.gateEvidence)
        const last = await this.versions.latest(installation.id)
        if (last !== null && installation.activeContextVersionId === last.id && sameSnapshot(last.snapshot, snapshot)) {
            throw new ModulesError({ code: ModulesErrorCode.SetupUnchanged })
        }
        const version = (last?.version ?? 0) + 1
        const created = await this.versions.insert({
            workspaceId,
            installationId: installation.id,
            version,
            snapshot,
            appliedBy: member.displayName,
        })
        const keepsStatus = installation.status !== "installing" && installation.status !== "setup"
        await this.installations.activateVersion(
            workspaceId,
            installation.id,
            created.id,
            keepsStatus ? installation.status : "ready",
        )
        if (installation.agentId !== null) {
            await this.writeAgentTexts(
                principalId,
                workspaceId,
                installation.agentId,
                agentTextsOf(module, snapshot, version, locale),
            )
        }
        await this.sessions.close(draft.id)
        await this.openDraft(installation, locale)
        await this.events.record({
            workspaceId,
            kind: "module.context_applied",
            actor: member.displayName,
            summary: `${module.name[locale]} v${version}`,
        })
        await this.sync.requestNow({ workspaceId, installationId: installation.id, force: false })
        return version
    }

    /** The open draft of an installation: the newest revision when it is a draft, else the next revision opened from the last one. */
    async openDraft(installation: InstallationRecord, locale: Locale): Promise<SetupSessionRecord> {
        const latest = await this.sessions.latest(installation.id)
        if (latest !== null && latest.status === "draft") return latest
        const opened = await this.sessions.open({
            workspaceId: installation.workspaceId,
            installationId: installation.id,
            revision: (latest?.revision ?? 0) + 1,
            draft: latest?.draft ?? EMPTY_DRAFT,
            gateEvidence: latest?.gateEvidence ?? {},
        })
        if (opened === null) {
            // Another call opened the same revision first: that session is the draft.
            const again = await this.sessions.latest(installation.id)
            if (again === null) throw new ModulesError({ code: ModulesErrorCode.InstallationNotFound })
            return again
        }
        if (latest === null) await this.welcome(installation, opened, locale)
        return opened
    }

    private async welcome(
        installation: InstallationRecord,
        session: SetupSessionRecord,
        locale: Locale,
    ): Promise<void> {
        const module = await this.modules.find(installation.moduleKey)
        const typeName = module.name[locale]
        await this.messages.post({
            workspaceId: installation.workspaceId,
            setupSessionId: session.id,
            role: "assistant",
            author: "NIVO",
            body: this.catalog.get(
                "setup.welcome",
                { module: installation.isMulti ? `${typeName} - ${installation.name}` : typeName },
                locale,
            ),
        })
    }

    private async writeAgentTexts(
        principalId: string,
        workspaceId: string,
        agentId: string,
        texts: AgentTexts,
    ): Promise<void> {
        const profile = await this.agents.profileOf(workspaceId, agentId)
        if (profile === null) return
        await this.agents.setTexts(principalId, workspaceId, agentId, {
            instructions: `${stripSetupBlock(profile.instructions)}\n\n${texts.instructions}`.trim(),
            knowledge: `${stripSetupBlock(profile.knowledge)}\n\n${texts.knowledge}`.trim(),
        })
    }

    private async installationOf(workspaceId: string, installationId: string): Promise<InstallationRecord> {
        const found = await this.installations.find(workspaceId, installationId)
        if (found === null) throw new ModulesError({ code: ModulesErrorCode.InstallationNotFound })
        return found
    }

    private async draftOf(workspaceId: string, sessionId: string): Promise<SetupSessionRecord> {
        const session = await this.sessions.find(workspaceId, sessionId)
        if (session === null || session.status !== "draft") {
            throw new ModulesError({ code: ModulesErrorCode.SetupSessionClosed })
        }
        return session
    }
}
