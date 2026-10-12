import { createHash } from "node:crypto"
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmdirSync, rmSync, writeFileSync } from "node:fs"
import { dirname, join, normalize, sep } from "node:path"
import { Injectable } from "@nestjs/common"
import { OpenclawError, OpenclawErrorCode } from "./errors/openclaw.error"
import type { FileMeta, SyncFile } from "./openclaw.contracts"

/** The list of files this writer owns inside a workspace. Anything else there (memory/, files the agent wrote itself) is never touched. */
const MANIFEST = ".nivo-managed.json"

const shaOf = (text: string): string => createHash("sha256").update(text).digest("hex")

@Injectable()
/** Writes one agent bundle into its OpenClaw workspace, one way: every file through temp and rename, stale managed files removed. */
export class WorkspaceWriterService {
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
        return files.every((file) => {
            try {
                return readFileSync(this.safe(root, file.path), "utf8") === file.content
            } catch {
                return false
            }
        })
    }

    /** Writes the bundle: changed files only, then removes the managed files the bundle no longer has and records the manifest. */
    write(root: string, files: ReadonlyArray<SyncFile>): { readonly written: number; readonly removed: number } {
        mkdirSync(root, { recursive: true })
        let written = 0
        for (const file of files) {
            const target = this.safe(root, file.path)
            if (this.readText(target) === file.content) continue
            this.atomicWrite(target, file.content)
            written += 1
        }
        const wanted = new Set(files.map((file) => file.path))
        let removed = 0
        for (const old of this.managedOf(root)) {
            if (wanted.has(old)) continue
            const target = this.safe(root, old)
            rmSync(target, { force: true })
            this.prune(root, dirname(target))
            removed += 1
        }
        this.atomicWrite(join(root, MANIFEST), JSON.stringify(files.map((file) => file.path).sort(), null, 2))
        return { written, removed }
    }

    /** A path of the bundle must stay inside the workspace: relative, no "..", never the manifest. */
    private safe(root: string, relative: string): string {
        const clean = normalize(relative)
        const unsafe =
            relative === "" ||
            clean.startsWith("..") ||
            clean.startsWith(sep) ||
            /^[a-z]:/iu.test(clean) ||
            clean === MANIFEST ||
            clean.includes(`..${sep}`)
        if (unsafe) throw new OpenclawError({ code: OpenclawErrorCode.WorkspacePathUnsafe, params: { path: relative } })
        return join(root, clean)
    }

    private readText(file: string): string | null {
        try {
            return readFileSync(file, "utf8")
        } catch {
            return null
        }
    }

    private atomicWrite(file: string, content: string): void {
        mkdirSync(dirname(file), { recursive: true })
        const temp = `${file}.${process.pid}.tmp`
        writeFileSync(temp, content, { mode: 0o644 })
        renameSync(temp, file)
    }

    private managedOf(root: string): Array<string> {
        const text = this.readText(join(root, MANIFEST))
        if (text === null) return []
        try {
            const value: unknown = JSON.parse(text)
            return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []
        } catch {
            return []
        }
    }

    private prune(root: string, start: string): void {
        let dir = start
        while (dir.length > root.length && existsSync(dir) && readdirSync(dir).length === 0) {
            rmdirSync(dir)
            dir = dirname(dir)
        }
    }
}
