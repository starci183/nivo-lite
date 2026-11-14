import { Injectable } from "@nestjs/common"
import type { ConnectionActor } from "@modules/domain/connections"
import { pinCountsOf, pinReportOf } from "@modules/domain/openapi-tools"
import { WorkspaceMemberDirectoryService } from "@modules/domain/workspace-members"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { DataHubLogEvent } from "./data-hub.log-events"
import { DataHubError, DataHubErrorCode } from "./errors/data-hub.error"
import { OpenApiToolsPinService, type OpenApiToolsPinView } from "./openapi-tools-pin.service"

/** Where the operator's report is written: the terminal's standard output. */
export interface OperatorOutput {
    /** Writes one piece of text. */
    write(text: string): unknown
}

/** What the operator asks to pin on an API account of a workspace. */
export interface OperatorPinRequest {
    /** The workspace. */
    readonly workspaceId: string
    /** The API connection. */
    readonly connectionId: string
    /** The CRM's provider key the account serves (`crm.nivoweb`). */
    readonly connector: string
    /** Where the document came from; empty when the operator gave it as a file. */
    readonly swaggerUrl: string
    /** The header parameter that carries the workspace's id. */
    readonly workspaceHeader: string
    /** The OpenAPI document as JSON text, read by the terminal command from the file the operator named. */
    readonly documentText: string
    /** True to let writes act for real. */
    readonly live: boolean
    /** True writes the pin; absent only reports. */
    readonly execute?: boolean | undefined
}

/** The account whose pin the operator reads. */
export interface OperatorPinRef {
    /** The workspace. */
    readonly workspaceId: string
    /** The API connection. */
    readonly connectionId: string
}

@Injectable()
/**
 * The pin of an OpenAPI document from the terminal, for the operator of an installation: the same pin the owner makes, made as the
 * oldest active owner of the workspace (the one the terminal's other owner acts take), reported as plain text and, when written,
 * recorded as one log event with who, the account, the namespace, the sha256 and the counts. Dry unless asked to execute: a dry run
 * judges the document exactly as the pin does and writes nothing. It never prints a key, a base URL or the document.
 */
export class OpenApiToolsOperatorService {
    constructor(
        private readonly pins: OpenApiToolsPinService,
        private readonly members: WorkspaceMemberDirectoryService,
        @InjectLogger() private readonly logger: Logger,
    ) {}

    /**
     * Reports what the pin comes to and, with `execute`, writes it. A refusal (a reserved or taken namespace, a document the provider
     * cannot read, a key not sent in a header) is said on the output with nothing written, then thrown so the command fails.
     */
    async pin(out: OperatorOutput, request: OperatorPinRequest): Promise<void> {
        const actor = await this.actorOf(request.workspaceId)
        const execute = request.execute === true
        const draft = {
            connectionId: request.connectionId,
            connector: request.connector,
            swaggerUrl: request.swaggerUrl,
            workspaceHeader: request.workspaceHeader,
            documentText: request.documentText,
            live: request.live,
        }
        try {
            const plan = await this.pins.plan(actor, draft)
            const view = execute ? await this.pins.pin(actor, draft) : plan.view
            out.write(`${this.headOf(execute, plan.changed)}\n`)
            this.print(out, view)
            if (execute) this.record(actor, request.connectionId, view, plan.changed)
        } catch (cause: unknown) {
            if (cause instanceof DataHubError && cause.code === DataHubErrorCode.Invalid) {
                out.write(`openapi pin: REFUSED (${String(cause.params.detail)}); nothing written\n`)
            }
            throw cause
        }
    }

    /** Reports what the account serves now, or that it pinned no document. */
    async view(out: OperatorOutput, ref: OperatorPinRef): Promise<void> {
        const view = await this.pins.view(await this.actorOf(ref.workspaceId), ref.connectionId)
        if (view === null) {
            out.write("openapi pin-view: no document is pinned on this account; it serves no tool\n")
            return
        }
        out.write(`openapi pin-view: pinned at ${view.pinnedAt}\n`)
        this.print(out, view)
    }

    /** The first line of a pin report: what was done, or what a run with --execute would do. */
    private headOf(execute: boolean, changed: boolean): string {
        if (!execute)
            return changed
                ? "openapi pin: DRY, would pin (run again with --execute)"
                : "openapi pin: DRY, already pinned, would change nothing"
        return changed ? "openapi pin: EXECUTED, pinned" : "openapi pin: EXECUTED, already pinned, nothing written"
    }

    private print(out: OperatorOutput, view: OpenApiToolsPinView): void {
        for (const line of pinReportOf(view)) out.write(`${line}\n`)
    }

    /** The one audit line of a pin made from the terminal: ids, the sha256 and counts only. */
    private record(actor: ConnectionActor, connectionId: string, view: OpenApiToolsPinView, changed: boolean): void {
        this.logger.info(DataHubLogEvent.OpenApiPinned, {
            workspaceId: actor.workspaceId,
            connectionId,
            actor: actor.principalId,
            via: "cli",
            connector: view.connector,
            documentSha256: view.documentSha256,
            live: view.live,
            changed,
            ...pinCountsOf(view),
        })
    }

    /** The owner the terminal acts as: the oldest active owner of the workspace; a workspace with none is not found. */
    private async actorOf(workspaceId: string): Promise<ConnectionActor> {
        const owner = await this.members.firstActiveOwnerUserId(workspaceId)
        if (owner === null) throw new DataHubError({ code: DataHubErrorCode.NotFound })
        return { principalId: owner, workspaceId }
    }
}
