import { TOOL } from "@nivo-lite/agent-sdk/names"
import { Injectable, Optional } from "@nestjs/common"
import { ConnectionsService, type ConnectionRecord } from "@modules/domain/connections"
import {
    type ToolJson,
    type NativeToolFamily,
    type NativeCaller,
    type ToolManifest,
    argumentsOf,
    unknownTool,
} from "@modules/domain/tools"
import {
    DubbingRegistryService,
    SpeechRegistryService,
    VideoGenerationRegistryService,
    type ProviderFile,
    type ProviderFileRef,
    type ProviderFileSink,
} from "@modules/domain/provider-registry"
import {
    DUBBING_CREATE_INPUT_SCHEMA,
    DUBBING_CREATE_SCHEMA,
    JOB_GET_INPUT_SCHEMA,
    JOB_GET_SCHEMA,
    SPEECH_GENERATE_INPUT_SCHEMA,
    SPEECH_GENERATE_SCHEMA,
    SPEECH_VOICE_LIST_INPUT_SCHEMA,
    SPEECH_VOICE_LIST_SCHEMA,
    VIDEO_GENERATE_INPUT_SCHEMA,
    VIDEO_GENERATE_SCHEMA,
} from "./media-native.schema"
import { InjectProviderFileSink } from "./media-native.decorators"
import { mediaFailureOf, mediaRefusal } from "./media-refusal.policy"
import { DomainError } from "@modules/platform/errors"

/** A registry that answers the port of a provider, when the provider serves the purpose. */
interface PortRegistry<Port> {
    of(provider: string): Port | undefined
}

/** An account and the port of its provider. */
interface AccountPort<Port> {
    readonly connection: ConnectionRecord
    readonly port: Port
}

/** The default page of voices. */
const VOICE_PAGE = 20

/** The tool names inside the connector (the full id is `nivo.tool.<name>`). */
export const MEDIA_TOOL = {
    speechGenerate: "speech.generate",
    speechVoiceList: "speech.voice.list",
    dubbingCreate: "dubbing.create",
    dubbingGet: "dubbing.get",
    videoGenerate: "video.generate",
    videoGenerationGet: "video.generation.get",
} as const

/** The generic media purposes: named by what they do, never by the provider that does it. */
export const MEDIA_MANIFEST: ToolManifest = {
    key: "media",
    namespace: "nivo.tool",
    name: "Media",
    contractVersion: "media-native@1",
    timeoutMs: 180_000,
    tools: [
        {
            name: MEDIA_TOOL.speechGenerate,
            description:
                "Turns a text into an audio clip with a voice of the connected speech account. Answers a file reference (the clip is kept by the file store).",
            scope: "write",
            defaultMode: "ask",
            inputSchema: SPEECH_GENERATE_INPUT_SCHEMA,
            argumentSchema: SPEECH_GENERATE_SCHEMA,
            domain: TOOL.speechGenerate,
            internalOnly: true,
        },
        {
            name: MEDIA_TOOL.speechVoiceList,
            description: "The voices of the connected speech account, a page, with their ids, names and labels.",
            scope: "read",
            defaultMode: "auto",
            inputSchema: SPEECH_VOICE_LIST_INPUT_SCHEMA,
            argumentSchema: SPEECH_VOICE_LIST_SCHEMA,
            domain: TOOL.speechVoiceList,
            internalOnly: true,
        },
        {
            name: MEDIA_TOOL.dubbingCreate,
            description:
                "Starts dubbing a video or audio (by its https address) into another language. Answers the job id: poll it with `nivo.tool.dubbing.get`.",
            scope: "write",
            defaultMode: "ask",
            inputSchema: DUBBING_CREATE_INPUT_SCHEMA,
            argumentSchema: DUBBING_CREATE_SCHEMA,
            domain: TOOL.dubbingCreate,
            internalOnly: true,
        },
        {
            name: MEDIA_TOOL.dubbingGet,
            description: "Where a dubbing job stands (pending, done, failed); once done, a file reference per dubbed language.",
            scope: "read",
            defaultMode: "auto",
            inputSchema: JOB_GET_INPUT_SCHEMA,
            argumentSchema: JOB_GET_SCHEMA,
            domain: TOOL.dubbingGet,
            internalOnly: true,
        },
        {
            name: MEDIA_TOOL.videoGenerate,
            description:
                "Starts generating a video from a prompt (and an optional start image). Answers the job id: poll it with `nivo.tool.video.generation.get`.",
            scope: "write",
            defaultMode: "ask",
            inputSchema: VIDEO_GENERATE_INPUT_SCHEMA,
            argumentSchema: VIDEO_GENERATE_SCHEMA,
            domain: TOOL.videoGenerate,
            internalOnly: true,
            secretFields: ["image"],
        },
        {
            name: MEDIA_TOOL.videoGenerationGet,
            description:
                "Where a video generation stands (pending, done, failed); once done, a file reference per video (the provider keeps it 2 days).",
            scope: "read",
            defaultMode: "auto",
            inputSchema: JOB_GET_INPUT_SCHEMA,
            argumentSchema: JOB_GET_SCHEMA,
            domain: TOOL.videoGenerationGet,
            internalOnly: true,
        },
    ],
}

@Injectable()
/**
 * The generic media tools for internal callers: speech, dubbing and video generation, each run by the provider of the account the
 * tool runner handed the call (never a silent pick: a call with no account handed is refused `not_connected`), looked up in the
 * purpose's registry by that account's provider key. A provider's refusal is answered as the tool's own (`mediaFailureOf`); any other
 * failure is thrown as it is, with what it proves. A file is answered as a reference (`ProviderFileRef`); it is stored when the file
 * store (G3) is bound.
 */
export class MediaNativeService implements NativeToolFamily {
    readonly manifest: ToolManifest = MEDIA_MANIFEST

    constructor(
        private readonly connections: ConnectionsService,
        private readonly speech: SpeechRegistryService,
        private readonly dubbing: DubbingRegistryService,
        private readonly videos: VideoGenerationRegistryService,
        @Optional() @InjectProviderFileSink() private readonly sink?: ProviderFileSink,
    ) {}

    /** Runs one media tool. */
    async invoke(workspaceId: string, tool: string, args: ToolJson, caller: NativeCaller): Promise<ToolJson> {
        try {
            return await this.run(workspaceId, tool, args, caller)
        } catch (cause) {
            const failure = mediaFailureOf(cause)
            if (failure instanceof DomainError) throw failure
            throw cause
        }
    }

    private async run(workspaceId: string, tool: string, args: ToolJson, caller: NativeCaller): Promise<ToolJson> {
        switch (tool) {
            case MEDIA_TOOL.speechGenerate: {
                const asked = argumentsOf(tool, SPEECH_GENERATE_SCHEMA, args)
                const { connection, port } = await this.accountOf(workspaceId, caller, this.speech)
                const sink = this.sink
                if (sink === undefined) throw mediaRefusal("file_store_unavailable")
                const clip = await port.synthesize(connection, {
                    text: asked.text,
                    voiceId: asked.voiceId,
                    modelId: asked.modelId ?? null,
                    languageCode: asked.languageCode ?? null,
                    format: asked.format ?? null,
                    seed: asked.seed ?? null,
                })
                return { file: await this.referenceOf(workspaceId, connection, clip, sink) }
            }
            case MEDIA_TOOL.speechVoiceList: {
                const asked = argumentsOf(tool, SPEECH_VOICE_LIST_SCHEMA, args)
                const { connection, port } = await this.accountOf(workspaceId, caller, this.speech)
                const page = await port.voices(connection, {
                    search: asked.search ?? null,
                    pageSize: asked.pageSize ?? VOICE_PAGE,
                    pageToken: asked.pageToken ?? null,
                })
                return {
                    voices: page.voices.map((voice) => ({ ...voice, labels: { ...voice.labels } })),
                    nextPageToken: page.nextPageToken,
                }
            }
            case MEDIA_TOOL.dubbingCreate: {
                const asked = argumentsOf(tool, DUBBING_CREATE_SCHEMA, args)
                const { connection, port } = await this.accountOf(workspaceId, caller, this.dubbing)
                const started = await port.create(connection, {
                    sourceUrl: asked.sourceUrl,
                    targetLanguage: asked.targetLanguage,
                    sourceLanguage: asked.sourceLanguage ?? null,
                    name: asked.name ?? null,
                    speakers: asked.speakers ?? null,
                    watermark: asked.watermark ?? null,
                })
                return { jobId: started.jobId, expectedSeconds: started.expectedSeconds }
            }
            case MEDIA_TOOL.dubbingGet:
                return this.dubbingJobOf(workspaceId, tool, args, caller)
            case MEDIA_TOOL.videoGenerate: {
                const asked = argumentsOf(tool, VIDEO_GENERATE_SCHEMA, args)
                const { connection, port } = await this.accountOf(workspaceId, caller, this.videos)
                const started = await port.start(connection, {
                    prompt: asked.prompt,
                    image: asked.image ?? null,
                    modelId: asked.modelId ?? null,
                    aspectRatio: asked.aspectRatio ?? null,
                    resolution: asked.resolution ?? null,
                    durationSeconds: asked.durationSeconds ?? null,
                    personGeneration: asked.personGeneration ?? null,
                    seed: asked.seed ?? null,
                })
                return { jobId: started.jobId, modelId: started.modelId }
            }
            case MEDIA_TOOL.videoGenerationGet:
                return this.videoJobOf(workspaceId, tool, args, caller)
            default:
                throw unknownTool(tool)
        }
    }

    /** The state of a dubbing job, its files answered as references. */
    private async dubbingJobOf(workspaceId: string, tool: string, args: ToolJson, caller: NativeCaller): Promise<ToolJson> {
        const { connection, port, jobId } = await this.jobAccountOf(workspaceId, tool, args, caller, this.dubbing)
        const job = await port.get(connection, jobId)
        return {
            jobId: job.jobId,
            state: job.state,
            providerStatus: job.providerStatus,
            targetLanguages: [...job.targetLanguages],
            error: job.error,
            files: await this.referencesOf(workspaceId, connection, job.files),
        }
    }

    /** The state of a video generation, its files answered as references. */
    private async videoJobOf(workspaceId: string, tool: string, args: ToolJson, caller: NativeCaller): Promise<ToolJson> {
        const { connection, port, jobId } = await this.jobAccountOf(workspaceId, tool, args, caller, this.videos)
        const job = await port.get(connection, jobId)
        return {
            jobId: job.jobId,
            state: job.state,
            error: job.error === null ? null : { code: job.error.code, message: job.error.message },
            files: await this.referencesOf(workspaceId, connection, job.files),
        }
    }

    /** The job id a job-read call names (read first, as every call reads its arguments before it asks for the account) and its account. */
    private async jobAccountOf<Port extends { readonly provider: string }>(
        workspaceId: string,
        tool: string,
        args: ToolJson,
        caller: NativeCaller,
        registry: PortRegistry<Port>,
    ): Promise<AccountPort<Port> & { readonly jobId: string }> {
        const { jobId } = argumentsOf(tool, JOB_GET_SCHEMA, args)
        const account = await this.accountOf(workspaceId, caller, registry)
        return { ...account, jobId }
    }

    /**
     * The account the tool runner handed and its provider's port for the purpose: no account handed, an account of another workspace, or
     * a provider that serves no such purpose is `not_connected`.
     */
    private async accountOf<Port extends { readonly provider: string }>(
        workspaceId: string,
        caller: NativeCaller,
        registry: PortRegistry<Port>,
    ): Promise<AccountPort<Port>> {
        if (caller.connectionId === undefined) throw mediaRefusal("not_connected")
        const connection = await this.connections.find(workspaceId, caller.connectionId)
        const port = connection === null ? undefined : registry.of(connection.provider)
        if (connection === null || port === undefined) throw mediaRefusal("not_connected")
        return { connection, port }
    }

    /** The references of an async job's files: stored when the file store is bound (it keeps one copy per handle), else handles only. */
    private referencesOf(
        workspaceId: string,
        connection: ConnectionRecord,
        files: ReadonlyArray<ProviderFile>,
    ): Promise<ReadonlyArray<ToolJson>> {
        return Promise.all(files.map((file) => this.referenceOf(workspaceId, connection, file, this.sink)))
    }

    private async referenceOf(
        workspaceId: string,
        connection: ConnectionRecord,
        file: ProviderFile,
        sink: ProviderFileSink | undefined,
    ): Promise<ToolJson> {
        const stored = sink === undefined ? null : await sink.store(workspaceId, file)
        const reference: ProviderFileRef = {
            provider: file.provider,
            connectionId: connection.id,
            handle: file.handle,
            mimeType: file.mimeType,
            expiresAt: file.expiresAt,
            stored,
        }
        return { ...reference }
    }
}
