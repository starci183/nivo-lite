import { createHash } from "node:crypto"
import { mkdir, readdir, rename, stat, unlink, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { Injectable } from "@nestjs/common"
import type { OnModuleDestroy } from "@nestjs/common"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { TtsError, TtsErrorCode } from "./errors/tts.error"
import type { TtsClip } from "./tts.contracts"
import { TtsClient } from "./tts.client"
import { InjectTtsOptions } from "./tts.decorators"
import { TtsLogEvent } from "./tts.log-events"
import type { TtsOptions } from "./tts.options"
import type { Tts } from "./tts.port"

/** The cache keeps at most this many clips; the oldest are dropped. */
const CACHE_MAX_FILES = 400

const isMissing = (cause: unknown): boolean =>
    typeof cause === "object" && cause !== null && "code" in cause && cause.code === "ENOENT"

/** Resolves after `ms` milliseconds without a timer: the abort signal of a timeout fires once. */
const pause = (ms: number): Promise<void> =>
    ms <= 0
        ? Promise.resolve()
        : new Promise<void>((resolve) => {
              AbortSignal.timeout(ms).addEventListener("abort", () => resolve(), { once: true })
          })

@Injectable()
/**
 * Voiceover for the renderer: the provider client, pacing (one request at a time, a minimum gap between requests) and a disk cache keyed by
 * provider, voice, rate and text hash. A failure is not retried here: it throws a retryable `TtsError`, the render job is retried by the
 * queue, and the clips already cached are reused by the next delivery. With provider "none" this service never invents audio.
 */
export class TtsService implements Tts, OnModuleDestroy {
    private lastCall = 0
    private chain: Promise<unknown> = Promise.resolve()

    constructor(
        @InjectTtsOptions() private readonly options: TtsOptions,
        private readonly client: TtsClient,
        @InjectClock() private readonly clock: Clock,
        @InjectLogger() private readonly logger: Logger,
    ) {}

    /** True when a provider is configured. */
    get enabled(): boolean {
        return this.options.provider !== "none"
    }

    /** The provider id for the render report: "none" without a provider. */
    get providerId(): string {
        return this.enabled ? this.client.id : "none"
    }

    /** Frees the provider connection when the app stops. */
    onModuleDestroy(): void {
        this.client.close()
    }

    /** The MP3 for this text, from the cache or the provider; throws a `TtsError` when the provider is off or fails. */
    async clip(text: string, voice: string, ratePct: number, signal: AbortSignal): Promise<TtsClip> {
        if (!this.enabled) throw new TtsError({ code: TtsErrorCode.Disabled })
        const key = createHash("sha256")
            .update(`${this.client.id}\n${voice}\n${ratePct}\n${text}`)
            .digest("hex")
            .slice(0, 40)
        const file = join(this.options.cacheDir, `${key}.mp3`)
        const cached = await stat(file)
            .then(() => true)
            .catch((cause: unknown) => {
                if (isMissing(cause)) return false
                throw cause
            })
        if (cached) return { file, cached: true, provider: this.client.id }
        // Serialise: Edge throttles bursts, and one socket handles one request at a time anyway.
        const run = this.chain.then(() => this.paced(text, voice, ratePct, signal))
        this.chain = Promise.allSettled([run])
        const audio = await run
        return { file: await this.store(file, key, audio), cached: false, provider: this.client.id }
    }

    private async paced(text: string, voice: string, ratePct: number, signal: AbortSignal): Promise<Buffer> {
        await pause(this.lastCall + this.options.minGapMs - this.clock.now().getTime())
        this.lastCall = this.clock.now().getTime()
        try {
            return await this.client.synthesize({ text, voice, ratePct }, signal)
        } finally {
            this.lastCall = this.clock.now().getTime()
        }
    }

    /** Writes the clip into the cache; a read-only volume must not fail the render, so the clip falls back to the work dir. */
    private async store(file: string, key: string, audio: Buffer): Promise<string> {
        try {
            await mkdir(this.options.cacheDir, { recursive: true })
            const temp = `${file}.${process.pid}.tmp`
            await writeFile(temp, audio)
            await rename(temp, file)
            this.prune().catch((pruneCause: unknown) => this.logger.error(TtsLogEvent.CachePruneFailed, pruneCause))
            return file
        } catch (cause) {
            this.logger.error(TtsLogEvent.CacheWriteFailed, cause)
            await mkdir(this.options.workDir, { recursive: true })
            const fallback = join(this.options.workDir, `tts-${key}.mp3`)
            await writeFile(fallback, audio)
            return fallback
        }
    }

    /** Keeps the cache bounded: drops the oldest clips beyond CACHE_MAX_FILES. A failure only leaves the cache larger. */
    private async prune(): Promise<void> {
        const names = (await readdir(this.options.cacheDir)).filter((name) => name.endsWith(".mp3"))
        if (names.length <= CACHE_MAX_FILES) return
        const aged = await Promise.all(
            names.map(async (name) => ({ name, time: (await stat(join(this.options.cacheDir, name))).mtimeMs })),
        )
        aged.sort((a, b) => a.time - b.time)
        await Promise.all(
            aged.slice(0, names.length - CACHE_MAX_FILES).map((old) => unlink(join(this.options.cacheDir, old.name))),
        )
    }
}
