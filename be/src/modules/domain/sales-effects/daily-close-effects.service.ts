import { Injectable, Optional, type OnModuleInit } from "@nestjs/common"
import type { EffectPayload, NodeQuery } from "@nivo-lite/agent-sdk/node"
import {
    TOOL,
    closeReportOf,
    coreTools,
    refusalOf,
    reportDailyCloseEffect,
    shopDayOf,
    shopNoonMsOf,
    type CloseReport,
    type CloseReportPorts,
    type EffectFact,
    type EffectFacts,
} from "@nivo-lite/blocks-core"
import { GraphNodeRegistryService, type NodeTurn } from "@modules/domain/graph-nodes"
import { McpGatewayError, McpGatewayErrorCode, type GatewayJson } from "@modules/domain/mcp-gateway"
import { BankNativeService } from "@modules/domain/native-tools"
import { TeamChatAudienceService, lineKeyOf } from "@modules/domain/team-chat"
import { InjectClock, type Clock } from "@modules/platform/clock"
import { eachInOrder } from "@modules/platform/primitives"
import { SalesEffectsError, SalesEffectsErrorCode } from "./errors/sales-effects.error"
import { isAnswerOf, isRowsOf } from "./daily-close.policy"

/** The bank's own list, as the `nivo.bank.transaction.list` tool answers it: its result schema judges every answer the close report reads. */
const BANK_RESULT = coreTools.find((tool) => tool.id === TOOL.bankTransactions)?.result

/** The tool of the bank adapter that lists movements. */
const BANK_LIST = "transactions"

/** The reason the bank adapter gives when the workspace has no live bank feed. */
const NOT_CONNECTED = "not_connected"

/** Whether a failure is the bank adapter's answer that the workspace has no live bank feed. */
const isNotConnected = (cause: unknown): boolean =>
    cause instanceof McpGatewayError &&
    cause.code === McpGatewayErrorCode.NativeRefused &&
    cause.params.reason === NOT_CONNECTED

/** The figures of the cards as facts: the words and amounts the cards show, never one the caller typed. */
const factsOf = (day: string, report: CloseReport): EffectFacts => ({
    day,
    close: report.kind,
    cards: report.posts.map((post) => ({
        title: post.payload.title,
        summary: post.payload.summary,
        rows: post.payload.payload.rows.map((row) => ({ label: row.label, value: row.value })),
        differences: post.payload.payload.differences.length,
        notes: [...post.payload.payload.notes],
        partial: post.payload.payload.partial,
    })),
})

@Injectable()
/**
 * The executor of `nivo.report.daily.close`: the evening report step's agent names the day (today when it names none) and everything with
 * money in it happens here, from the records. It runs the close report (`closeReportOf`): the day's figures from the books (the credits
 * of the workspace) and the bank's own list, and on the last evening of the month the reconciliation of the bank against the ledger. It
 * posts each card to the team itself, server to server (no agent-facing payload carries a card), each once for its period
 * (`accounting-daily:<day>`, `accounting-month:<yyyy-mm>`), so a step that runs again posts nothing twice. It answers the chat message of the first card with the
 * figures as facts, so the agent mentions them as the records say and types none. A day after today, a day that does not exist and a
 * workspace with no live bank feed are refusal facts, and nothing is posted: without the feed no credit reaches the books, and a card of
 * them would read as complete when it is not.
 */
export class DailyCloseEffectsService implements OnModuleInit {
    constructor(
        @InjectClock() private readonly clock: Clock,
        @Optional() private readonly registry?: GraphNodeRegistryService,
        @Optional() private readonly bank?: BankNativeService,
        @Optional() private readonly chat?: TeamChatAudienceService,
    ) {}

    /** Registers the executor when the app hosts graph nodes. */
    onModuleInit(): void {
        this.registry?.addExecutor({
            effect: TOOL.reportDailyClose,
            execute: (turn, payload) => this.close(turn, payload),
        })
    }

    private async close(turn: NodeTurn, payload: EffectPayload): Promise<EffectFact> {
        const given = reportDailyCloseEffect.payload.safeParse(payload)
        const { registry, chat } = this
        if (!given.success || registry === undefined || chat === undefined) {
            throw new SalesEffectsError({ code: SalesEffectsErrorCode.InvalidPayload })
        }
        const today = shopDayOf(this.clock.now().toISOString())
        const day = given.data.day ?? today
        const slotMs = shopNoonMsOf(day)
        if (Number.isNaN(slotMs) || shopDayOf(new Date(slotMs).toISOString()) !== day) {
            return refusalOf("day_invalid", { day })
        }
        if (day > today) return refusalOf("day_ahead", { day, today })
        const bank = this.bank
        if (bank === undefined) return refusalOf("bank_not_connected", { day })
        const refusals = new Set<string>()
        const report = await closeReportOf(this.portsOf(turn, registry, bank, refusals), slotMs, turn.locale)
        if (refusals.has(NOT_CONNECTED)) return refusalOf("bank_not_connected", { day })
        return this.posted(turn, chat, day, report)
    }

    /**
     * Posts each card once for its period, server to server: always in the founder's direct room, and in the agent's own team room too
     * when it holds the right to post there. The card is the close report's, under the period's key, so a step that runs again finds the
     * lines it wrote. Answers the first card's message with the figures and the route (the rooms posted to, what was skipped and why); a
     * line that cannot be written fails the step.
     */
    private async posted(
        turn: NodeTurn,
        chat: TeamChatAudienceService,
        day: string,
        report: CloseReport,
    ): Promise<EffectFact> {
        const ids: Array<string> = []
        const routes: Array<EffectFacts> = []
        await eachInOrder(report.posts, async (post) => {
            const posted = await chat.postTeamCard(turn.workspaceId, {
                agentId: turn.agentId,
                audience: "own",
                message: post.payload,
                key: lineKeyOf(post.dedupeKey),
            })
            ids.push(posted.messageId)
            routes.push(posted.facts)
        })
        const [first] = ids
        if (first === undefined) throw new SalesEffectsError({ code: SalesEffectsErrorCode.ReportNotPosted })
        return {
            kind: "chat-message",
            id: first,
            facts: { ...factsOf(day, report), route: routes[0] ?? {}, messageIds: ids },
        }
    }

    /**
     * What the close report reads with: the books of the workspace through the registered data port, and the bank through its adapter,
     * as an internal caller of the run's agent. A bank that says the workspace has no live feed is noted in `refusals`, so the close refuses.
     */
    private portsOf(
        turn: NodeTurn,
        registry: GraphNodeRegistryService,
        bank: BankNativeService,
        refusals: Set<string>,
    ): CloseReportPorts {
        return {
            data: {
                read: async <T>(kind: string, query: NodeQuery): Promise<ReadonlyArray<T>> => {
                    const rows = await registry.portOf(kind).read(turn, query, "workspace")
                    if (!isRowsOf<T>(rows)) throw new SalesEffectsError({ code: SalesEffectsErrorCode.InvalidPayload })
                    return rows
                },
            },
            tools: {
                call: async <R>(name: string, args: Readonly<Record<string, unknown>>): Promise<R> => {
                    if (name !== TOOL.bankTransactions || BANK_RESULT === undefined) {
                        throw new SalesEffectsError({ code: SalesEffectsErrorCode.InvalidPayload })
                    }
                    const asked: GatewayJson = { ...args }
                    const answer = await bank
                        .invoke(turn.workspaceId, BANK_LIST, asked, { agentId: turn.agentId, conversationId: null })
                        .catch((cause: unknown) => {
                            if (isNotConnected(cause)) refusals.add(NOT_CONNECTED)
                            throw cause
                        })
                    if (!isAnswerOf<R>(answer, BANK_RESULT))
                        throw new SalesEffectsError({ code: SalesEffectsErrorCode.InvalidPayload })
                    return answer
                },
            },
        }
    }
}
