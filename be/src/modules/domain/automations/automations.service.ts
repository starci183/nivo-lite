import { Injectable, Optional } from "@nestjs/common"
import { AutomationPipelinesService } from "@modules/domain/automation-pipelines"
import type { PipelineWrite } from "@modules/domain/automation-pipelines"
import { AutomationRunsService } from "@modules/domain/automation-runs"
import { AutomationTemplatesService } from "@modules/domain/automation-templates"
import type { TemplateDefinition } from "@modules/domain/automation-templates"
import { N8nRunsService } from "@modules/domain/n8n-runs"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import type { WorkspaceMember, WorkspaceRole } from "@modules/domain/workspace-members"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectMessageCatalog } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { eachInOrder } from "@modules/platform/primitives"
import { AutomationEngineService } from "./automation-engine.service"
import { AutomationExtensionsService } from "./automation-extensions.service"
import type { AutomationOffice, AutomationText, GoogleAccount } from "./automation-ports.contracts"
import { AutomationShopService } from "./automation-shop.service"
import type {
    AutomationCard,
    AutomationRunView,
    AutomationSuggestion,
    AutomationsOverview,
    BodyProposal,
    BusinessEventInput,
    PipelinePatch,
    TextParams,
} from "./automations.contracts"
import { InjectAutomationOffice, InjectAutomationText } from "./automations.decorators"
import { AutomationsLogEvent } from "./automations.log-events"
import { AutomationsError, AutomationsErrorCode } from "./errors/automations.error"
import { buildCards, runViewsOf } from "./policies/cards.policy"
import { acceptableProposal, stripQuotes } from "./policies/config.policy"
import { capabilitiesFrom, factsFrom } from "./policies/context.policy"
import { vnClock } from "./policies/hours.policy"
import { previousMonth } from "./policies/scan.policy"
import { eventDataOf } from "./policies/trigger.policy"
import { planAutoSend, planDismiss, planGoogleAccount, planSave, planToggle, writeOf } from "./policies/pipeline.policy"
import { proposalSystem, shopBlock } from "./policies/prompt.policy"

const MANAGER_ROLES: ReadonlyArray<WorkspaceRole> = ["owner", "manager"]
const RUNS_PAGE = 40
const MANUAL_DEDUPE = "manual"
const BODY_EVIDENCE_MAX = 600

interface AuditEntry {
    readonly kind: string
    readonly summary: string
    readonly evidence: string | undefined
}

@Injectable()
/**
 * What an owner or manager does with the automations: see the gallery with the history, switch a template on or off, approve its
 * wording and settings, hide it, answer "send by itself", have the shop's own wording proposed, run a scheduled workflow now.
 * Switching a template on never sends anything by itself: its triggers run through the engine and every customer message passes the gate.
 */
export class AutomationsService {
    constructor(
        @InjectClock() private readonly clock: Clock,
        @InjectMessageCatalog() private readonly catalog: MessageCatalog,
        @InjectLogger() private readonly logger: Logger,
        @InjectAutomationOffice() private readonly office: AutomationOffice,
        @Optional() @InjectAutomationText() private readonly text: AutomationText | undefined,
        private readonly templates: AutomationTemplatesService,
        private readonly pipelines: AutomationPipelinesService,
        private readonly runs: AutomationRunsService,
        private readonly shop: AutomationShopService,
        private readonly members: WorkspaceMembersService,
        private readonly extensions: AutomationExtensionsService,
        private readonly n8nRuns: N8nRunsService,
        private readonly engine: AutomationEngineService,
    ) {}

    /** Everything the automations screen shows: one card per template, the recent runs and the shop for previews. */
    async overview(userId: string, workspaceId: string): Promise<AutomationsOverview> {
        await this.members.require(userId, workspaceId, MANAGER_ROLES)
        return this.assemble(workspaceId)
    }

    /** The run history of the workspace, or of one template when a key is given, newest first; a template never switched has none. */
    async history(userId: string, workspaceId: string, templateKey: string): Promise<ReadonlyArray<AutomationRunView>> {
        await this.members.require(userId, workspaceId, MANAGER_ROLES)
        return this.runViews(workspaceId, templateKey || null)
    }

    /**
     * Changes one pipeline: hide or restore it, move its Google account, save its settings and wording, answer "send by itself",
     * switch it on or off. The changes of one request apply in that order; the answer is the card as it stands afterwards.
     */
    async update(
        userId: string,
        workspaceId: string,
        templateKey: string,
        patch: PipelinePatch,
    ): Promise<AutomationCard> {
        const member = await this.members.require(userId, workspaceId, MANAGER_ROLES)
        if (Object.values(patch).every((value) => value === undefined)) {
            throw new AutomationsError({ code: AutomationsErrorCode.NothingToChange })
        }
        const def = await this.templates.templateOf(templateKey)
        const previous = writeOf(await this.pipelines.findPipeline(workspaceId, templateKey))
        let write = previous
        if (patch.dismissed !== undefined) write = planDismiss(write, patch.dismissed)
        if (patch.googleConnectionId !== undefined) {
            const accounts = await this.extensions.googleAccounts(workspaceId)
            write = planGoogleAccount(
                def,
                write,
                patch.googleConnectionId,
                accounts.map((account) => account.id),
            )
        }
        if (patch.values !== undefined || patch.body !== undefined) {
            const context = await this.shop.contextFor(workspaceId, def.moduleKey)
            write = planSave(def, write, { values: patch.values, body: patch.body }, context.version)
        }
        if (patch.autoSend !== undefined) write = planAutoSend(write, patch.autoSend)
        if (patch.enabled !== undefined) write = await this.toggle(member, workspaceId, def, write, patch.enabled)
        await this.pipelines.savePipeline(workspaceId, userId, def, write)
        await this.audit(member, workspaceId, def, previous, patch)
        return this.cardOf(workspaceId, templateKey)
    }

    /**
     * Proposes the shop's own wording of a template from its active context (one model call, nothing is saved): the owner reviews it
     * and saves it with `update`. `generated` is false when the standard wording is returned because no model could answer.
     */
    async proposeBody(userId: string, workspaceId: string, templateKey: string): Promise<BodyProposal> {
        await this.members.require(userId, workspaceId, MANAGER_ROLES)
        const def = await this.templates.templateOf(templateKey)
        if (def.defaultBody === null) throw new AutomationsError({ code: AutomationsErrorCode.NoMessage })
        const base = def.defaultBody.vi
        const [context, shop] = await Promise.all([
            this.shop.contextFor(workspaceId, def.moduleKey),
            this.shop.shopOf(workspaceId),
        ])
        const raw =
            this.text === undefined
                ? null
                : await this.text.generate({
                      workspaceId,
                      purpose: "personalize",
                      system: proposalSystem(def, base),
                      prompt: `${shopBlock(shop, context.text)}\n\nTemplate to rewrite:\n${base}`,
                  })
        const proposal = raw === null ? "" : stripQuotes(raw)
        return acceptableProposal(proposal, def, base)
            ? { body: proposal, generated: true, contextVersion: context.version }
            : { body: base, generated: false, contextVersion: context.version }
    }

    /** One run of a scheduled n8n template now; the result appears in the run history. */
    async runNow(userId: string, workspaceId: string, templateKey: string): Promise<void> {
        await this.members.require(userId, workspaceId, MANAGER_ROLES)
        const def = await this.templates.templateOf(templateKey)
        if (def.executor !== "n8n" || def.trigger.kind !== "schedule" || def.n8n === undefined) {
            throw new AutomationsError({ code: AutomationsErrorCode.RunNowUnavailable })
        }
        const pipeline = await this.pipelines.findPipeline(workspaceId, templateKey)
        if (pipeline === null || !pipeline.enabled)
            throw new AutomationsError({ code: AutomationsErrorCode.PipelineOff })
        const now = this.clock.now()
        const today = vnClock(now).day
        const id = await this.n8nRuns.startRun({
            workspaceId,
            templateKey,
            webhookPath: def.n8n.webhook,
            config: { ...pipeline.config, ...(pipeline.body ? { body: pipeline.body } : {}) },
            data: def.trigger.event === "schedule.monthly" ? { period: previousMonth(today) } : { date: today },
            dedupe: `${MANUAL_DEDUPE}:${now.getTime()}`,
        })
        if (id === null) throw new AutomationsError({ code: AutomationsErrorCode.RunNotQueued })
    }

    /** Tells the engine a business event happened in the workspace; any member may report what they just did. */
    async emit(userId: string, workspaceId: string, event: BusinessEventInput): Promise<void> {
        await this.members.require(userId, workspaceId)
        await this.engine.onBusinessEvent({
            workspaceId,
            event: event.event,
            dedupe: event.dedupe,
            data: eventDataOf(event.data),
        })
    }

    /** The Google accounts a spreadsheet automation can write with. */
    async googleAccounts(userId: string, workspaceId: string): Promise<ReadonlyArray<GoogleAccount>> {
        await this.members.require(userId, workspaceId, MANAGER_ROLES)
        return this.extensions.googleAccounts(workspaceId)
    }

    /** Templates worth proposing for a module right after it is installed; nothing is switched on. */
    async suggestFor(
        userId: string,
        workspaceId: string,
        moduleKey: string,
    ): Promise<ReadonlyArray<AutomationSuggestion>> {
        const { cards } = await this.overview(userId, workspaceId)
        return cards
            .filter(
                (card) =>
                    card.def.moduleKey === (moduleKey || null) &&
                    card.proposed &&
                    !card.comingSoon &&
                    !card.enabled &&
                    !card.dismissed &&
                    card.missing.length === 0,
            )
            .map((card) => ({ key: card.key, name: card.def.name, reason: card.def.description }))
    }

    /* ------------------------------------------------------------------ helpers */

    private async runViews(workspaceId: string, templateKey: string | null): Promise<ReadonlyArray<AutomationRunView>> {
        const keys = await this.pipelines.pipelineKeys(workspaceId)
        if (templateKey !== null && !keys.some((candidate) => candidate.template_key === templateKey)) return []
        return runViewsOf(await this.runs.runsOf({ workspaceId, templateKey, limit: RUNS_PAGE }), keys)
    }

    private async assemble(workspaceId: string): Promise<AutomationsOverview> {
        const [rows, templates] = await Promise.all([
            this.shop.overviewRows(workspaceId),
            this.templates.listTemplates(),
        ])
        const contexts = this.shop.contextsOf(rows)
        const capabilities = capabilitiesFrom(
            contexts,
            rows.knowledge,
            rows.due_invoices,
            { contracts: rows.contracts, shipped: rows.shipped_orders },
            this.shop.shopPatterns(),
        )
        const runs = runViewsOf(rows.runs, rows.pipelines)
        const cards = buildCards({
            rows,
            templates,
            contexts,
            facts: factsFrom(contexts, capabilities, rows.connections, rows.chat_agents),
            runs,
            label: this.shop.labeller(),
        })
        const { shop, hours, tone } = this.shop.shopFrom(rows)
        return { cards, runs, shop: { shop, hours, tone }, sample: this.shop.sample() }
    }

    private async cardOf(workspaceId: string, templateKey: string): Promise<AutomationCard> {
        const { cards } = await this.assemble(workspaceId)
        const card = cards.find((candidate) => candidate.key === templateKey)
        if (card === undefined) throw new AutomationsError({ code: AutomationsErrorCode.NotSaved })
        return card
    }

    /** Switching on needs every requirement met, and lets the extension that owns the template prepare it (a spreadsheet is created). */
    private async toggle(
        member: WorkspaceMember,
        workspaceId: string,
        def: TemplateDefinition,
        write: PipelineWrite,
        enabled: boolean,
    ): Promise<PipelineWrite> {
        const card = enabled ? await this.cardOf(workspaceId, def.key) : undefined
        const context = await this.shop.contextFor(workspaceId, def.moduleKey)
        const next = planToggle(def, write, enabled, card?.missing ?? [], context.version)
        if (!enabled) return next
        return { ...next, config: await this.extensions.prepareEnable(workspaceId, member.userId, def, next.config) }
    }

    /** The evidence of what the owner changed; a line that cannot be written is logged and never fails the change. */
    private async audit(
        member: WorkspaceMember,
        workspaceId: string,
        def: TemplateDefinition,
        before: PipelineWrite,
        patch: PipelinePatch,
    ): Promise<void> {
        const name = def.name.vi
        const entries: Array<AuditEntry> = []
        if (patch.enabled !== undefined) {
            entries.push({
                kind: patch.enabled ? "automation.enabled" : "automation.disabled",
                summary: this.say(patch.enabled ? "audit.enabled" : "audit.disabled", { name }),
                evidence: undefined,
            })
        }
        if (patch.body !== undefined) {
            entries.push({
                kind: "automation.body_saved",
                summary: this.say("audit.bodySaved", { name }),
                evidence: patch.body.trim().slice(0, BODY_EVIDENCE_MAX),
            })
        }
        if (patch.autoSend !== undefined) {
            entries.push({
                kind: patch.autoSend ? "automation.auto_send_granted" : "automation.auto_send_declined",
                summary: this.say(patch.autoSend ? "audit.autoSendGranted" : "audit.autoSendDeclined", { name }),
                evidence: this.say("audit.streak", { count: before.approvalStreak }),
            })
        }
        await eachInOrder(entries, (entry) =>
            this.office
                .logEvidence(workspaceId, {
                    kind: entry.kind,
                    actor: member.displayName,
                    summary: entry.summary,
                    evidence: entry.evidence,
                })
                .catch((cause: unknown) => {
                    this.logger.error(AutomationsLogEvent.AuditFailed, cause, { kind: entry.kind })
                }),
        )
    }

    private say(key: string, params: TextParams = {}): string {
        return this.catalog.get(`automations.${key}`, params, "vi")
    }
}
