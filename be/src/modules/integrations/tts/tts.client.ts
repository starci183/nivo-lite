import { Injectable } from "@nestjs/common"
import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts"
import { TtsError, TtsErrorCode } from "./errors/tts.error"
import type { TtsRequest } from "./tts.contracts"

/** The longest one synthesis may take before it is given up as retryable. */
const SYNTHESIS_TIMEOUT_MS = 30_000

/** A clip shorter than this is not audio: the provider answered an empty or truncated stream. */
const MIN_AUDIO_BYTES = 800

/** The signed percent text the provider takes for a rate. */
const rateOf = (ratePct: number): string => {
    const pct = Math.round(ratePct)
    return `${pct >= 0 ? "+" : ""}${pct}%`
}

@Injectable()
/** The only caller of the Edge read-aloud SDK: free, no key, Vietnamese neural voices. It throttles bursts, so `TtsService` paces the calls. */
export class TtsClient {
    private client: MsEdgeTTS | null = null
    private voice = ""

    /** The provider id; part of the cache key so two providers never share a cached clip. */
    readonly id = "edge"

    /** The MP3 bytes for the request; a failure other than the caller's abort is a retryable `TtsError`. */
    async synthesize(request: TtsRequest, signal: AbortSignal): Promise<Buffer> {
        const stop = AbortSignal.any([signal, AbortSignal.timeout(SYNTHESIS_TIMEOUT_MS)])
        try {
            const tts = await this.ready(request.voice)
            const { audioStream } = tts.toStream(request.text, { rate: rateOf(request.ratePct) })
            const chunks: Array<Buffer> = []
            await new Promise<void>((resolve, reject) => {
                const onAbort = (): void =>
                    reject(new TtsError({ code: signal.aborted ? TtsErrorCode.Aborted : TtsErrorCode.Retryable }))
                stop.addEventListener("abort", onAbort, { once: true })
                const done = (): void => {
                    stop.removeEventListener("abort", onAbort)
                    resolve()
                }
                audioStream.on("data", (chunk: Buffer) => chunks.push(chunk))
                audioStream.on("end", done)
                audioStream.on("close", done)
                audioStream.on("error", (cause: Error) => {
                    stop.removeEventListener("abort", onAbort)
                    reject(new TtsError({ code: TtsErrorCode.Retryable, cause }))
                })
            })
            const audio = Buffer.concat(chunks)
            if (audio.length < MIN_AUDIO_BYTES) throw new TtsError({ code: TtsErrorCode.Retryable })
            return audio
        } catch (cause) {
            this.reset() // a broken socket is rebuilt on the next call
            if (cause instanceof TtsError) throw cause
            throw new TtsError({ code: TtsErrorCode.Retryable, cause })
        }
    }

    /** Frees the connection; called when the app stops. */
    close(): void {
        this.reset()
    }

    private async ready(voice: string): Promise<MsEdgeTTS> {
        if (this.client === null || this.voice !== voice) {
            this.reset()
            const client = new MsEdgeTTS()
            await client.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3)
            this.client = client
            this.voice = voice
        }
        return this.client
    }

    private reset(): void {
        this.client?.close()
        this.client = null
        this.voice = ""
    }
}
