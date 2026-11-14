import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { ConnectionsService } from "@modules/domain/connections"
import type { ConnectionRecord } from "@modules/domain/connections"
import { ToolsErrorCode, type NativeCaller } from "@modules/domain/tools"
import {
    DubbingRegistryService,
    providerRefusal,
    SpeechRegistryService,
    VideoGenerationRegistryService,
} from "@modules/domain/provider-registry"
import type { DubbingPort, ProviderFile, ProviderFileSink, SpeechPort, VideoGenerationPort } from "@modules/domain/provider-registry"
import {
    DUBBING_CREATE_SCHEMA,
    SPEECH_GENERATE_SCHEMA,
    SPEECH_TEXT_MAX,
    SPEECH_VOICE_LIST_SCHEMA,
    VIDEO_GENERATE_SCHEMA,
} from "./media-native.schema"
import { MEDIA_MANIFEST, MEDIA_TOOL, MediaNativeService } from "./media-native.service"
import { PROVIDER_FILE_SINK } from "./media-native.decorators"
import { MEDIA_TOOL_BUSINESS_REFUSALS, MEDIA_TOOL_REFUSALS } from "@modules/domain/provider-registry"
import { connectionRecord } from "@tests/fixtures/builders/connection-records.builder"
import { MEDIA_REFUSAL_CLASS } from "./media-refusal.policy"

const ACCOUNT: ConnectionRecord = connectionRecord({ id: "conn-1", provider: "elevenlabs", name: "Voice" })
const caller = (connectionId?: string): NativeCaller => ({
    agentId: "agent-1",
    conversationId: null,
    ...(connectionId === undefined ? {} : { connectionId, provider: "elevenlabs" }),
})

const file = (handle: string): ProviderFile => ({
    provider: "elevenlabs",
    handle,
    mimeType: "audio/mpeg",
    expiresAt: null,
    fetch: () => Promise.resolve(Buffer.from("x")),
})

const build = async (options: { readonly sink?: ProviderFileSink; readonly found?: ConnectionRecord | null } = {}) => {
    const connections = mock<ConnectionsService>()
    connections.find.mockResolvedValue(options.found === undefined ? ACCOUNT : options.found)
    const speechPort = mock<SpeechPort>({ provider: "elevenlabs" })
    const dubbingPort = mock<DubbingPort>({ provider: "elevenlabs" })
    const videoPort = mock<VideoGenerationPort>({ provider: "elevenlabs" })
    const speech = new SpeechRegistryService()
    const dubbing = new DubbingRegistryService()
    const videos = new VideoGenerationRegistryService()
    speech.register(speechPort)
    dubbing.register(dubbingPort)
    videos.register(videoPort)
    const moduleRef = await Test.createTestingModule({
        providers: [
            MediaNativeService,
            { provide: ConnectionsService, useValue: connections },
            { provide: SpeechRegistryService, useValue: speech },
            { provide: DubbingRegistryService, useValue: dubbing },
            { provide: VideoGenerationRegistryService, useValue: videos },
            { provide: PROVIDER_FILE_SINK, useValue: options.sink },
        ],
    }).compile()
    const service = moduleRef.get(MediaNativeService)
    return { service, speechPort, dubbingPort, videoPort, connections }
}

const refusalOf = (work: Promise<unknown>): Promise<unknown> =>
    Promise.resolve(work.then(
        () => null,
        (cause: unknown) => (typeof cause === "object" && cause !== null && "params" in cause ? cause.params : undefined) ?? cause,
    ))

describe("the media manifest", () => {
    it("names every tool by its generic purpose under nivo.tool, internal only, every write asking first", () => {
        expect(MEDIA_MANIFEST.tools.map((tool) => tool.domain)).toEqual([
            "nivo.tool.speech.generate",
            "nivo.tool.speech.voice.list",
            "nivo.tool.dubbing.create",
            "nivo.tool.dubbing.get",
            "nivo.tool.video.generate",
            "nivo.tool.video.generation.get",
        ])
        for (const tool of MEDIA_MANIFEST.tools) {
            expect(`${MEDIA_MANIFEST.namespace ?? ""}.${tool.name}`).toBe(tool.domain)
            expect(tool.internalOnly).toBe(true)
            expect(tool.defaultMode).toBe(tool.scope === "write" ? "ask" : "auto")
        }
    })

    it("classes every refusal: business only for what the node may go on from", () => {
        expect(Object.entries(MEDIA_REFUSAL_CLASS).filter(([, kind]) => kind === "business").map(([reason]) => reason)).toEqual([
            "rejected",
            "not_found",
        ])
        // The leaf lists the engine's tool registry states: every refusal, and exactly the business ones.
        expect([...MEDIA_TOOL_REFUSALS]).toEqual(Object.keys(MEDIA_REFUSAL_CLASS))
        expect([...MEDIA_TOOL_BUSINESS_REFUSALS]).toEqual(
            Object.entries(MEDIA_REFUSAL_CLASS).filter(([, kind]) => kind === "business").map(([reason]) => reason),
        )
    })
})

describe("the media schemas (the providers' documented bounds)", () => {
    it("bounds a speech", () => {
        expect(SPEECH_GENERATE_SCHEMA.safeParse({ text: "x", voiceId: "v" }).success).toBe(true)
        expect(SPEECH_GENERATE_SCHEMA.safeParse({ text: "x".repeat(SPEECH_TEXT_MAX + 1), voiceId: "v" }).success).toBe(false)
        expect(SPEECH_GENERATE_SCHEMA.safeParse({ text: "x", voiceId: "v", format: "mp3_44100_128" }).success).toBe(true)
        expect(SPEECH_GENERATE_SCHEMA.safeParse({ text: "x", voiceId: "v", format: "flac" }).success).toBe(false)
        expect(SPEECH_GENERATE_SCHEMA.safeParse({ text: "x", voiceId: "v", seed: 4_294_967_296 }).success).toBe(false)
        expect(SPEECH_GENERATE_SCHEMA.safeParse({ text: "x", voiceId: "v", extra: 1 }).success).toBe(false)
    })

    it("bounds a voice page at the provider's 100", () => {
        expect(SPEECH_VOICE_LIST_SCHEMA.safeParse({ pageSize: 100 }).success).toBe(true)
        expect(SPEECH_VOICE_LIST_SCHEMA.safeParse({ pageSize: 101 }).success).toBe(false)
    })

    it("takes a dubbing source as an https address only, with a target language", () => {
        expect(DUBBING_CREATE_SCHEMA.safeParse({ sourceUrl: "https://a.test/v.mp4", targetLanguage: "vi" }).success).toBe(true)
        expect(DUBBING_CREATE_SCHEMA.safeParse({ sourceUrl: "http://a.test/v.mp4", targetLanguage: "vi" }).success).toBe(false)
        expect(DUBBING_CREATE_SCHEMA.safeParse({ sourceUrl: "https://a.test/v.mp4" }).success).toBe(false)
        expect(DUBBING_CREATE_SCHEMA.safeParse({ sourceUrl: "https://a.test/v.mp4", targetLanguage: "Vietnamese" }).success).toBe(false)
    })

    it("takes the video parameters the Veo guide documents, and no other", () => {
        expect(VIDEO_GENERATE_SCHEMA.safeParse({ prompt: "p", aspectRatio: "9:16", resolution: "1080p", durationSeconds: "8" }).success).toBe(true)
        expect(VIDEO_GENERATE_SCHEMA.safeParse({ prompt: "p", aspectRatio: "4:3" }).success).toBe(false)
        expect(VIDEO_GENERATE_SCHEMA.safeParse({ prompt: "p", durationSeconds: "5" }).success).toBe(false)
        expect(VIDEO_GENERATE_SCHEMA.safeParse({ prompt: "p", image: { mimeType: "image/png", data: "aGVsbG8=" } }).success).toBe(true)
        expect(VIDEO_GENERATE_SCHEMA.safeParse({ prompt: "p", image: { mimeType: "image/png", data: "not base64!" } }).success).toBe(false)
    })
})

describe("MediaNativeService > the account", () => {
    it("refuses a call no account was handed: not_connected, nothing asked", async () => {
        const { service, speechPort } = await build()

        await expect(refusalOf(service.invoke("ws-1", MEDIA_TOOL.speechVoiceList, {}, caller()))).resolves.toEqual({
            reason: "not_connected",
            refusalClass: "infrastructure",
        })
        expect(speechPort.voices).not.toHaveBeenCalled()
    })

    it("refuses an account of another workspace, or of a provider that serves no such purpose", async () => {
        await expect(
            refusalOf((await build({ found: null })).service.invoke("ws-1", MEDIA_TOOL.speechVoiceList, {}, caller("conn-x"))),
        ).resolves.toMatchObject({ reason: "not_connected" })
        const other: ConnectionRecord = { ...ACCOUNT, provider: "google" }
        await expect(
            refusalOf((await build({ found: other })).service.invoke("ws-1", MEDIA_TOOL.speechVoiceList, {}, caller("conn-1"))),
        ).resolves.toMatchObject({ reason: "not_connected" })
    })

    it("refuses arguments that do not fit before any provider is asked", async () => {
        const { service, speechPort } = await build()

        await expect(service.invoke("ws-1", MEDIA_TOOL.speechGenerate, { text: "" }, caller("conn-1"))).rejects.toMatchObject({
            code: ToolsErrorCode.InvalidArguments,
        })
        expect(speechPort.synthesize).not.toHaveBeenCalled()
    })
})

describe("MediaNativeService > speech", () => {
    it("lists the voices of the handed account with the default page", async () => {
        const { service, speechPort } = await build()
        speechPort.voices.mockResolvedValue({
            voices: [{ voiceId: "v-1", name: "Mai", category: null, labels: { accent: "north" }, previewUrl: null }],
            nextPageToken: null,
        })

        await expect(service.invoke("ws-1", MEDIA_TOOL.speechVoiceList, { search: "Mai" }, caller("conn-1"))).resolves.toEqual({
            voices: [{ voiceId: "v-1", name: "Mai", category: null, labels: { accent: "north" }, previewUrl: null }],
            nextPageToken: null,
        })
        expect(speechPort.voices).toHaveBeenCalledWith(ACCOUNT, { search: "Mai", pageSize: 20, pageToken: null })
    })

    it("refuses a speech while no file store is bound: the clip could not be kept", async () => {
        const { service, speechPort } = await build()

        await expect(
            refusalOf(service.invoke("ws-1", MEDIA_TOOL.speechGenerate, { text: "Ch\u00e0o", voiceId: "v-1" }, caller("conn-1"))),
        ).resolves.toMatchObject({ reason: "file_store_unavailable" })
        expect(speechPort.synthesize).not.toHaveBeenCalled()
    })

    it("keeps the clip in the file store and answers its reference", async () => {
        const sink = mock<ProviderFileSink>()
        sink.store.mockResolvedValue("file-9")
        const { service, speechPort } = await build({ sink })
        speechPort.synthesize.mockResolvedValue(file("speech/abc"))

        await expect(
            service.invoke("ws-1", MEDIA_TOOL.speechGenerate, { text: "Ch\u00e0o", voiceId: "v-1", languageCode: "vi" }, caller("conn-1")),
        ).resolves.toEqual({
            file: { provider: "elevenlabs", connectionId: "conn-1", handle: "speech/abc", mimeType: "audio/mpeg", expiresAt: null, stored: "file-9" },
        })
        expect(speechPort.synthesize).toHaveBeenCalledWith(ACCOUNT, {
            text: "Ch\u00e0o",
            voiceId: "v-1",
            modelId: null,
            languageCode: "vi",
            format: null,
            seed: null,
        })
        expect(sink.store).toHaveBeenCalledWith("ws-1", expect.objectContaining({ handle: "speech/abc" }))
    })

    it.each([
        ["rejected", "rejected", "business"],
        ["not_found", "not_found", "business"],
        ["auth_refused", "connection_refused", "infrastructure"],
        ["no_credential", "not_connected", "infrastructure"],
        ["not_available", "not_available", "infrastructure"],
    ] as const)("answers a provider's %s as %s (%s)", async (provider, reason, refusalClass) => {
        const { service, speechPort } = await build()
        speechPort.voices.mockRejectedValue(providerRefusal("elevenlabs", provider))

        await expect(refusalOf(service.invoke("ws-1", MEDIA_TOOL.speechVoiceList, {}, caller("conn-1")))).resolves.toEqual({
            reason,
            refusalClass,
        })
    })

    it("rethrows any other failure as it is", async () => {
        const { service, speechPort } = await build()
        const cause = new Error("socket hang up")
        speechPort.voices.mockRejectedValue(cause)

        await expect(service.invoke("ws-1", MEDIA_TOOL.speechVoiceList, {}, caller("conn-1"))).rejects.toBe(cause)
    })
})

describe("MediaNativeService > the asynchronous jobs: create, then poll", () => {
    it("starts a dubbing and answers its job", async () => {
        const { service, dubbingPort } = await build()
        dubbingPort.create.mockResolvedValue({ jobId: "d-1", expectedSeconds: 127.5 })

        await expect(
            service.invoke("ws-1", MEDIA_TOOL.dubbingCreate, { sourceUrl: "https://a.test/v.mp4", targetLanguage: "es" }, caller("conn-1")),
        ).resolves.toEqual({ jobId: "d-1", expectedSeconds: 127.5 })
    })

    it.each([
        ["pending", [], []],
        ["done", [file("dubbing/d-1/es")], [{ provider: "elevenlabs", connectionId: "conn-1", handle: "dubbing/d-1/es", mimeType: "audio/mpeg", expiresAt: null, stored: null }]],
        ["failed", [], []],
    ] as const)("answers a %s dubbing with its files as handles while no store is bound", async (state, files, refs) => {
        const { service, dubbingPort } = await build()
        dubbingPort.get.mockResolvedValue({
            jobId: "d-1",
            state,
            providerStatus: state === "done" ? "dubbed" : "dubbing",
            targetLanguages: ["es"],
            error: state === "failed" ? "unreadable" : null,
            files,
        })

        await expect(service.invoke("ws-1", MEDIA_TOOL.dubbingGet, { jobId: "d-1" }, caller("conn-1"))).resolves.toMatchObject({
            jobId: "d-1",
            state,
            files: refs,
        })
    })

    it("starts a video and polls it to done", async () => {
        const { service, videoPort } = await build()
        videoPort.start.mockResolvedValue({ jobId: "op-1", modelId: "m" })
        videoPort.get.mockResolvedValueOnce({ jobId: "op-1", state: "pending", error: null, files: [] })
        videoPort.get.mockResolvedValueOnce({ jobId: "op-1", state: "done", error: null, files: [file("https://g.test/v")] })

        await expect(service.invoke("ws-1", MEDIA_TOOL.videoGenerate, { prompt: "p" }, caller("conn-1"))).resolves.toEqual({
            jobId: "op-1",
            modelId: "m",
        })
        await expect(service.invoke("ws-1", MEDIA_TOOL.videoGenerationGet, { jobId: "op-1" }, caller("conn-1"))).resolves.toMatchObject({
            state: "pending",
            files: [],
        })
        await expect(service.invoke("ws-1", MEDIA_TOOL.videoGenerationGet, { jobId: "op-1" }, caller("conn-1"))).resolves.toMatchObject({
            state: "done",
            error: null,
            files: [{ handle: "https://g.test/v", stored: null }],
        })
    })

    it("answers a failed video with the provider's code and words", async () => {
        const { service, videoPort } = await build()
        videoPort.get.mockResolvedValue({ jobId: "op-1", state: "failed", error: { code: 3, message: "refused" }, files: [] })

        await expect(service.invoke("ws-1", MEDIA_TOOL.videoGenerationGet, { jobId: "op-1" }, caller("conn-1"))).resolves.toEqual({
            jobId: "op-1",
            state: "failed",
            error: { code: 3, message: "refused" },
            files: [],
        })
    })
})
