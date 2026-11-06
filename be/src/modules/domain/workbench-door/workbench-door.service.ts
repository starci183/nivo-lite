import { Injectable } from "@nestjs/common"
import type { ActionResult } from "@nivo-lite/agent-sdk/block"
import { invokeAction, invokeRead } from "@nivo-lite/agent-sdk/invoke"
import type { RunContext } from "@nivo-lite/agent-sdk/port"
import type { JsonValue, SpecText } from "@nivo-lite/agent-sdk/schema"
import { AuthorityRulesService } from "@modules/domain/authority-rules"
import { EntityEngineService } from "@modules/domain/entity-engine"
import type { RunIn } from "@modules/domain/entity-engine"
import { MemberGrantsService } from "@modules/domain/member-grants"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import type { WorkspaceRole } from "@modules/domain/workspace-members"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectMessageCatalog } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { authorityDecisionOf } from "./door-authority.policy"
import { actionFailureOf } from "./door-failure.policy"
import { parsePayload } from "./door-payload.policy"
import { holdsPermission } from "./door-permission.policy"
import { DoorPortsService } from "./door-ports.service"
import { servableModulesOf } from "./door-servable.policy"
import { registryOf } from "./door-registry.policy"
import { WorkspaceTimeZoneService } from "./workspace-time-zone.service"
import { InjectWorkbenchDoorOptions } from "./workbench-door.decorators"
import { WorkbenchDoorError, WorkbenchDoorErrorCode } from "./errors/workbench-door.error"
import type { ActionAnswered, DoorAction, DoorAnswer, DoorCall, DoorRegistry } from "./workbench-door.contracts"
import { WorkbenchDoorLogEvent } from "./workbench-door.log-events"
import type { WorkbenchDoorOptions } from "./workbench-door.options"

/** The proven caller of a call. */
interface Caller {
    /** The seat in the workspace. */
    readonly memberId: string
    /** The role of the seat. */
    readonly role: WorkspaceRole
}

/** Why a payload was refused, as the error parameters carry it: `code:at` for each problem, joined. */
const issuesOf = (problems: ReadonlyArray<{ readonly code: string; readonly at: string }>): string =>
    problems.map((problem) => `${problem.code}:${problem.at}`).join(",")

@Injectable()
/**
 * The one door every screen read and action goes through. The registry of reads and actions is built from the installation at boot, from the modules whose ports the door provides. A
 * call proves membership first, then the declared permission; an action then passes the authority rules (run, refuse, or ask a
 * person); the run itself is `invokeRead` or `invokeAction`, the path the graph host shares, in the engine workspace scope, on the ports
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
        private readonly grants: MemberGrantsService,
        private readonly rules: AuthorityRulesService,
        private readonly engine: EntityEngineService,
        private readonly ports: DoorPortsService,
        private readonly zones: WorkspaceTimeZoneService,
    ) {
        this.registry = registryOf(servableModulesOf(options.modules, options.entities), options.entities)
    }

    /** Runs a read for a member and answers its data as JSON text. */
    async read(userId: string, call: DoorCall): Promise<DoorAnswer> {
        const caller = await this.callerOf(userId, call)
        const read = this.registry.reads.get(call.name)
        if (read === undefined)
            throw new WorkbenchDoorError({ code: WorkbenchDoorErrorCode.ReadUnknown, params: { name: call.name } })
        const { permission } = read.definition
        if (!(await this.holds(call, caller, permission)))
            throw new WorkbenchDoorError({ code: WorkbenchDoorErrorCode.PermissionDenied, params: { permission } })
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

    private async resultOf(call: DoorCall, caller: Caller, action: DoorAction): Promise<ActionResult> {
        if (!(await this.holds(call, caller, action.permission)))
            return this.failure("forbidden", WorkbenchDoorErrorCode.PermissionDenied)
        const parsed = parsePayload(call.payload)
        if (!parsed.ok) return this.failure("invalid", WorkbenchDoorErrorCode.PayloadInvalid)
        const rule = await this.rules.ownerRuleFor({ workspaceId: call.workspaceId }, action.id)
        const decision = authorityDecisionOf(rule, action.id, parsed.value)
        if (decision === "deny") return this.failure("forbidden", WorkbenchDoorErrorCode.PermissionDenied)
        if (decision === "ask")
            return this.failure("refused", WorkbenchDoorErrorCode.ActionRefused, { approvalRequired: true })
        return await this.run(call, caller, action, parsed.value)
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
        }
        const answered: ActionAnswered = {}
        try {
            if (action.transactional !== true) {
                const runIn: RunIn = (use) => this.engine.scoped(call.workspaceId, use)
                return await invokeAction(action, this.ports.providerFor({ ...run, runIn }), input, context)
            }
            return await this.engine.scoped(call.workspaceId, async (tx) => {
                const result = await invokeAction(
                    action,
                    this.ports.providerFor({ ...run, runIn: (use) => use(tx) }),
                    input,
                    context,
                )
                if (result.ok) return result
                answered.refusal = result
                throw new WorkbenchDoorError({ code: WorkbenchDoorErrorCode.ActionRefused })
            })
        } catch (cause) {
            if (answered.refusal !== undefined) return answered.refusal
            const failure = actionFailureOf(cause)
            if (failure === null) throw cause
            return this.failure(failure.reason, failure.code, failure.data)
        }
    }

    private async callerOf(userId: string, call: DoorCall): Promise<Caller> {
        const member = await this.members.require(userId, call.workspaceId)
        return { memberId: await this.members.idOf(userId, call.workspaceId), role: member.role }
    }

    private async holds(call: DoorCall, caller: Caller, permission: string): Promise<boolean> {
        return holdsPermission(caller.role, caller.memberId, await this.grants.forAction(call.workspaceId, permission))
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
