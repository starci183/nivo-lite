import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { AgentBindingsService } from "@modules/domain/agent-connections"
import { AgentDirectoryService } from "@modules/domain/agents"
import { ChannelDeliveryService } from "@modules/domain/channels"
import { OfficeLog } from "@modules/domain/module-ops"
import { StaffDirectoryService } from "@modules/domain/staff"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ShiftsNotificationEntity, ShiftsStaffEntity } from "./persistence/entities"
import { staffHandles } from "./policies/staff-handles.policy"
import { ShiftsLogEvent } from "./shifts.log-events"
import { ShiftsTextService } from "./shifts-text.service"

/** What a message of the module is about. */
export type NotifyKind = "publish" | "reminder" | "swap" | "leave" | "no_show" | "gap" | "payroll"

/** The schedule, shift or work item a message is about. */
export interface NoticeLink {
    /** The schedule it is about, when there is one. */
    readonly scheduleId?: string
    /** The shift it is about, when there is one. */
    readonly shiftId?: string
    /** The gate decision that sent it, when there is one. */
    readonly workItemId?: string
}

/** One message to a person. */
export interface StaffNotice extends NoticeLink {
    /** The person (shifts profile id). */
    readonly staffId: string
    /** What the message is about. */
    readonly kind: NotifyKind
    /** The message. */
    readonly body: string
}

/** Where a message to a person went: Office always; Telegram and Zalo when the person is linked and a channel is bound (null: not tried). */
export interface NoticeOutcome {
    /** Office took the line. */
    readonly office: boolean
    /** Telegram accepted the message; null when it was not tried or no channel is bound. */
    readonly telegram: boolean | null
    /** Zalo accepted the message; null when it was not tried or no channel is bound. */
    readonly zalo: boolean | null
}

type Channel = "office" | "telegram" | "zalo"

interface Attempt {
    readonly status: "sent" | "failed" | "skipped"
    readonly error: string | null
}

const SENT: Attempt = { status: "sent", error: null }

/** The most characters a stored message keeps. */
const BODY_MAX = 4000
/** The most characters a stored failure reason keeps. */
const ERROR_MAX = 500
/** The most staff rows and agent handles one Office handle read answers. */
const HANDLES_MAX = 500

/** The first `max` characters of a text, whole characters like Postgres `left`. */
const leftOf = (text: string, max: number): string => Array.from(text).slice(0, max).join("")

const reasonOf = (cause: unknown): string => (cause instanceof Error ? cause.message : String(cause)).slice(0, 200)

@Injectable()
/**
 * Messages of the shifts module to people. Only ever called by a performer (after the authority gate) or for an alert to the owner.
 * Office is always used (one group chat, the person is @tagged); Telegram and Zalo are added when the person is linked (chat id / Zalo
 * user id) AND a connection of that provider is bound to the shifts agent for outbound chat (agent_connections). With none bound the
 * message goes to Office only and the attempt is recorded as skipped. Every message leaves one `shifts_notifications` row per channel
 * as evidence, sent, failed or skipped. A failed channel never stops the others and nothing here throws for a delivery.
 */
export class ShiftsNotifyService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectLogger() private readonly logger: Logger,
        private readonly office: OfficeLog,
        private readonly bindings: AgentBindingsService,
        private readonly agents: AgentDirectoryService,
        private readonly staff: StaffDirectoryService,
        private readonly delivery: ChannelDeliveryService,
        private readonly words: ShiftsTextService,
    ) {}

    /** Tells one person: Office (tagged) and, when linked, Telegram and Zalo. */
    async toStaff(workspaceId: string, notice: StaffNotice): Promise<NoticeOutcome> {
        const person = await this.entityManager.findOne(ShiftsStaffEntity, {
            select: { id: true, name: true, staffId: true, telegramChatId: true, zaloUserId: true },
            where: { workspaceId, id: notice.staffId },
        })
        if (person === null) return { office: false, telegram: null, zalo: null }
        const handle = person.staffId === null ? undefined : (await this.handles(workspaceId)).get(person.staffId)
        const tagged =
            handle === undefined
                ? this.words.text("shifts.tagged", { name: person.name, body: notice.body })
                : `@${handle} ${notice.body}`
        const office = await this.office.postOffice(workspaceId, tagged).then(
            () => SENT,
            (cause: unknown): Attempt => ({ status: "failed", error: reasonOf(cause) }),
        )
        await this.record(workspaceId, notice, "office", tagged, office)
        const telegram =
            person.telegramChatId === null || person.telegramChatId === ""
                ? null
                : await this.viaChannel(workspaceId, "telegram", person.telegramChatId, notice)
        const zalo =
            person.zaloUserId === null || person.zaloUserId === ""
                ? null
                : await this.viaChannel(workspaceId, "zalo_oa", person.zaloUserId, notice)
        return {
            office: office.status === "sent",
            telegram: telegram === null || telegram.status === "skipped" ? null : telegram.status === "sent",
            zalo: zalo === null || zalo.status === "skipped" ? null : zalo.status === "sent",
        }
    }

    /** An alert for the owner and managers (an open shift, a no-show, the monthly close): one Office line, with evidence. */
    async toManagers(
        workspaceId: string,
        body: string,
        kind: NotifyKind = "gap",
        link: NoticeLink = {},
    ): Promise<void> {
        await this.office.postOffice(workspaceId, body)
        await this.record(workspaceId, { ...link, kind }, "office", body, SENT)
    }

    /** True when at least one Telegram or Zalo connection is bound to the shifts agent. */
    async hasChannel(workspaceId: string): Promise<boolean> {
        return (
            (await this.boundConnection(workspaceId, "telegram")) !== null ||
            (await this.boundConnection(workspaceId, "zalo_oa")) !== null
        )
    }

    private async viaChannel(
        workspaceId: string,
        provider: "telegram" | "zalo_oa",
        recipientId: string,
        notice: StaffNotice,
    ): Promise<Attempt> {
        const channel: Channel = provider === "telegram" ? "telegram" : "zalo"
        const attempt = await this.send(workspaceId, provider, recipientId, notice.body)
        await this.record(workspaceId, notice, channel, notice.body, attempt)
        return attempt
    }

    private async send(
        workspaceId: string,
        provider: "telegram" | "zalo_oa",
        recipientId: string,
        text: string,
    ): Promise<Attempt> {
        try {
            const connectionId = await this.boundConnection(workspaceId, provider)
            if (connectionId === null) return { status: "skipped", error: this.words.text("shifts.channelNotBound") }
            await this.delivery.sendToPerson({ workspaceId, connectionId, provider, recipientId, text })
            return SENT
        } catch (cause) {
            this.logger.error(ShiftsLogEvent.NoticeFailed, cause, { workspaceId, provider })
            return { status: "failed", error: reasonOf(cause) }
        }
    }

    /** The connection the shifts agent speaks through for one provider: only a connected one bound for outbound chat; never "any". */
    private async boundConnection(workspaceId: string, provider: "telegram" | "zalo_oa"): Promise<string | null> {
        const agentId = await this.agents.firstActiveIdOfModule(workspaceId, "shifts")
        if (agentId === null) return null
        const bound = await this.bindings.connectionsFor(agentId, "outbound_chat", {
            acting: true,
            connectedOnly: true,
            providers: [provider],
        })
        return bound[0]?.id ?? null
    }

    /** id → @handle of the active staff rows, clear of every agent handle and @nivo. */
    private async handles(workspaceId: string): Promise<ReadonlyMap<string, string>> {
        const [staff, handles] = await Promise.all([
            this.staff.list(workspaceId),
            this.agents.handlesOf(workspaceId, HANDLES_MAX),
        ])
        return staffHandles(staff, handles)
    }

    private async record(
        workspaceId: string,
        notice: NoticeLink & { readonly staffId?: string; readonly kind: NotifyKind },
        channel: Channel,
        body: string,
        attempt: Attempt,
    ): Promise<void> {
        await this.entityManager
            .insert(ShiftsNotificationEntity, {
                workspaceId,
                staffId: notice.staffId ?? null,
                scheduleId: notice.scheduleId ?? null,
                shiftId: notice.shiftId ?? null,
                kind: notice.kind,
                channel,
                status: attempt.status,
                body: leftOf(body, BODY_MAX),
                error: attempt.error === null ? null : leftOf(attempt.error, ERROR_MAX),
            })
            .catch((cause: unknown) => {
                this.logger.error(ShiftsLogEvent.NoticeNotRecorded, cause, { workspaceId, channel })
            })
    }
}
