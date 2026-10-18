import { Test } from "@nestjs/testing"
import { PassThrough } from "node:stream"
import { MsEdgeTTS } from "msedge-tts"
import { TtsErrorCode } from "./errors/tts.error"
import { TtsClient } from "./tts.client"

/** What one SDK connection was asked to do. */
interface Session {
    voice: string
    rate: string
    closed: boolean
}

const sessions = new Map<MsEdgeTTS, Session>()

const mockStreams: Array<PassThrough> = []

const mockState = { offline: false }

const sessionOf = (tts: MsEdgeTTS): Session => {
    const known = sessions.get(tts) ?? { voice: "", rate: "", closed: false }
    sessions.set(tts, known)
    return known
}

const mockSessions = (): Array<Session> => [...sessions.values()]

const setMetadata = jest.spyOn(MsEdgeTTS.prototype, "setMetadata")

const toStream = jest.spyOn(MsEdgeTTS.prototype, "toStream")

const close = jest.spyOn(MsEdgeTTS.prototype, "close")

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
    sessions.clear()
    mockStreams.length = 0
    mockState.offline = false
    setMetadata.mockImplementation(function (this: MsEdgeTTS, voice: string) {
        sessionOf(this).voice = voice
        return mockState.offline ? Promise.reject(new Error("offline")) : Promise.resolve()
    })
    toStream.mockImplementation(function (this: MsEdgeTTS, _text: string, options) {
        sessionOf(this).rate = String(options?.rate ?? "")
        return { audioStream: mockStreams.shift() ?? new PassThrough(), metadataStream: null }
    })
    close.mockImplementation(function (this: MsEdgeTTS) {
        sessionOf(this).closed = true
    })
})

afterAll(() => {
    jest.restoreAllMocks()
})

const build = async () => {
    const moduleRef = await Test.createTestingModule({ providers: [TtsClient] }).compile()
    return moduleRef.get(TtsClient)
}

describe("TtsClient", () => {
    it("answers the audio of the stream with a signed rate", async () => {
        speaking(AUDIO.subarray(0, 500), AUDIO.subarray(500))
        const tts = await build()

        const audio = await tts.synthesize({ ...REQUEST, ratePct: 12.4 }, new AbortController().signal)

        expect(audio).toHaveLength(900)
        expect(mockSessions()[0]).toMatchObject({ voice: "vi-VN-HoaiMyNeural", rate: "+12%" })
    })
    it("writes a negative rate with its own sign and reuses the connection for the same voice", async () => {
        speaking(AUDIO)
        speaking(AUDIO)
        const tts = await build()
        await tts.synthesize({ ...REQUEST, ratePct: -5 }, new AbortController().signal)
        await tts.synthesize(REQUEST, new AbortController().signal)

        expect(mockSessions()).toHaveLength(1)
        expect(mockSessions()[0]?.rate).toBe("+0%")
    })
    it("opens a new connection when the voice changes and closes the old one", async () => {
        speaking(AUDIO)
        speaking(AUDIO)
        const tts = await build()
        await tts.synthesize(REQUEST, new AbortController().signal)
        await tts.synthesize({ ...REQUEST, voice: "vi-VN-NamMinhNeural" }, new AbortController().signal)

        expect(mockSessions().map((session) => [session.voice, session.closed])).toEqual([
            ["vi-VN-HoaiMyNeural", true],
            ["vi-VN-NamMinhNeural", false],
        ])
    })
    it("treats audio that is too short as a retryable failure and rebuilds the connection", async () => {
        speaking(Buffer.alloc(10))
        const tts = await build()

        await expect(tts.synthesize(REQUEST, new AbortController().signal)).rejects.toMatchObject({
            code: TtsErrorCode.Retryable,
        })

        expect(mockSessions()[0]?.closed).toBe(true)
    })
    it("treats a stream error as retryable", async () => {
        const stream = new PassThrough()
        mockStreams.push(stream)
        setImmediate(() => stream.destroy(new Error("socket closed")))

        await expect((await build()).synthesize(REQUEST, new AbortController().signal)).rejects.toMatchObject({
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

        await expect((await build()).synthesize(REQUEST, new AbortController().signal)).resolves.toHaveLength(900)
    })
})

describe("TtsClient", () => {
    it("stops with its own code when the caller aborts", async () => {
        const abort = new AbortController()
        const running = (await build()).synthesize(REQUEST, abort.signal)
        await new Promise<void>((resolve) => setImmediate(resolve))
        abort.abort()

        await expect(running).rejects.toMatchObject({ code: TtsErrorCode.Aborted })
    })
    it("gives up as retryable when the provider takes too long", async () => {
        const timeout = new AbortController()
        const spy = jest.spyOn(AbortSignal, "timeout").mockReturnValue(timeout.signal)
        const running = (await build()).synthesize(REQUEST, new AbortController().signal)
        await new Promise<void>((resolve) => setImmediate(resolve))
        timeout.abort()

        await expect(running).rejects.toMatchObject({ code: TtsErrorCode.Retryable })
        spy.mockRestore()
    })
    it("wraps a failure of the SDK as retryable", async () => {
        mockState.offline = true
        const tts = await build()

        await expect(tts.synthesize(REQUEST, new AbortController().signal)).rejects.toMatchObject({
            code: TtsErrorCode.Retryable,
        })
        expect(tts.id).toBe("edge")
    })
    it("closes the connection when the app stops", async () => {
        speaking(AUDIO)
        const tts = await build()
        await tts.synthesize(REQUEST, new AbortController().signal)

        tts.close()

        expect(mockSessions()[0]?.closed).toBe(true)
    })
})
