import { Injectable, Optional } from "@nestjs/common"
import type { ActionResult } from "@nivo-lite/agent-sdk/block"
import { invokeAction, invokeRead } from "@nivo-lite/agent-sdk/invoke"
import type { RunContext } from "@nivo-lite/agent-sdk/port"
import { moduleKeyOfOperation, type JsonValue, type SpecText } from "@nivo-lite/agent-sdk/schema"
import { EntityEngineService, ModuleAgentService, type RunIn } from "@modules/domain/entity-engine"
import { RecordFilesService, type RecordFileFacts, type RecordFileTarget } from "@modules/domain/record-files"
import { WorkspaceMembersService, type WorkspaceRole } from "@modules/domain/workspace-members"
import { InjectClock, type Clock } from "@modules/platform/clock"
import { InjectMessageCatalog, type MessageCatalog } from "@modules/platform/i18n"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { fileGrantOf, type DoorFileVerb } from "./door-files.policy"
import { actionFailureOf } from "./door-failure.policy"
import { invalidInputOf } from "./door-invalid-input.policy"
import { parsePayload } from "./door-payload.policy"
import { mayRunAction } from "./door-permission.policy"
import { DoorPortsService } from "./door-ports.service"
import { DoorProviderReadsService } from "./door-provider-reads.service"
import { providerReadNameOf } from "./provider-reads.policy"
import { servableModulesOf } from "./door-servable.policy"
import { registryOf } from "./door-registry.policy"
import { WorkspaceTimeZoneService } from "@modules/domain/workspace-settings"
import { InjectWorkbenchDoorOptions } from "./workbench-door.decorators"
import { WorkbenchDoorError, WorkbenchDoorErrorCode } from "./errors/workbench-door.error"
import type {
    ActionAnswered,
    DoorAction,
    DoorAnswer,
    DoorCall,
    DoorFileCall,
    DoorRegistry,
} from "./workbench-door.contracts"
import { WorkbenchDoorLogEvent } from "./workbench-door.log-events"
import type { WorkbenchDoorOptions } from "./workbench-door.options"

/** The proven caller of a call. */
interface Caller {
    /** The seat in the workspace. */
    readonly memberId: string
    /** The role of the seat. */
    readonly role: WorkspaceRole
}

/** The record field a file call names. */
const targetOf = (call: DoorFileCall): RecordFileTarget => ({
    type: call.type,
    recordId: call.recordId,
    field: call.field,
    ...(call.key === undefined ? {} : { key: call.key }),
})

/** Why a payload was refused, as the error parameters carry it: `code:at` for each problem, joined. */
const issuesOf = (problems: ReadonlyArray<{ readonly code: string; readonly at: string }>): string =>
    problems.map((problem) => `${problem.code}:${problem.at}`).join(",")

@Injectable()
/**
 * The one door every screen read and action goes through. The registry of reads and actions is built from the installation at boot, from the modules whose ports the door provides. A
 * call proves membership first, then the role (the door is role-only: every member views every read; an owner or a manager runs every
 * action; a staff member runs an action only when its module marked it `staff`; there is no rule gate on a door action); the run itself is `invokeRead` or `invokeAction`, the path the graph host shares, in the engine workspace scope, on the ports
 * the engine provides, and the answer is the JSON text of the data or of the `ActionResult`. The workspace is the proven one, never one
 * the payload names.
 */
export class WorkbenchDoorService {
    private readonly registry: DoorRegistry

    constructor(
        @InjectWorkbenchDoorOptions() options: WorkbenchDoorOptions,
        @InjectClock() private readonly clock: Clock,
        @InjectMessageCatalog() private readonly catalog: MessageCatalog,
        @InjectLogger() private readonly logger: Logger,
        private readonly members: WorkspaceMembersService,
        private readonly engine: EntityEngineService,
        private readonly ports: DoorPortsService,
        private readonly zones: WorkspaceTimeZoneService,
        private readonly providerReads: DoorProviderReadsService,
        private readonly agents: ModuleAgentService,
        @Optional() private readonly files?: RecordFilesService,
    ) {
        this.registry = registryOf(servableModulesOf(options.modules, options.entities), options.entities)
    }

    /** Runs a read for a member and answers its data as JSON text. */
    async read(userId: string, call: DoorCall): Promise<DoorAnswer> {
        const caller = await this.callerOf(userId, call)
        // A read a provider registered (`<provider>:<read>`) is the provider's own: the door proves the member, dispatches and audits.
        if (providerReadNameOf(call.name) !== null) return this.providerReads.read(caller.memberId, call)
        const read = this.registry.reads.get(call.name)
        if (read === undefined)
            throw new WorkbenchDoorError({ code: WorkbenchDoorErrorCode.ReadUnknown, params: { name: call.name } })
        const parsed = parsePayload(call.payload)
        if (!parsed.ok)
            throw new WorkbenchDoorError({ code: WorkbenchDoorErrorCode.PayloadInvalid, params: { issues: "." } })
        const context = await this.contextOf(call, caller)
        const result = await this.engine.scoped(call.workspaceId, (tx) =>
            invokeRead(
                read.definition,
                this.ports.providerFor({
                    workspaceId: call.workspaceId,
                    runIn: (use) => use(tx),
                    name: call.name,
                    dataKind: read.dataKind,
                    memberId: caller.memberId,
                    locale: call.locale,
                    fields: read.definition.fields,
                }),
                parsed.value,
                context,
            ),
        )
        if (result.ok) return { data: JSON.stringify(result.data) }
        if (result.reason === "invalid")
            throw new WorkbenchDoorError({
                code: WorkbenchDoorErrorCode.PayloadInvalid,
                params: { issues: issuesOf(result.problems) },
            })
        this.logger.warn(WorkbenchDoorLogEvent.PortUnprovided, { code: result.code, at: result.at })
        throw new WorkbenchDoorError({ code: WorkbenchDoorErrorCode.PortUnprovided, params: { port: result.at } })
    }

    /** Runs an action for a member and answers its `ActionResult` as JSON text. */
    async act(userId: string, call: DoorCall): Promise<DoorAnswer> {
        const caller = await this.callerOf(userId, call)
        const action = this.registry.actions.get(call.name)
        if (action === undefined)
            throw new WorkbenchDoorError({ code: WorkbenchDoorErrorCode.ActionUnknown, params: { name: call.name } })
        return { data: JSON.stringify(await this.resultOf(call, caller, action)) }
    }

    /**
     * A ticket to upload one file into a declared `file` field of a record, for an action the member may run that reaches the record
     * type (`fileGrantOf`); the generic record files check the type, the field's limits, the record in the workspace and the plan's room.
     */
    async fileUpload(userId: string, call: DoorFileCall, facts: RecordFileFacts): Promise<DoorAnswer> {
        const files = await this.filesFor(userId, call, "upload")
        return { data: JSON.stringify(await files.upload(call.workspaceId, targetOf(call), facts)) }
    }

    /** The reference of an uploaded file once the store proves it (nothing is written to the record: `fileLink` does that). */
    async fileConfirm(userId: string, call: DoorFileCall, key: string, name: string): Promise<DoorAnswer> {
        const files = await this.filesFor(userId, call, "upload")
        return { data: JSON.stringify(await files.confirm(call.workspaceId, targetOf(call), key, name)) }
    }

    /**
     * Attaches a confirmed upload of the field (or a staged file of the workspace) to the record's field, for an action the member may
     * run: the reference is written to the record and the file it held before is removed from the store.
     */
    async fileLink(userId: string, call: DoorFileCall, key: string, name: string): Promise<DoorAnswer> {
        const files = await this.filesFor(userId, call, "link")
        return { data: JSON.stringify(await files.link(call.workspaceId, targetOf(call), { key, name })) }
    }

    /** A short-lived signed read address of the file the record holds in the field, for a read or action the member may run. */
    async fileUrl(userId: string, call: DoorFileCall): Promise<DoorAnswer> {
        const files = await this.filesFor(userId, call, "url")
        return { data: JSON.stringify(await files.url(call.workspaceId, targetOf(call))) }
    }

    /** Clears the field's file on the record and removes its object from the store, for an action the member may run. */
    async fileDelete(userId: string, call: DoorFileCall): Promise<DoorAnswer> {
        const files = await this.filesFor(userId, call, "delete")
        return { data: JSON.stringify(await files.delete(call.workspaceId, targetOf(call))) }
    }

    /** The record files, once the member is proved, the `via` read or action reaches the type, and the role may make the call. */
    private async filesFor(userId: string, call: DoorFileCall, verb: DoorFileVerb): Promise<RecordFilesService> {
        const caller = await this.callerOf(userId, call)
        const { permission, staff } = fileGrantOf(this.registry, call.via, call.type, verb)
        if (!mayRunAction(caller.role, staff))
            throw new WorkbenchDoorError({ code: WorkbenchDoorErrorCode.PermissionDenied, params: { permission } })
        if (this.files === undefined)
            throw new WorkbenchDoorError({ code: WorkbenchDoorErrorCode.PortUnprovided, params: { port: "record-files" } })
        return this.files
    }

    private async resultOf(call: DoorCall, caller: Caller, action: DoorAction): Promise<ActionResult> {
        if (!mayRunAction(caller.role, action.staff === true))
            return this.failure("forbidden", WorkbenchDoorErrorCode.PermissionDenied)
        const parsed = parsePayload(call.payload)
        if (!parsed.ok) {
            this.logger.warn(WorkbenchDoorLogEvent.InputInvalid, { action: action.id, fields: [] })
            return this.failure("invalid", WorkbenchDoorErrorCode.PayloadInvalid)
        }
        return this.logged(action, await this.run(call, caller, action, parsed.value))
    }

    /** Logs the action and the field keys (never the values) of an input the action refused as invalid; answers the result as it is. */
    private logged(action: DoorAction, result: ActionResult): ActionResult {
        const invalid = invalidInputOf(action.id, result)
        if (invalid !== null)
            this.logger.warn(WorkbenchDoorLogEvent.InputInvalid, { action: invalid.action, fields: invalid.fields })
        return result
    }

    /**
     * Runs the action through `invokeAction`. A transactional action is one transaction for the whole run and rolls back when it answers
     * a refusal; any other action gives each port call a transaction of its own. An engine failure becomes the result the screen reads;
     * a failure the door does not know propagates.
     */
    private async run(call: DoorCall, caller: Caller, action: DoorAction, input: unknown): Promise<ActionResult> {
        const context = await this.contextOf(call, caller)
        const run = {
            workspaceId: call.workspaceId,
            name: action.id,
            dataKind: null,
            memberId: caller.memberId,
            locale: call.locale,
            fields: [],
        }
        const answered: ActionAnswered = {}
        try {
            const agent = await this.agents.scopeOf(call.workspaceId, moduleKeyOfOperation(action.id), call.installationId)
            if (action.transactional !== true) {
                const runIn: RunIn = (use) => this.engine.scoped(call.workspaceId, use, agent)
                return await invokeAction(action, this.ports.providerFor({ ...run, runIn }), input, context)
            }
            return await this.engine.scoped(
                call.workspaceId,
                async (tx) => {
                    const result = await invokeAction(
                        action,
                        this.ports.providerFor({ ...run, runIn: (use) => use(tx) }),
                        input,
                        context,
                    )
                    if (result.ok) return result
                    answered.refusal = result
                    throw new WorkbenchDoorError({ code: WorkbenchDoorErrorCode.ActionRefused })
                },
                agent,
            )
        } catch (cause) {
            if (answered.refusal !== undefined) return answered.refusal
            const failure = actionFailureOf(cause)
            if (failure === null) throw cause
            return this.failure(failure.reason, failure.code, failure.data)
        }
    }

    private async callerOf(userId: string, call: Pick<DoorCall, "workspaceId">): Promise<Caller> {
        const member = await this.members.require(userId, call.workspaceId)
        return { memberId: await this.members.idOf(userId, call.workspaceId), role: member.role }
    }

    private async contextOf(call: DoorCall, caller: Caller): Promise<RunContext> {
        return {
            workspaceId: call.workspaceId,
            memberId: caller.memberId,
            now: this.clock.now(),
            timeZone: await this.zones.timeZoneOf(call.workspaceId),
            locale: call.locale,
        }
    }

    private failure(
        reason: "invalid" | "forbidden" | "conflict" | "refused" | "failed",
        code: WorkbenchDoorErrorCode,
        data?: JsonValue,
    ): ActionResult {
        const extra = data === undefined ? {} : { data }
        return { ok: false, reason, message: this.textOf(code), ...extra }
    }

    private textOf(code: WorkbenchDoorErrorCode): SpecText {
        const key = `errors.${code}`
        return { vi: this.catalog.get(key, {}, "vi"), en: this.catalog.get(key, {}, "en") }
    }
}
