import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { GenerationsService } from "@modules/domain/ai-generations"
import type { GenerationState } from "@modules/domain/ai-generations"
import { AuthorityRulesService } from "@modules/domain/authority-rules"
import { ContentAiStoreService, ContentEditorService } from "@modules/domain/content-items"
import { ContentPlansService } from "@modules/domain/content-plans"
import { EvidenceService } from "@modules/domain/decisions"
import { EventsService } from "@modules/domain/events"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { DomainError } from "@modules/platform/errors"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { idsOf, isBrandContext, isContentMediaRef, isPlannedSlot, numeric, objectOf } from "./content-ai-context.policy"
import {
    cleanHashtags,
    draftVariants,
    isJsonObject,
    parseContentJson,
    planIdeas,
    trimmedText,
} from "./content-ai-prompt.policy"
import { isPlanChannel } from "./content-ai-planning.policy"
import { ContentAiError, ContentAiErrorCode } from "./errors/content-ai.error"
import { ContentAiLogEvent } from "./content-ai.log-events"

@Injectable()
/** Applies queued generation output once, atomically with its audit evidence. */
export class ContentAiCompletionService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectClock() private readonly clock: Clock,
        @InjectLogger() private readonly logger: Logger,
        private readonly generations: GenerationsService,
        private readonly rules: AuthorityRulesService,
        private readonly editor: ContentEditorService,
        private readonly store: ContentAiStoreService,
        private readonly plans: ContentPlansService,
        private readonly evidence: EvidenceService,
        private readonly events: EventsService,
    ) {}

    /** Called by the fenced generation step; unrelated generations are ignored. */
    async complete(workspaceId: string, generationId: string): Promise<void> {
        const state = await this.generations.state(workspaceId, generationId)
        if (state === null || !["content_plan", "content_draft"].includes(state.purpose)) return
        const childContext = objectOf(state.input.context)
        const rootId = trimmedText(childContext.rootId) || generationId
        try {
            await this.entityManager.transaction(async (tx) => {
                const root = await this.generations.state(workspaceId, rootId, tx, true)
                if (
                    root === null ||
                    root.status === "error" ||
                    root.status === "cancelled" ||
                    isJsonObject(root.output.result)
                )
                    return
                const context = objectOf(root.input.context)
                if (!idsOf(context).includes(state.id)) return
                if (state.status === "error" || state.status === "cancelled") {
                    await this.generations.recordFailure(workspaceId, rootId, ContentAiErrorCode.Failed, tx)
                    return
                }
                if (state.status !== "done" || state.text === null) return
                if (parseContentJson(state.text) === null) {
                    await this.askAgainAfterUnreadable(state, root, childContext, context, tx)
                    return
                }
                const states = await Promise.all(
                    idsOf(context).map((id) => this.generations.state(workspaceId, id, tx)),
                )
                if (
                    !states.every(
                        (item): item is GenerationState =>
                            item !== null && item.status !== "error" && item.status !== "cancelled",
                    )
                )
                    throw new ContentAiError({ code: ContentAiErrorCode.Failed })
                if (states.some((item) => item.status !== "done")) return
                const result =
                    context.operation === "plan"
                        ? await this.applyPlan(root, context, states, tx)
                        : await this.applyDraft(root, context, tx)
                await this.generations.recordResult(workspaceId, rootId, result, tx)
            })
        } catch (cause) {
            this.logger.error(ContentAiLogEvent.CompletionFailed, cause, { workspaceId, generationId })
            const code = cause instanceof DomainError ? cause.code : ContentAiErrorCode.Failed
            await this.entityManager.transaction((tx) => this.generations.recordFailure(workspaceId, rootId, code, tx))
        }
    }

    private async draftingBlocked(workspaceId: string): Promise<boolean> {
        return (await this.rules.ruleFor({ workspaceId }, "draft_post", null))?.mode === "never"
    }

    private async requireDrafting(workspaceId: string): Promise<void> {
        if (await this.draftingBlocked(workspaceId))
            throw new ContentAiError({ code: ContentAiErrorCode.DraftingBlocked })
    }

    private async askAgainAfterUnreadable(
        state: GenerationState,
        root: GenerationState,
        child: Record<string, unknown>,
        context: Record<string, unknown>,
        tx: EntityManager,
    ): Promise<void> {
        if (numeric(child.attempt) === 2) throw new ContentAiError({ code: ContentAiErrorCode.InvalidAnswer })
        const messages = state.messages
        const request = await this.generations.request(
            {
                workspaceId: state.workspaceId,
                purpose: state.purpose,
                module: "content",
                kind: "engine",
                responseFormat: "json",
                messages,
                timeoutMs: numeric(state.input.timeout_ms) ?? 120000,
            },
            { ...child, rootId: root.id, attempt: 2 },
            tx,
        )
        await this.generations.setContext(
            root.workspaceId,
            root.id,
            { ...context, generationIds: idsOf(context).map((id) => (id === state.id ? request.id : id)) },
            tx,
        )
    }

    private async applyDraft(
        root: GenerationState,
        context: Record<string, unknown>,
        tx: EntityManager,
    ): Promise<Record<string, unknown>> {
        const state = await this.generations.state(root.workspaceId, idsOf(context)[0] ?? root.id, tx)
        const parsed = parseContentJson(state?.text ?? "")
        if (parsed === null) throw new ContentAiError({ code: ContentAiErrorCode.InvalidAnswer })
        await this.requireDrafting(root.workspaceId)
        const itemId = trimmedText(context.itemId)
        const item = await this.editor.get(root.workspaceId, itemId)
        const channels = (Array.isArray(context.channels) ? context.channels : []).filter(isPlanChannel)
        const brand = context.brand
        if (!isBrandContext(brand)) throw new ContentAiError({ code: ContentAiErrorCode.InvalidAnswer })
        const written = draftVariants(parsed, channels, brand)
        if (Object.keys(written.variants).length === 0)
            throw new ContentAiError({ code: ContentAiErrorCode.EmptyAnswer })
        const library = Array.isArray(context.library) ? context.library.filter(isContentMediaRef) : []
        const picked = (Array.isArray(parsed.media) ? parsed.media : [])
            .map(Number)
            .filter((number) => Number.isInteger(number) && number >= 1 && number <= library.length)
            .slice(0, 2)
        const pillars = Array.isArray(context.pillars) ? context.pillars.filter(isJsonObject) : []
        const pillar =
            item.pillarId === null
                ? pillars.find(
                      (entry) => trimmedText(entry.name).toLowerCase() === trimmedText(parsed.pillar).toLowerCase(),
                  )
                : undefined
        const seconds = Math.round((this.clock.now().getTime() - Date.parse(root.createdAt)) / 1000)
        await this.store.applyDraft(
            root.workspaceId,
            itemId,
            {
                variants: { ...item.variants, ...written.variants },
                hashtags: cleanHashtags(
                    Array.isArray(parsed.hashtags)
                        ? parsed.hashtags.filter((tag): tag is string => typeof tag === "string")
                        : item.hashtags,
                ),
                media: [
                    ...item.media.filter((file) => !file.suggested),
                    ...picked.flatMap((number) =>
                        library
                            .filter((_file, index) => index + 1 === number)
                            .map((file) => ({ ...file, suggested: true })),
                    ),
                ],
                channels: [...new Set([...item.channels, ...channels])],
                ...(pillar === undefined ? {} : { pillarId: trimmedText(pillar.id) }),
                ...(item.source === "quick" && trimmedText(parsed.title)
                    ? { title: trimmedText(parsed.title).slice(0, 200) }
                    : {}),
                draftedAt: this.clock.now().toISOString(),
                expectedUpdatedAt: trimmedText(context.expectedUpdatedAt) || undefined,
                evidence: [
                    {
                        at: this.clock.now().toISOString(),
                        kind: "drafted",
                        by: "NIVO",
                        text: `${root.id}: ${channels.join(", ")}`,
                    },
                ],
            },
            tx,
        )
        await this.evidence.decide(
            { workspaceId: root.workspaceId, actor: "NIVO", locale: "en" },
            {
                work_item_id: null,
                lead_id: null,
                department: "content",
                action: "draft_post",
                decided_by: "NIVO",
                decider_kind: "policy",
                outcome: "auto_done",
                reason: "routine",
                note: item.title,
            },
            tx,
        )
        await this.events.record(
            {
                workspaceId: root.workspaceId,
                kind: "content.drafted",
                actor: "NIVO",
                summary: item.title,
                evidence: channels.join(", "),
            },
            tx,
        )
        return { itemId, seconds, warnings: written.warnings }
    }

    private async applyPlan(
        root: GenerationState,
        context: Record<string, unknown>,
        states: ReadonlyArray<GenerationState>,
        tx: EntityManager,
    ): Promise<Record<string, unknown>> {
        const slots = Array.isArray(context.slots) ? context.slots.filter(isPlannedSlot) : []
        const accepted = new Map<number, { title: string; brief: string }>()
        for (const state of states) {
            const parsed = parseContentJson(state.text ?? "")
            if (parsed === null) throw new ContentAiError({ code: ContentAiErrorCode.InvalidAnswer })
            const child = objectOf(state.input.context)
            const allowed = Array.isArray(child.allowedSlots) ? child.allowedSlots : []
            for (const idea of planIdeas(parsed))
                if (allowed.includes(idea.slot) && !accepted.has(idea.slot)) accepted.set(idea.slot, idea)
        }
        const items = slots.flatMap((slot) => {
            const idea = accepted.get(slot.n)
            return idea === undefined
                ? []
                : [
                      {
                          ...idea,
                          pillarId: slot.pillar.id,
                          channels: slot.channels,
                          scheduledAt: slot.at,
                          holidayKey: slot.holiday?.key ?? null,
                      },
                  ]
        })
        if (items.length === 0) throw new ContentAiError({ code: ContentAiErrorCode.EmptyAnswer })
        const aiMs = this.clock.now().getTime() - Date.parse(root.createdAt)
        const plan = await this.plans.apply(
            root.workspaceId,
            {
                month: trimmedText(context.month),
                actor: trimmedText(context.actor),
                items,
                generationId: states.map((state) => state.id).join(","),
                aiMs,
                meta: {
                    slots: slots.length,
                    quota: context.quota,
                    holidays: context.holidays,
                    sources: context.sources,
                },
            },
            tx,
        )
        await this.events.record(
            {
                workspaceId: root.workspaceId,
                kind: "content.planned",
                actor: trimmedText(context.actor),
                summary: trimmedText(context.month),
                evidence: `${plan.ideas}: ${root.id}`,
            },
            tx,
        )
        return { ...plan, seconds: Math.round(aiMs / 1000), skippedPast: numeric(context.skippedPast) ?? 0 }
    }
}
