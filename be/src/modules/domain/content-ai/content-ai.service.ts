import { ContentAiCompletionService } from "./content-ai-completion.service"
import { idsOf, isChannelWarning, numeric, objectOf } from "./content-ai-context.policy"
import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { GenerationsService } from "@modules/domain/ai-generations"
import { AuthorityRulesService } from "@modules/domain/authority-rules"
import { ContentAiStoreService, ContentEditorService } from "@modules/domain/content-items"
import type { ContentItem } from "@modules/domain/content-items"
import { ContentConfigurationService } from "@modules/domain/content-settings"
import { ContentMediaService } from "@modules/domain/content-media"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { eachInOrder } from "@modules/platform/primitives"
import type {
    ContentAiRequested,
    ContentAiStatus,
    ContentDraftRequest,
    ContentQuickDraftRequest,
} from "./content-ai.contracts"
import { toContentAiReview } from "./content-ai-status.mapper"
import { ContentBrandService } from "./content-brand.service"
import {
    eventsForMonth,
    isPlanChannel,
    monthRange,
    parseMonth,
    planSlots,
    vietnamClock,
} from "./content-ai-planning.policy"
import {
    buildBrand,
    draftSystem,
    draftUser,
    offerLines,
    planSystem,
    planUser,
    slotLine,
    trimmedText,
} from "./content-ai-prompt.policy"
import type { BrandMaterial } from "./content-ai-prompt.policy"
import type { InboxClaim } from "./content-ai.contracts"
import { ContentAiError, ContentAiErrorCode } from "./errors/content-ai.error"

type DraftItem = Pick<
    ContentItem,
    "id" | "title" | "brief" | "channels" | "pillarId" | "holidayKey" | "scheduledAt" | "source" | "updatedAt"
>
const CHUNK = 12
@Injectable()
/** Enqueues marketing drafts and plans; the fenced generation job applies their results. */
export class ContentAiService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectClock() private readonly clock: Clock,
        private readonly generations: GenerationsService,
        private readonly completion: ContentAiCompletionService,
        private readonly members: WorkspaceMembersService,
        private readonly rules: AuthorityRulesService,
        private readonly editor: ContentEditorService,
        private readonly store: ContentAiStoreService,
        private readonly configuration: ContentConfigurationService,
        private readonly media: ContentMediaService,
        private readonly brand: ContentBrandService,
    ) {}

    /** Member-visible public brand material used by the workbench. */
    async brandFor(userId: string, workspaceId: string): Promise<BrandMaterial> {
        await this.members.require(userId, workspaceId)
        return this.brand.material(workspaceId)
    }

    /** Whether the owner explicitly disabled content drafting. */
    async draftingBlockedFor(userId: string, workspaceId: string): Promise<boolean> {
        await this.members.require(userId, workspaceId)
        return this.draftingBlocked(workspaceId)
    }

    /** Other recent titles in the same workspace. */
    async recentTitlesFor(userId: string, workspaceId: string, id: string): Promise<ReadonlyArray<string>> {
        await this.members.require(userId, workspaceId)
        return this.store.recentTitles(workspaceId, id)
    }

    /** Queues the first draft or a rewrite of an editable post. */
    async requestDraft(userId: string, workspaceId: string, input: ContentDraftRequest): Promise<ContentAiRequested> {
        const member = await this.members.require(userId, workspaceId, ["owner", "manager"])
        await this.requireDrafting(workspaceId)
        const item = await this.editor.get(workspaceId, input.id)
        if (!["idea", "draft"].includes(item.status))
            throw new ContentAiError({ code: ContentAiErrorCode.InvalidInput })
        const prepared = await this.prepareDraft(userId, workspaceId, item, input.hint ?? "")
        return this.entityManager.transaction(async (tx) => {
            const request = await this.generations.request(
                prepared.params,
                { ...prepared.context, actor: member.displayName },
                tx,
            )
            await this.generations.setContext(
                workspaceId,
                request.id,
                { ...prepared.context, actor: member.displayName, rootId: request.id, generationIds: [request.id] },
                tx,
            )
            return { ...request, itemId: item.id }
        })
    }

    /** Creates the quick idea and its generation job in the same transaction. */
    async requestQuickDraft(
        userId: string,
        workspaceId: string,
        input: ContentQuickDraftRequest,
    ): Promise<ContentAiRequested> {
        const member = await this.members.require(userId, workspaceId, ["owner", "manager"])
        await this.requireDrafting(workspaceId)
        const topic = input.topic.trim()
        const channels = [...new Set(input.channels.filter(isPlanChannel))]
        if (topic.length < 3 || topic.length > 12000 || channels.length === 0)
            throw new ContentAiError({ code: ContentAiErrorCode.InvalidInput })
        const item: DraftItem = {
            id: "00000000-0000-0000-0000-000000000000",
            title: (topic.split("\n")[0] ?? topic).slice(0, 80),
            brief: topic,
            channels,
            pillarId: null,
            holidayKey: null,
            scheduledAt: null,
            source: "quick",
            updatedAt: "",
        }
        const prepared = await this.prepareDraft(userId, workspaceId, item, "")
        return this.entityManager.transaction(async (tx) => {
            const created = await this.store.createQuickIdea(userId, workspaceId, { topic, channels }, tx)
            const context = {
                ...prepared.context,
                itemId: created.id,
                actor: member.displayName,
                expectedUpdatedAt: created.updatedAt,
            }
            const request = await this.generations.request(prepared.params, context, tx)
            await this.generations.setContext(
                workspaceId,
                request.id,
                { ...context, rootId: request.id, generationIds: [request.id] },
                tx,
            )
            return { ...request, itemId: created.id }
        })
    }

    /** Enqueues every twelve-slot plan chunk atomically; balance and scheduling remain deterministic. */
    async requestMonthPlan(userId: string, workspaceId: string, month: string): Promise<ContentAiRequested> {
        const member = await this.members.require(userId, workspaceId, ["owner", "manager"])
        const parsed = parseMonth(month)
        if (parsed === null) throw new ContentAiError({ code: ContentAiErrorCode.InvalidInput })
        const [configuration, material, existing] = await Promise.all([
            this.configuration.readAuthorizedConfiguration(workspaceId),
            this.brand.material(workspaceId),
            this.editor.list(userId, workspaceId, monthRange(parsed.y, parsed.m)),
        ])
        if (!configuration.pillars.some((pillar) => pillar.active && pillar.weight > 0))
            throw new ContentAiError({ code: ContentAiErrorCode.NoPillars })
        if (!configuration.cadence.some((cadence) => cadence.postsPerWeek > 0))
            throw new ContentAiError({ code: ContentAiErrorCode.NoCadence })
        const planned = planSlots(month, configuration.cadence, configuration.pillars, this.clock.now())
        if (planned.slots.length === 0) throw new ContentAiError({ code: ContentAiErrorCode.NoSlots })
        const brand = buildBrand(material, configuration.settings)
        const firstChunk = planned.slots.slice(0, CHUNK)
        const chunks = [firstChunk]
        for (let start = CHUNK; start < planned.slots.length; start += CHUNK)
            chunks.push(planned.slots.slice(start, start + CHUNK))
        const context = {
            operation: "plan",
            month,
            actor: member.displayName,
            slots: planned.slots,
            skippedPast: planned.skippedPast,
            sources: brand.sources,
            quota: planned.quota.map((share) => ({ pillar: share.pillar.name, count: share.count })),
            holidays: planned.events.map((event) => event.key),
            attempt: 1,
        }
        return this.entityManager.transaction(async (tx) => {
            const ids: Array<string> = []
            await eachInOrder(chunks, async (slots) => {
                const request = await this.generations.request(
                    {
                        workspaceId,
                        purpose: "content_plan",
                        module: "content",
                        kind: "engine",
                        responseFormat: "json",
                        timeoutMs: 120000,
                        messages: [
                            { role: "system", content: planSystem(brand) },
                            {
                                role: "user",
                                content: planUser({
                                    month,
                                    lines: slots.map((slot) => slotLine(slot, slot.pillar, slot.holiday)),
                                    offers: offerLines(brand),
                                    existing: existing
                                        .filter((item) => !(item.status === "idea" && item.source === "plan"))
                                        .slice(0, 20)
                                        .map((item) => item.title),
                                }),
                            },
                        ],
                    },
                    { operation: "plan", rootId: ids[0], attempt: 1, allowedSlots: slots.map((slot) => slot.n) },
                    tx,
                )
                ids.push(request.id)
            })
            const rootId = ids[0]
            if (rootId === undefined) throw new ContentAiError({ code: ContentAiErrorCode.NoSlots })
            await this.generations.setContext(
                workspaceId,
                rootId,
                { ...context, rootId, generationIds: ids, allowedSlots: firstChunk.map((slot) => slot.n) },
                tx,
            )
            return { id: rootId, status: "queued", itemId: null }
        })
    }

    /** Polls without running providers, changing rows or applying generated content. */
    async status(userId: string, workspaceId: string, id: string): Promise<ContentAiStatus> {
        await this.members.require(userId, workspaceId)
        const root = await this.generations.state(workspaceId, id)
        if (root === null || !["content_plan", "content_draft"].includes(root.purpose))
            throw new ContentAiError({ code: ContentAiErrorCode.NotFound })
        const context = objectOf(root.input.context)
        if (trimmedText(context.rootId) !== id) throw new ContentAiError({ code: ContentAiErrorCode.NotFound })
        const result = objectOf(root.output.result)
        const states = await Promise.all(
            idsOf(context).map((generationId) => this.generations.state(workspaceId, generationId)),
        )
        const succeeded = Object.keys(result).length > 0
        const failed = root.status === "error" || root.status === "cancelled"
        let operationStatus = "queued"
        if (succeeded) operationStatus = "succeeded"
        else if (failed) operationStatus = "failed"
        else if (root.status !== "queued" || states.some((state) => state?.status !== "queued"))
            operationStatus = "running"
        let errorCode: string | null = null
        if (failed)
            errorCode =
                root.errorCode !== null && /^[A-Z][A-Z0-9_]+$/u.test(root.errorCode)
                    ? root.errorCode
                    : ContentAiErrorCode.Failed
        return {
            id,
            status: operationStatus,
            progress: succeeded
                ? 100
                : Math.min(
                      95,
                      Math.round(
                          (states.filter((state) => state?.status === "done").length / Math.max(1, states.length)) * 95,
                      ),
                  ),
            itemId: trimmedText(result.itemId) || trimmedText(context.itemId) || null,
            planId: trimmedText(result.planId) || null,
            resultId: trimmedText(result.itemId) || trimmedText(result.planId) || null,
            ideas: numeric(result.ideas),
            seconds: numeric(result.seconds),
            skippedPast: numeric(result.skippedPast),
            warnings: Array.isArray(result.warnings)
                ? result.warnings.filter(isChannelWarning).map(toContentAiReview)
                : [],
            errorCode,
        }
    }

    /** Applies an engine result through the completion capability. */
    complete(workspaceId: string, generationId: string, claim: InboxClaim): Promise<void> {
        return this.completion.complete(workspaceId, generationId, claim)
    }

    private async draftingBlocked(workspaceId: string): Promise<boolean> {
        return (await this.rules.ruleFor({ workspaceId }, "draft_post", null))?.mode === "never"
    }

    private async requireDrafting(workspaceId: string): Promise<void> {
        if (await this.draftingBlocked(workspaceId))
            throw new ContentAiError({ code: ContentAiErrorCode.DraftingBlocked })
    }

    private async prepareDraft(userId: string, workspaceId: string, item: DraftItem, hint: string) {
        const channels = item.channels.filter(isPlanChannel)
        if (channels.length === 0) throw new ContentAiError({ code: ContentAiErrorCode.InvalidInput })
        const [configuration, material, recent, library] = await Promise.all([
            this.configuration.readAuthorizedConfiguration(workspaceId),
            this.brand.material(workspaceId),
            this.store.recentTitles(workspaceId, item.id),
            this.media.library(userId, workspaceId, 40),
        ])
        const brand = buildBrand(material, configuration.settings)
        const when = vietnamClock(item.scheduledAt === null ? this.clock.now() : new Date(item.scheduledAt))
        const pillar = configuration.pillars.find((entry) => entry.id === item.pillarId) ?? null
        return {
            params: {
                workspaceId,
                purpose: "content_draft",
                module: "content",
                kind: "engine",
                responseFormat: "json" as const,
                timeoutMs: 90000,
                messages: [
                    { role: "system" as const, content: draftSystem(brand, channels) },
                    {
                        role: "user" as const,
                        content: draftUser({
                            title: item.title,
                            brief: item.brief,
                            pillar,
                            pillarNames: configuration.pillars
                                .filter((entry) => entry.active)
                                .map((entry) => entry.name),
                            scheduledAt: item.scheduledAt,
                            holiday:
                                eventsForMonth(when.y, when.m).find((event) => event.key === item.holidayKey) ?? null,
                            hint: hint.trim(),
                            recent,
                            library: library.map((file) => file.name),
                        }),
                    },
                ],
            },
            context: {
                operation: "draft",
                itemId: item.id,
                channels,
                brand,
                library,
                pillars: configuration.pillars,
                expectedUpdatedAt: item.updatedAt || null,
                source: item.source,
                attempt: 1,
            },
        }
    }
}
