import { createHash } from "node:crypto"
import { posix } from "node:path"
import { Injectable } from "@nestjs/common"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { OpenclawError, OpenclawErrorCode } from "./errors/openclaw.error"
import type { FileMeta, SyncFile, WorkspaceWriteResult } from "./openclaw.contracts"
import { InjectOpenclawFiles } from "./openclaw.decorators"
import { OpenclawLogEvent } from "./openclaw.log-events"
import type { OpenclawFiles } from "./openclaw-files.port"

/** The list of files this writer owns inside a workspace. Anything else there (memory/, files the agent wrote itself) is never touched. */
const MANIFEST = ".nivo-managed.json"
const FILE_MODE = 0o644

const shaOf = (text: string): string => createHash("sha256").update(text).digest("hex")

@Injectable()
/** Writes one agent bundle into its OpenClaw workspace, one way: every file through temp and rename, stale managed files removed. */
export class WorkspaceWriterService {
    constructor(
        @InjectOpenclawFiles() private readonly files: OpenclawFiles,
        @InjectLogger() private readonly logger: Logger,
    ) {}

    /** One hash over every file (path and content), independent of order: an equal hash is an equal workspace. */
    contentHash(files: ReadonlyArray<SyncFile>): string {
        const hash = createHash("sha256")
        for (const file of [...files].sort((a, b) => a.path.localeCompare(b.path))) {
            hash.update(`${file.path}\u0000${file.content}\u0000`)
        }
        return hash.digest("hex")
    }

    /** The size and hash of each file, for the sync record. */
    metaOf(files: ReadonlyArray<SyncFile>): ReadonlyArray<FileMeta> {
        return files.map((file) => ({
            path: file.path,
            bytes: Buffer.byteLength(file.content),
            sha256: shaOf(file.content),
        }))
    }

    /** True when every file is on disk with exactly this content and no managed file is left over. */
    matches(root: string, files: ReadonlyArray<SyncFile>): boolean {
        const wanted = new Set(files.map((file) => file.path))
        if (this.managedOf(root).some((path) => !wanted.has(path))) return false
        return files.every((file) => this.files.readText(this.safe(root, file.path)) === file.content)
    }

    /** Writes the bundle: changed files only, then removes the managed files the bundle no longer has and records the manifest. */
    write(root: string, files: ReadonlyArray<SyncFile>): WorkspaceWriteResult {
        const changed = files.filter((file) => this.files.readText(this.safe(root, file.path)) !== file.content)
        for (const file of changed) this.files.writeText(this.safe(root, file.path), file.content, FILE_MODE)
        const wanted = new Set(files.map((file) => file.path))
        const stale = this.managedOf(root).filter((path) => !wanted.has(path))
        for (const path of stale) {
            const target = this.safe(root, path)
            this.files.remove(target)
            this.prune(root, posix.dirname(target))
        }
        const manifest = JSON.stringify(files.map((file) => file.path).sort(), null, 2)
        this.files.writeText(posix.join(root, MANIFEST), manifest, FILE_MODE)
        return { written: changed.length, removed: stale.length }
    }

    /** A path of the bundle must stay inside the workspace: relative, no "..", never the manifest. */
    private safe(root: string, relative: string): string {
        const clean = posix.normalize(relative)
        const unsafe =
            relative === "" ||
            relative.includes("\\") ||
            clean.startsWith("..") ||
            clean.startsWith("/") ||
            /^[a-z]:/iu.test(clean) ||
            clean === MANIFEST ||
            clean.includes("../")
        if (unsafe) throw new OpenclawError({ code: OpenclawErrorCode.WorkspacePathUnsafe, params: { path: relative } })
        return posix.join(root, clean)
    }

    private managedOf(root: string): ReadonlyArray<string> {
        const text = this.files.readText(posix.join(root, MANIFEST))
        if (text === null) return []
        try {
            const value: unknown = JSON.parse(text)
            return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []
        } catch (cause) {
            this.logger.error(OpenclawLogEvent.ManifestUnreadable, cause)
            return []
        }
    }

    private prune(root: string, directory: string): void {
        if (directory.length > root.length && this.files.removeDirectoryIfEmpty(directory)) {
            this.prune(root, posix.dirname(directory))
        }
    }
}
