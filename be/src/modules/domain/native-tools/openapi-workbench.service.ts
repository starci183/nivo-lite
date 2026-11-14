import { Injectable, Optional } from "@nestjs/common"
import { INSTALLED } from "@modules/domain/installed-plugins"
import { ToolsError, ToolsErrorCode, type ToolJson } from "@modules/domain/tools"
import { ConnectionBindingsReadService } from "@modules/domain/connections"
import {
    OPENAPI_PROVIDER,
    OPENAPI_SOURCE_KEYS,
    accountFactsOf,
    installedDeclarationsOf,
    pinnedReadingOf,
    sourceOfApiVerb,
    toolStatesOf,
} from "@modules/domain/openapi-tools"
import type {
    OptionalProviderInfo,
    InterfaceProviderAnswer,
    InterfaceProviderRead,
    InterfaceReadProvider,
    InterfaceReadSchema,
    InterfaceViewer,
} from "@modules/domain/workbench-door"
import { WorkspaceEnterpriseService } from "@modules/domain/workspaces"
import { isRecord } from "@modules/platform/primitives"
import { accountInfoOf } from "./account-info.policy"
import { OpenApiNativeService } from "./openapi-connection-native.service"
import { openSourcesOf } from "./openapi-workbench.policy"

/** The member a page lists its rows under, and the member its next cursor is in. */
const ITEMS = "items"
const NEXT_CURSOR = "nextCursor"

/** The row schema of a page answer (`items`), or null when the document does not say. */
const rowSchemaOf = (output: InterfaceReadSchema | null): InterfaceReadSchema | null => {
    const properties = output !== null && isRecord(output.properties) ? output.properties : {}
    const items = properties[ITEMS]
    return isRecord(items) && isRecord(items.items) ? items.items : null
}

/** The answer of the provider's client as a screen takes it: a page of rows, one record, or the outside system's refusal. */
export const interfaceAnswerOf = (answer: ToolJson): InterfaceProviderAnswer => {
    if (answer.ok !== true) {
        return {
            kind: "refused",
            code: typeof answer.code === "string" ? answer.code : "refused",
            message: typeof answer.message === "string" ? answer.message : "",
        }
    }
    const { data } = answer
    const truncated = answer.truncated === true
    if (!isRecord(data) || !Array.isArray(data[ITEMS])) return { kind: "record", record: data ?? null, truncated }
    const cursor = data[NEXT_CURSOR]
    return {
        kind: "page",
        rows: data[ITEMS],
        cursor: typeof cursor === "string" ? cursor : null,
        truncated,
        omitted: typeof answer.omitted === "number" ? answer.omitted : 0,
    }
}

@Injectable()
/**
 * The workbench face of the OpenAPI provider: its reads are GENERATED, one per GET operation of the workspace's pinned document,
 * named by its API read (`nivo.api.<key>.<method>.<path>`, never a tool id: a workbench binding names an API read). A read goes to
 * the same client as the tools: the same account, pinned document, sealed key and workspace header, the same bounds, its arguments
 * checked against the document; no agent is involved: a person's read is no run, it serves no conversation and no agent's right is
 * judged. A workspace reads only the sources of a plugin open to it (a private plugin: its enterprise identifier, `openSourcesOf`),
 * and only with the account. Who of the workspace may read is the door's (it proves the member and holds the one permission seam).
 */
export class OpenApiInterfaceReadsService implements InterfaceReadProvider {
    /** The provider key the door dispatches by. */
    readonly provider: string = OPENAPI_PROVIDER

    constructor(
        private readonly connection: OpenApiNativeService,
        private readonly bindings: ConnectionBindingsReadService,
        @Optional() private readonly enterprise?: WorkspaceEnterpriseService,
    ) {}

    /**
     * The current state of one API account: which system it serves, the pin of its document and when it was pinned, how many of the
     * declared operations can be called, and whether writes act for real. Read from the connection alone; nothing is called outside.
     */
    async infoOf(workspaceId: string, connectionId: string): Promise<OptionalProviderInfo> {
        const record = await this.bindings.recordOf(workspaceId, connectionId)
        if (record?.provider !== OPENAPI_PROVIDER) return null
        const facts = accountFactsOf(record.meta)
        const document = pinnedReadingOf(record.meta)
        const tools = facts === null || document === null ? [] : toolStatesOf(document, installedDeclarationsOf(facts.connector))
        const ready = tools.filter((tool) => tool.state === "ready").length
        return accountInfoOf(record, [
            { key: "connector", label: { vi: "H\u1ec7 th\u1ed1ng", en: "System" }, value: facts?.connector ?? null, kind: "text" },
            { key: "document", label: { vi: "T\u00e0i li\u1ec7u \u0111\u00e3 ghim", en: "Pinned document" }, value: facts?.documentSha256.slice(0, 12) ?? null, kind: "text" },
            { key: "pinned_at", label: { vi: "Ghim l\u00fac", en: "Pinned at" }, value: facts?.pinnedAt ?? null, kind: "time" },
            { key: "tools_ready", label: { vi: "Thao t\u00e1c d\u00f9ng \u0111\u01b0\u1ee3c", en: "Operations ready" }, value: ready, kind: "count" },
            { key: "tools_declared", label: { vi: "Thao t\u00e1c \u0111\u00e3 ch\u1ecdn", en: "Operations selected" }, value: tools.length, kind: "count" },
            { key: "writes", label: { vi: "Ghi th\u1eadt", en: "Real writes" }, value: facts?.live === true ? "on" : "off", kind: "text" },
        ])
    }

    /** The generated reads of the workspace: none without the account, the plugin, or a document that is still the pinned one. */
    async readsOf(workspaceId: string): Promise<ReadonlyArray<InterfaceProviderRead>> {
        const open = await this.openSourcesOf(workspaceId)
        if (open.length === 0) return []
        const reads = await this.connection.viewerReads(workspaceId).catch((cause: unknown) => {
            if (cause instanceof ToolsError && cause.code === ToolsErrorCode.NativeRefused) return []
            throw cause
        })
        return reads
            .filter((read) => sourceOfApiVerb(read.name, open) !== null)
            .map((read): InterfaceProviderRead => {
                const rows = rowSchemaOf(read.output)
                return { name: read.name, shape: rows === null ? "record" : "page", input: read.input, output: rows ?? read.output }
            })
    }

    /** Runs one generated read for a person; a read of no source open to the workspace is refused `not_selected`. */
    async read(viewer: InterfaceViewer, name: string, input: InterfaceReadSchema): Promise<InterfaceProviderAnswer> {
        const open = await this.openSourcesOf(viewer.workspaceId)
        if (sourceOfApiVerb(name, open) === null) {
            throw new ToolsError({ code: ToolsErrorCode.NativeRefused, params: { reason: "not_selected" } })
        }
        return interfaceAnswerOf(await this.connection.viewerRead(viewer.workspaceId, name, input))
    }

    /** The sources a module open to the workspace uses and no closed module uses (`openSourcesOf`). */
    private async openSourcesOf(workspaceId: string): Promise<ReadonlyArray<string>> {
        const key = this.enterprise === undefined ? null : await this.enterprise.keyOf(workspaceId)
        const modules = INSTALLED.plugins
            .flatMap((plugin) => plugin.modules)
            .map((module) => ({ open: INSTALLED.isOpenTo(module, key), tools: INSTALLED.agentToolsOf(module) ?? [] }))
        return [...openSourcesOf(modules, OPENAPI_SOURCE_KEYS)]
    }
}
