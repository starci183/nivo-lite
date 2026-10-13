import { tmpdir } from "node:os"
import { join } from "node:path"
import type { EnvSource } from "@modules/platform/config"
import type { TtsOptions } from "./tts.options"

/** Reads the text-to-speech options: every value is a tunable with a literal default, the provider switch aside. */
export const parseTtsConfig = (env: EnvSource): TtsOptions => ({
    provider: env.optional("VIDEO_TTS_PROVIDER") === "none" ? "none" : "edge",
    cacheDir: env.optional("VIDEO_CACHE_DIR") ?? "/var/cache/nivo-video",
    workDir: env.optional("VIDEO_WORK_DIR") ?? join(tmpdir(), "nivo-video"),
    minGapMs: env.int("VIDEO_TTS_MIN_GAP_MS", 700),
})
