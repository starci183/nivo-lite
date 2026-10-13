import { PassThrough } from "node:stream"
import { TtsErrorCode } from "./errors/tts.error"
import { TtsClient } from "./tts.client"

interface MockSession {
    voice: string
    rate: string
    closed: boolean
}

const mockSessions: Array<MockSession> = []
const mockStreams: Array<PassThrough> = []
const mockState = { offline: false }

interface StreamOptions {
    rate: string
}

interface StreamResult {
    audioStream: PassThrough
}

jest.mock("msedge-tts", () => ({
    OUTPUT_FORMAT: { AUDIO_24KHZ_96KBITRATE_MONO_MP3: "mp3" },
    MsEdgeTTS: class {
        private readonly session: MockSession = { voice: "", rate: "", closed: false }

        constructor() {
            mockSessions.push(this.session)
        }

        setMetadata(voice: string): Promise<void> {
            this.session.voice = voice
            return mockState.offline ? Promise.reject(new Error("offline")) : Promise.resolve()
        }

        toStream(_text: string, options: StreamOptions): StreamResult {
            this.session.rate = options.rate
            return { audioStream: mockStreams.shift() ?? new PassThrough() }
        }

        close(): void {
            this.session.closed = true
        }
    },
}))

const REQUEST = { text: "Hello", voice: "vi-VN-HoaiMyNeural", ratePct: 0 }
const AUDIO = Buffer.alloc(900, 1)

/** A stream that answers `chunks` and then ends, once the client listens. */
const speaking = (...chunks: Array<Buffer>): PassThrough => {
    const stream = new PassThrough()
    mockStreams.push(stream)
    setImmediate(() => {
        for (const chunk of chunks) stream.write(chunk)
        stream.end()
    })
    return stream
}

beforeEach(() => {
    mockSessions.length = 0
    mockStreams.length = 0
    mockState.offline = false
})

describe("TtsClient", () => {
    it("answers the audio of the stream with a signed rate", async () => {
        speaking(AUDIO.subarray(0, 500), AUDIO.subarray(500))
        const tts = new TtsClient()

        const audio = await tts.synthesize({ ...REQUEST, ratePct: 12.4 }, new AbortController().signal)

        expect(audio.length).toBe(900)
        expect(mockSessions[0]).toMatchObject({ voice: "vi-VN-HoaiMyNeural", rate: "+12%" })
    })

    it("writes a negative rate with its own sign and reuses the connection for the same voice", async () => {
        speaking(AUDIO)
        speaking(AUDIO)
        const tts = new TtsClient()
        await tts.synthesize({ ...REQUEST, ratePct: -5 }, new AbortController().signal)
        await tts.synthesize(REQUEST, new AbortController().signal)

        expect(mockSessions).toHaveLength(1)
        expect(mockSessions[0]?.rate).toBe("+0%")
    })

    it("opens a new connection when the voice changes and closes the old one", async () => {
        speaking(AUDIO)
        speaking(AUDIO)
        const tts = new TtsClient()
        await tts.synthesize(REQUEST, new AbortController().signal)
        await tts.synthesize({ ...REQUEST, voice: "vi-VN-NamMinhNeural" }, new AbortController().signal)

        expect(mockSessions.map((session) => [session.voice, session.closed])).toEqual([
            ["vi-VN-HoaiMyNeural", true],
            ["vi-VN-NamMinhNeural", false],
        ])
    })

    it("treats audio that is too short as a retryable failure and rebuilds the connection", async () => {
        speaking(Buffer.alloc(10))
        const tts = new TtsClient()

        await expect(tts.synthesize(REQUEST, new AbortController().signal)).rejects.toMatchObject({
            code: TtsErrorCode.Retryable,
        })

        expect(mockSessions[0]?.closed).toBe(true)
    })

    it("treats a stream error as retryable", async () => {
        const stream = new PassThrough()
        mockStreams.push(stream)
        setImmediate(() => stream.destroy(new Error("socket closed")))

        await expect(new TtsClient().synthesize(REQUEST, new AbortController().signal)).rejects.toMatchObject({
            code: TtsErrorCode.Retryable,
        })
    })

    it("answers a close of the stream like its end", async () => {
        const stream = new PassThrough()
        mockStreams.push(stream)
        setImmediate(() => {
            stream.write(AUDIO)
            stream.destroy()
        })

        await expect(new TtsClient().synthesize(REQUEST, new AbortController().signal)).resolves.toHaveLength(900)
    })

    it("stops with its own code when the caller aborts", async () => {
        const abort = new AbortController()
        const running = new TtsClient().synthesize(REQUEST, abort.signal)
        await new Promise<void>((resolve) => setImmediate(resolve))
        abort.abort()

        await expect(running).rejects.toMatchObject({ code: TtsErrorCode.Aborted })
    })

    it("gives up as retryable when the provider takes too long", async () => {
        const timeout = new AbortController()
        const spy = jest.spyOn(AbortSignal, "timeout").mockReturnValue(timeout.signal)
        const running = new TtsClient().synthesize(REQUEST, new AbortController().signal)
        await new Promise<void>((resolve) => setImmediate(resolve))
        timeout.abort()

        await expect(running).rejects.toMatchObject({ code: TtsErrorCode.Retryable })
        spy.mockRestore()
    })

    it("wraps a failure of the SDK as retryable", async () => {
        mockState.offline = true
        const tts = new TtsClient()

        await expect(tts.synthesize(REQUEST, new AbortController().signal)).rejects.toMatchObject({
            code: TtsErrorCode.Retryable,
        })
        expect(tts.id).toBe("edge")
    })

    it("closes the connection when the app stops", async () => {
        speaking(AUDIO)
        const tts = new TtsClient()
        await tts.synthesize(REQUEST, new AbortController().signal)

        tts.close()

        expect(mockSessions[0]?.closed).toBe(true)
    })
})
