import { Injectable, Optional } from "@nestjs/common"
import type { AgentTurnView } from "@modules/domain/agent-work"
import { AccountDataReadService, AccountDataTypesService } from "@modules/domain/account-data"
import { ConnectionBindingsReadService } from "@modules/domain/connections"
import { FILES_MEMBER } from "@modules/domain/provider-triggers/trigger-delivery.policy"
import { triggerDeclarations } from "@modules/domain/provider-triggers/trigger-declarations.registry"
import { eachInOrder, isRecord, parseJsonText } from "@modules/platform/primitives"
import type { FlowTriggerFile } from "./agent-graphs.port"

/** The pictures and files a wake kept of its line, as the trigger hands them on (an entry that is no kept file is left out). */
const filesOf = (stored: unknown): ReadonlyArray<FlowTriggerFile> =>
    (Array.isArray(stored) ? stored : []).flatMap((entry: unknown): ReadonlyArray<FlowTriggerFile> => {
        if (!isRecord(entry)) return []
        const { id, name, contentType, url } = entry
        return typeof id === "string" && typeof url === "string"
            ? [{ id, url, name: typeof name === "string" ? name : "", contentType: typeof contentType === "string" ? contentType : "" }]
            : []
    })

/** The files a wake kept of one line, from the JSON text its context holds (text that is no JSON keeps none). */
const filesOfText = (text: string | undefined): ReadonlyArray<FlowTriggerFile> => {
    const read = text === undefined ? null : parseJsonText(text)
    return filesOf(read?.ok === true ? read.value : undefined)
}

/** A pipeline event as its run reads it: its data and, for an event about a person, its subject (the channel identity). */
export interface PipelineEvent {
    readonly data: Readonly<Record<string, unknown>>
    readonly subject?: Readonly<Record<string, unknown>> | undefined
}

@Injectable()
/**
 * What a run reads of the engine's own raw account rows when its wake starts: the words and time of the customer messages a channel wake
 * names (`<provider>.message` rows of purpose `chat.message`, kept by the intake before the wake) and the members a verb DECLARES the
 * engine fills from the row its event's id names. Only a row of one of the workspace's own connections is read. In an app with no
 * account store nothing is read.
 */
export class AgentGraphRawRowsService {
    constructor(
        @Optional() private readonly rows?: AccountDataReadService,
        @Optional() private readonly rowTypes?: AccountDataTypesService,
        @Optional() private readonly connections?: ConnectionBindingsReadService,
    ) {}

    /**
     * The stored value of the account data row of the id among the row types of the purpose, only a row of one of the workspace's own
     * connections; null when the app holds no account store or no row of the id is found.
     */
    async rowOf(workspaceId: string, purpose: string, id: string): Promise<Readonly<Record<string, unknown>> | null> {
        const { rows, rowTypes, connections } = this
        if (rows === undefined || rowTypes === undefined || connections === undefined) return null
        let found: Readonly<Record<string, unknown>> | null = null
        let settled = false
        await eachInOrder(
            rowTypes.all().filter((one) => one.purpose === purpose),
            async (type) => {
                if (settled) return
                const row = await rows.byId(type.name, id)
                if (row === null) return
                settled = true
                found = (await connections.recordOf(workspaceId, row.connectionId)) === null ? null : row.value
            },
        )
        return found
    }

    /**
     * The data of an event of the one event pipeline, rebuilt when its run starts (the wake carries ids only, triggers rule 5): the stored
     * raw row the event was translated from, read by its type and id (only a row of one of the workspace's own connections), parsed by its
     * declaration's raw schema and run through the declaration's PURE `translate` again (the same row gives the same event), its data
     * parsed by the data schema; a source that keeps no raw row carries its data as JSON text (`dataJson`). The files the entry kept ride on
     * the wake (`filesJson`) and are the data's `files`. Empty data when the row is gone (retention), its declaration is not registered, or
     * the row no longer translates: the run still starts, with the ids it has.
     */
    async pipelineDataOf(turn: Pick<AgentTurnView, "workspaceId" | "context">): Promise<Readonly<Record<string, unknown>>> {
        return (await this.pipelineEventOf(turn)).data
    }

    /**
     * The data of a pipeline event (as `pipelineDataOf`) and its SUBJECT when its declaration's translate of the stored row gives one: the
     * channel identity of the person (channel, the channel's own id of them, the name and picture it shows), a generic member of the
     * scope (`trigger.subject`, ROAD-API section 3.1). A source that keeps no raw row gives none.
     */
    async pipelineEventOf(turn: Pick<AgentTurnView, "workspaceId" | "context">): Promise<PipelineEvent> {
        const { rawType, rawRowId, dataJson, filesJson } = turn.context
        const own = rawType !== undefined && rawRowId !== undefined ? await this.translatedOf(turn, rawType, rawRowId) : null
        const carried = own === null && dataJson !== undefined ? parseJsonText(dataJson) : null
        const data: Readonly<Record<string, unknown>> =
            own?.data ?? (carried?.ok === true && isRecord(carried.value) ? carried.value : {})
        const files = filesOfText(filesJson)
        const withFiles = files.length === 0 ? data : { ...data, [FILES_MEMBER]: files }
        return own?.subject === undefined ? { data: withFiles } : { data: withFiles, subject: own.subject }
    }

    /** What its declaration's `translate` gives the stored raw row, or null (no row, not the workspace's, no declaration, dropped). */
    private async translatedOf(
        turn: Pick<AgentTurnView, "workspaceId" | "context">,
        rawType: string,
        rawRowId: string,
    ): Promise<PipelineEvent | null> {
        const { rows, connections } = this
        const named = turn.context.declaration
        if (rows === undefined || connections === undefined || named === undefined) return null
        const at = named.indexOf(":")
        const declaration = at <= 0 ? null : triggerDeclarations.of(named.slice(0, at), named.slice(at + 1))
        if (declaration === null) return null
        const row = await rows.byId(rawType, rawRowId)
        if (row === null || (await connections.recordOf(turn.workspaceId, row.connectionId)) === null) return null
        const raw = declaration.raw.safeParse(row.value)
        if (!raw.success) return null
        const event = declaration.translate(raw.data, { connectionId: row.connectionId })
        if (event === null) return null
        const data = declaration.data.safeParse(event.data)
        if (!data.success || !isRecord(data.data)) return null
        return event.subject === undefined ? { data: data.data } : { data: data.data, subject: { ...event.subject } }
    }

}
