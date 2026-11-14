import { Injectable } from "@nestjs/common"
import type { CommandBus, QueryBus } from "@nestjs/cqrs"
import type { NivoApiVerb } from "@nivo-lite/agent-sdk/names"
import { AgentRunsService } from "@modules/domain/agent-runs"
import { InstallationRecordsService } from "@modules/domain/module-installations"
import { InjectCommandBus, InjectQueryBus, type ExecuteParams } from "@modules/platform/cqrs"
import { isDomainError } from "@modules/platform/errors"
import type { NivoApiActor, NivoApiAnswer, NivoApiExecutor } from "./nivo-api.contracts"
import type { NivoApiRegisteredOp, NivoApiScope } from "./nivo-api-ops.contracts"
import { NivoApiOpsService } from "./nivo-api-ops.service"
import { namedIdsOf, narrowedOf } from "./nivo-api-scope.policy"

@Injectable()
/**
 * Runs the NIVO data ops of the outbound MCP surface through the command and query buses: each op own GraphQL application handler,
 * with the key holder as the principal (`role: "authenticated"`, as every signed-in caller) in the key workspace. The registry says
 * what each op sends and how; this only dispatches. A typed refusal the handler throws is answered as its code; anything else is a
 * failure of the server and is rethrown. An agent-scoped key only narrows which agents and workflows it sees: an installation or a run
 * of another agent answers `not_found` before any bus, and the agent list and the stop page keep its own agent entries; the data ops
 * run by the holder rights alone.
 */
export class NivoApiExecutorService implements NivoApiExecutor {
    constructor(
        @InjectCommandBus() private readonly commandBus: CommandBus,
        @InjectQueryBus() private readonly queryBus: QueryBus,
        private readonly installations: InstallationRecordsService,
        private readonly runs: AgentRunsService,
        private readonly ops: NivoApiOpsService,
    ) {}

    /** Runs one exposed op as the holder; a write without its once-only key is refused before any bus. */
    async execute(name: NivoApiVerb, args: unknown, actor: NivoApiActor, opKey?: string): Promise<NivoApiAnswer> {
        const op = this.ops.opOf(name)
        if (op === null) return { ok: false, code: "not_exposed" }
        const key = (opKey ?? "").trim()
        if (!op.readOnly && key === "") return { ok: false, code: "idempotency_key_required" }
        const agentId = actor.agentId
        if (agentId !== null && !(await this.sees(op.scope, args, actor.workspaceId, agentId))) return { ok: false, code: "not_found" }
        try {
            const params: ExecuteParams<unknown> = {
                request: op.request(args, { workspaceId: actor.workspaceId, opKey: key === "" ? null : key }),
                principal: { id: actor.userId, role: "authenticated" },
            }
            const data = op.answer(await this.send(op, params))
            return { ok: true, data: agentId === null ? data : narrowedOf(op.scope, data, agentId) }
        } catch (error) {
            if (isDomainError(error)) return { ok: false, code: error.code }
            throw error
        }
    }

    /** Sends the op message on its bus, as the op GraphQL resolver sends it. */
    private send(op: NivoApiRegisteredOp, params: ExecuteParams<unknown>): Promise<unknown> {
        const { dispatch } = op
        return dispatch.bus === "query"
            ? this.queryBus.execute(new dispatch.message(params))
            : this.commandBus.execute(new dispatch.message(params))
    }

    /** Whether the scoped key agent owns the installation (and the run) the op names; any other op is not narrowed here. */
    private async sees(scope: NivoApiScope, args: unknown, workspaceId: string, agentId: string): Promise<boolean> {
        if (scope === "run") {
            const { runId } = namedIdsOf(args)
            return runId !== undefined && (await this.runs.runOf(workspaceId, runId))?.agentId === agentId
        }
        if (scope !== "installation" && scope !== "installation_run") return true
        const ids = namedIdsOf(args)
        if (ids.installationId === undefined) return false
        const installation = await this.installations.find(workspaceId, ids.installationId)
        if (installation?.agentId !== agentId) return false
        if (scope === "installation") return true
        if (ids.runId === undefined) return false
        return (await this.runs.runOf(workspaceId, ids.runId))?.agentId === agentId
    }
}
