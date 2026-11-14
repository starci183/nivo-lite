import { Injectable, Optional } from "@nestjs/common"
import { EntityEngineService } from "@modules/domain/entity-engine"
import {
    type ToolJson,
    type NativeToolFamily,
    type NativeCaller,
    type ToolManifest,
    argumentsOf,
    unknownTool,
} from "@modules/domain/tools"
import { RecordFilesService, type RecordFileTarget } from "@modules/domain/record-files"
import { FILE_TOOL } from "./file-native.names.policy"
import { fileRefusal, fileRefusalOf, fileVerbOf } from "./file-native.policy"
import {
    FILE_GET_INPUT_SCHEMA,
    FILE_GET_SCHEMA,
    FILE_LINK_INPUT_SCHEMA,
    FILE_LINK_SCHEMA,
    FILE_PUT_INPUT_SCHEMA,
    FILE_PUT_SCHEMA,
} from "./file-native.schema"

/**
 * The generic file tools: named by what they do to a record's file, never by a module. A put and a link take their replay key from the
 * gateway's durable receipt (a write of no `ledgered` mark: the same step asking the same call again is answered what it was, never
 * done twice).
 */
export const FILE_MANIFEST: ToolManifest = {
    key: "file",
    namespace: "nivo.tool.file",
    name: "Files",
    contractVersion: "file-native@2",
    tools: [
        {
            name: "put",
            description:
                "Stores a file in a declared file field of one of your own records, and answers `file`, its reference. Give `staged` (the file a provider tool staged: its `staged` answer) or `url` (the public https address a provider tool answered, for example a generated video or voice: fetched once for you). The field's own accepted types and size limit apply. A single field takes it in place of the file it held (that file is removed); a list field appends it while it holds fewer than its maximum (`list_full` otherwise), or, with `replaces` (the `key` of one of its files), takes that file's place.",
            scope: "write",
            defaultMode: "auto",
            inputSchema: FILE_PUT_INPUT_SCHEMA,
            argumentSchema: FILE_PUT_SCHEMA,
            domain: FILE_TOOL.put,
        },
        {
            name: "link",
            description:
                "Attaches a file already in the store to a declared file field of one of your own records: a file uploaded to this very field of this record, or a staged file of your workspace. Answers `file`, its reference. A single field takes it in place of the file it held (that file is removed); a list field appends it while it holds fewer than its maximum (`list_full` otherwise), or, with `replaces` (the `key` of one of its files), takes that file's place.",
            scope: "write",
            defaultMode: "auto",
            inputSchema: FILE_LINK_INPUT_SCHEMA,
            argumentSchema: FILE_LINK_SCHEMA,
            domain: FILE_TOOL.link,
        },
        {
            name: "get",
            description:
                "A signed address to read or send the file one of your own records holds in a declared file field, with its name, type and size, as `file`. The address works one hour; ask for longer with `expiresInSeconds` (up to 604800, seven days) when you send the file through a channel that keeps it. A list field needs `key`, the key of one of its files. A record of another agent or workspace, or none, is `not_found`; an empty field or a file the list does not hold `no_file`.",
            scope: "read",
            defaultMode: "auto",
            inputSchema: FILE_GET_INPUT_SCHEMA,
            argumentSchema: FILE_GET_SCHEMA,
            domain: FILE_TOOL.get,
            taints: true,
        },
    ],
}

/** The record field a file tool call names. */
interface FileArgs {
    readonly type: string
    readonly id: string
    readonly field: string
}

/** The parts a call runs on. */
interface Store {
    readonly engine: EntityEngineService
    readonly files: RecordFilesService
}

@Injectable()
/**
 * `nivo.tool.file.put`, `.link` and `.get` over EVERY `file` field an installed package declares, with no code per type (nivo-frame
 * `engineNoBusiness`). It does only: the arguments by the tool's bounded schema; the type by the installed declarations; the CALLING
 * AGENT, the same scope as the record tools (a file is reached through its record, so only the files of the agent's own records:
 * another agent's record is `not_found`); then the generic record files (`RecordFilesService`), which hold the field's declared limits, the workspace the gateway bound (never one an
 * argument names), the key law of the one records bucket, the plan's storage room and the write of the reference to the record.
 * Binary never travels through a call: a provider adapter stages the bytes (`RecordFilesService.stage`) or answers an address, and a
 * put moves or fetches it onto the record.
 */
export class FileNativeService implements NativeToolFamily {
    readonly manifest: ToolManifest = FILE_MANIFEST

    constructor(
        @Optional() private readonly engine?: EntityEngineService,
        @Optional() private readonly files?: RecordFilesService,
    ) {}

    /** Runs one file tool for the workspace the gateway bound. */
    async invoke(workspaceId: string, tool: string, args: ToolJson, caller: NativeCaller): Promise<ToolJson> {
        const verb = fileVerbOf(tool)
        if (verb === null) throw unknownTool(tool)
        const store = this.storeOf()
        if (verb === "put") {
            const asked = argumentsOf(tool, FILE_PUT_SCHEMA, args)
            const target = this.targetOf(store, caller, asked)
            const named = { name: asked.name, ...(asked.replaces === undefined ? {} : { replaces: asked.replaces }) }
            const source = asked.url === undefined ? { staged: asked.staged ?? "", ...named } : { url: asked.url, ...named }
            const file = await this.refused(() => store.files.put(workspaceId, target, source))
            return { file: { ...file } }
        }
        if (verb === "link") {
            const asked = argumentsOf(tool, FILE_LINK_SCHEMA, args)
            const target = this.targetOf(store, caller, asked)
            const file = await this.refused(() => store.files.link(workspaceId, target, {
                    key: asked.key,
                    name: asked.name,
                    ...(asked.replaces === undefined ? {} : { replaces: asked.replaces }),
                }),
            )
            return { file: { ...file } }
        }
        const asked = argumentsOf(tool, FILE_GET_SCHEMA, args)
        const target = { ...this.targetOf(store, caller, asked), ...(asked.key === undefined ? {} : { key: asked.key }) }
        const file = await this.refused(() => store.files.url(workspaceId, target, asked.expiresInSeconds))
        return { file: { ...file } }
    }

    /** The store, or `not_served` in an app that binds no entity engine or no file store. */
    private storeOf(): Store {
        const { engine, files } = this
        if (engine === undefined || files === undefined) throw fileRefusal("not_served")
        return { engine, files }
    }

    /** The record field of the call, confined to the calling agent's own records, once an installed package declares the type. */
    private targetOf(store: Store, caller: NativeCaller, asked: FileArgs): RecordFileTarget {
        if (!store.engine.catalog.has(asked.type)) throw fileRefusal("type_unknown")
        return { type: asked.type, recordId: asked.id, field: asked.field, agentId: caller.agentId }
    }

    /** Runs `work`, turning every expected refusal of the record files into the file tool's typed refusal. */
    private async refused<T>(work: () => Promise<T>): Promise<T> {
        try {
            return await work()
        } catch (cause) {
            throw fileRefusalOf(cause) ?? cause
        }
    }
}
