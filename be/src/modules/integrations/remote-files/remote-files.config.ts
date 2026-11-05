import type { EnvSource } from "@modules/platform/config"
import type { RemoteFilesOptions } from "./remote-files.options"

/**
 * Reads the remote file limits, every key optional: REMOTE_FILES_MAX_BYTES (10 MiB) is the most bytes a file may hold, REMOTE_FILES_TIMEOUT
 * (15s) the longest wait for an answer and REMOTE_FILES_MAX_REDIRECTS (3) how many redirects a hop-by-hop read follows.
 */
export const parseRemoteFilesConfig = (env: EnvSource): RemoteFilesOptions => ({
    maxBytes: env.int("REMOTE_FILES_MAX_BYTES", 10 * 1024 * 1024),
    timeoutMs: env.duration("REMOTE_FILES_TIMEOUT", 15_000),
    maxRedirects: env.int("REMOTE_FILES_MAX_REDIRECTS", 3),
})
