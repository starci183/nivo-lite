import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { InjectMessageCatalog } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import {
    defaultDedupeKey,
    instanceLabel,
    isSubjectType,
    isUuid,
    missingPayload,
    shownSubject,
    splitPayload,
    tooDeep,
} from "./command-rules.policy"
import type {
    ModuleCommand,
    CommandRefusal,
    ModuleEntry,
    SendCommandInput,
    WorkContext,
    WorkItem,
    WorkSpec,
} from "./decisions.contracts"
import { EvidenceService } from "./evidence.service"
import { ModuleCatalogService } from "./module-catalog.service"
import { OfficeLinesService } from "@modules/domain/messages"
import type {
    ChainPosition,
    AcceptedCommandParts,
    CommandPlan,
    CommandRefused,
    OptionalCommandSender,
    OptionalInstanceChoice,
    PlannedCommand,
    SplitPayload,
} from "./work-engine.contracts"
import { WorkEngineLogEvent } from "./work-engine.log-events"
import type {
    ChainTopRow,
    GivenInstallationRow,
    ParentPositionRow,
    RepeatsRow,
    ResolvedInstallationRow,
    SenderAgentRow,
    SubjectLabelRow,
} from "./persistence/command-bus.rows"
import {
    CHAIN_REPEATS_COMMAND,
    FIND_CHAIN_TOP,
    FIND_GIVEN_INSTALLATION,
    FIND_PARENT_POSITION,
    FIND_SENDER_AGENT,
    FIND_SUBJECT_LABEL,
    RESOLVE_INSTALLATION,
} from "./persistence/command-bus.sql"

@Injectable()
/**
 * Checks a command against the receiver's contract, the depth and cycle rules and chooses the receiving instance; what it
 * accepts becomes a `WorkSpec` for the engine, what it refuses is logged. It never inserts or performs anything itself.
 */
export class CommandPlannerService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectLogger() private readonly logger: Logger,
        @InjectMessageCatalog() private readonly catalog: MessageCatalog,
        private readonly modules: ModuleCatalogService,
        private readonly evidence: EvidenceService,
        private readonly office: OfficeLinesService,
    ) {}

    /**
     * Validates the command and answers the work to run, or the refusal. The plan's `onInserted` hook writes the Office mirror
     * line and the `command.sent` evidence once, and only when the engine really inserted the item.
     */
    async plan(ctx: WorkContext, input: SendCommandInput): Promise<CommandPlan> {
        const receiver = await this.modules.entryOf(input.to)
        if (receiver === null) return this.refuse(ctx, input, "unknown_module", `no agent ${input.to}`)
        const accepted = receiver.accepts.find((candidate) => candidate.command === input.command)
        if (accepted === undefined) {
            return this.refuse(ctx, input, "unknown_command", `${input.to} does not accept ${input.command}`)
        }
        const sender = await this.senderOf(ctx, input.from)
        if (sender === null) return this.refuse(ctx, input, "unknown_sender", `no sender ${input.from}`)
        const missing = missingPayload(accepted.requiredFields, input.payload)
        if (missing.length > 0) {
            return this.refuse(
                ctx,
                input,
                "missing_fields",
                `${input.to}.${input.command} needs ${missing.join(", ")}`,
                missing,
            )
        }
        const address = splitPayload(input.payload, accepted.subjectType)
        if (!isSubjectType(address.subjectType)) {
            return this.refuse(ctx, input, "missing_fields", `${address.subjectType} is not a kind of record`, [
                "subject_type",
            ])
        }
        const position = await this.positionOf(ctx, input)
        if (tooDeep(position.depth)) {
            return this.refuse(ctx, input, "too_deep", `depth ${position.depth} is deeper than the chain allows`)
        }
        const dedupeKey = input.dedupeKey ?? defaultDedupeKey(input.command, address.subjectType, address.subjectId)
        if (position.chainId !== null && (await this.repeats(ctx, position.chainId, accepted, address, dedupeKey))) {
            return this.refuse(
                ctx,
                input,
                "cycle",
                `${input.command} on ${address.subjectType} already ran in chain ${position.chainId}`,
            )
        }
        const instance = await this.instanceFor(ctx, input, receiver, address, position)
        return this.accept({
            ctx,
            input,
            accepted,
            sender: sender.label,
            address,
            subjectType: address.subjectType,
            position,
            dedupeKey,
            instance,
        })
    }

    private accept(parts: AcceptedCommandParts): PlannedCommand {
        const { input, accepted, address, position, instance } = parts
        let inserted = false
        const spec: WorkSpec = {
            action: accepted.action,
            subject_type: parts.subjectType,
            subject_id: address.subjectId,
            lead_id: address.leadId,
            inbound_event_id: input.inboundEventId ?? null,
            parent_id: input.parentId ?? null,
            dedupeKey: parts.dedupeKey,
            origin: input.origin ?? "live",
            seed: { ...input.seed, fields: { ...input.seed?.fields, ...address.fields } },
            queue: input.queue,
            preset: input.preset,
            noChain: input.noChain,
            forceAsk: input.forceAsk,
            chainId: position.chainId,
            depth: position.depth,
            installationId: instance?.id ?? null,
            onInserted: async (row: WorkItem) => {
                inserted = true
                await this.announce(parts, row)
            },
        }
        return { ok: true, spec, depth: position.depth, inserted: () => inserted }
    }

    /** The Office mirror line and the `command.sent` evidence of a command that became a work item. */
    private async announce(parts: AcceptedCommandParts, row: WorkItem): Promise<void> {
        const { ctx, input, accepted, address, instance } = parts
        const subject = await this.subjectPhrase(ctx, address)
        const toName = instanceLabel(await this.modules.nameOf(input.to, ctx.locale), instance?.name ?? null)
        const params = { to: toName, from: parts.sender, what: accepted.description[ctx.locale], subject }
        const body = this.catalog.get(subject === "" ? "command.mirror" : "command.mirror.subject", params, ctx.locale)
        await this.safely(
            () => this.office.post(ctx, { command: true, body, lead_id: row.lead_id, work_item_id: row.id }),
            WorkEngineLogEvent.OfficeFailed,
        )
        const target = instance === null ? input.to : `${input.to}[${instance.name ?? instance.id}]`
        await this.safely(
            () =>
                this.evidence.log(ctx, {
                    lead_id: row.lead_id,
                    work_item_id: row.id,
                    kind: "command.sent",
                    actor: parts.sender,
                    summary: `${target}.${input.command}`,
                    evidence:
                        instance === null
                            ? input.reason
                            : `${input.reason} · instance ${instance.id} (${instance.via})`,
                }),
            WorkEngineLogEvent.EvidenceFailed,
        )
    }

    private async refuse(
        ctx: WorkContext,
        input: SendCommandInput,
        refused: CommandRefusal,
        detail: string,
        missing?: ReadonlyArray<string>,
    ): Promise<CommandRefused> {
        await this.safely(
            () =>
                this.evidence.log(ctx, {
                    kind: "command.refused",
                    actor: "NIVO",
                    summary: `${input.from} -> ${input.to}.${input.command}: ${refused}`,
                    evidence: detail,
                }),
            WorkEngineLogEvent.EvidenceFailed,
        )
        return { ok: false, refused, detail, ...(missing === undefined ? {} : { missing }) }
    }

    /** Who sends: the owner, an input, a module or an agent of the workspace; null when the id names nobody. */
    private async senderOf(ctx: WorkContext, from: string): Promise<OptionalCommandSender> {
        if (from === "owner") return { label: this.catalog.get("command.sender.owner", {}, ctx.locale) }
        if (from === "inbound") return { label: this.catalog.get("command.sender.inbound", {}, ctx.locale) }
        if ((await this.modules.entryOf(from)) !== null) return { label: await this.modules.nameOf(from, ctx.locale) }
        if (!isUuid(from)) return null
        const agent = (
            await this.entityManager.query<Array<SenderAgentRow>>(FIND_SENDER_AGENT, [ctx.workspaceId, from])
        )[0]
        if (agent === undefined) return null
        const registered = await this.modules.entryOf(agent.module)
        if (registered === null) return { label: agent.name }
        const instanceName = registered.multiInstance ? agent.installation_name : null
        return { label: instanceLabel(await this.modules.nameOf(agent.module, ctx.locale), instanceName) }
    }

    /** Where the command sits in its chain: after its parent, or after the deepest item of the chain it names. */
    private async positionOf(ctx: WorkContext, input: SendCommandInput): Promise<ChainPosition> {
        const named = input.chainId ?? null
        if (input.parentId !== undefined && input.parentId !== null) {
            const parent = (
                await this.entityManager.query<Array<ParentPositionRow>>(FIND_PARENT_POSITION, [
                    ctx.workspaceId,
                    input.parentId,
                ])
            )[0]
            if (parent === undefined) return { chainId: named, depth: 0 }
            return { chainId: named ?? parent.chain_id ?? parent.id, depth: parent.depth + 1 }
        }
        if (named === null) return { chainId: null, depth: 0 }
        const top = (await this.entityManager.query<Array<ChainTopRow>>(FIND_CHAIN_TOP, [ctx.workspaceId, named]))[0]
        return { chainId: named, depth: top === undefined ? 1 : top.depth + 1 }
    }

    /** The same command about the same subject twice in one chain is a cycle; a retry of the same dedupe key is not. */
    private async repeats(
        ctx: WorkContext,
        chainId: string,
        accepted: ModuleCommand,
        address: SplitPayload,
        dedupeKey: string,
    ): Promise<boolean> {
        const row = (
            await this.entityManager.query<Array<RepeatsRow>>(CHAIN_REPEATS_COMMAND, [
                ctx.workspaceId,
                chainId,
                accepted.action,
                address.subjectType,
                dedupeKey,
                address.subjectId,
            ])
        )[0]
        return row?.repeats === true
    }

    /** The conversation a command is about: the one in its fields, else the subject when that is a conversation. */
    private conversationOf(address: SplitPayload): string | null {
        const named = address.fields.conversation_id
        if (typeof named === "string" && isUuid(named)) return named
        return address.subjectType === "conversation" ? address.subjectId : null
    }

    /** Which instance of a multi-instance receiver handles the command; null for a single-instance type or when none can be chosen. Never throws. */
    private async instanceFor(
        ctx: WorkContext,
        input: SendCommandInput,
        receiver: ModuleEntry,
        address: SplitPayload,
        position: ChainPosition,
    ): Promise<OptionalInstanceChoice> {
        if (!receiver.multiInstance) return null
        try {
            const given = await this.givenInstance(ctx, input)
            if (given !== null) return given
            const hit = (
                await this.entityManager.query<Array<ResolvedInstallationRow>>(RESOLVE_INSTALLATION, [
                    ctx.workspaceId,
                    input.to,
                    this.conversationOf(address),
                    address.leadId,
                    position.chainId,
                ])
            )[0]
            return hit === undefined ? null : { id: hit.installation_id, via: hit.via, name: hit.name }
        } catch (cause) {
            this.logger.error(WorkEngineLogEvent.InstanceUnresolved, cause, { to: input.to })
            return null
        }
    }

    private async givenInstance(ctx: WorkContext, input: SendCommandInput): Promise<OptionalInstanceChoice> {
        if (input.installationId === undefined || input.installationId === null) return null
        const row = (
            await this.entityManager.query<Array<GivenInstallationRow>>(FIND_GIVEN_INSTALLATION, [
                ctx.workspaceId,
                input.to,
                input.installationId,
            ])
        )[0]
        return row === undefined ? null : { id: row.id, via: "given", name: row.name }
    }

    /** "order #DH-1" / "customer Lan"; empty when the subject has no readable label. A label is a courtesy: it never blocks a command. */
    private async subjectPhrase(ctx: WorkContext, address: SplitPayload): Promise<string> {
        if (address.subjectId === null) return ""
        const label = await this.labelOf(ctx, address)
        if (label === null) return ""
        const shown = shownSubject(address.subjectType, label)
        const key = `command.subject.${address.subjectType}`
        const word = this.catalog.get(key, {}, ctx.locale)
        return word === key ? shown : `${word} ${shown}`
    }

    private async labelOf(ctx: WorkContext, address: SplitPayload): Promise<string | null> {
        try {
            const rows = await this.entityManager.query<Array<SubjectLabelRow>>(FIND_SUBJECT_LABEL, [
                ctx.workspaceId,
                address.subjectType,
                address.subjectId,
            ])
            return rows[0]?.label ?? null
        } catch (cause) {
            this.logger.error(WorkEngineLogEvent.SubjectLabelUnreadable, cause, { subjectType: address.subjectType })
            return null
        }
    }

    private async safely(run: () => Promise<void>, event: WorkEngineLogEvent): Promise<void> {
        try {
            await run()
        } catch (cause) {
            this.logger.error(event, cause)
        }
    }
}
