import { Injectable } from "@nestjs/common"
import type { ReseedCommandOptions, ReseedExit, ReseedOutput, ReseedTextReader } from "./tool-reseed.contracts"
import { ToolReseedService } from "./tool-reseed.service"

/** The rename map, relative to the lane root the command runs in. */
const DEFAULT_RESEED_MAP = "scripts/tool-rename-20261112.json"

/** What the `--map` option says about itself. */
export const RESEED_MAP_DESCRIPTION: string = `The rename map old id -> new id (default ${DEFAULT_RESEED_MAP})`

/** What the command prints when it is given both modes. */
const BOTH = "tools reseed: give --dry-run (the default) or --execute, not both; nothing read"

@Injectable()
/**
 * `cli tools reseed`: the command's own steps over the re-seed. It refuses the two modes together, reads the rename map (a map it cannot
 * read or parse is handed over as null, so the re-seed refuses it `bad_map`), runs the re-seed, and makes the process end non-zero when
 * the re-seed was refused or an agent failed.
 */
export class ToolReseedCommandService {
    constructor(private readonly reseeds: ToolReseedService) {}

    /** Runs the command: the report goes to `out`, a failing outcome to `exit`. */
    async run(out: ReseedOutput, exit: ReseedExit, options: ReseedCommandOptions, readText: ReseedTextReader): Promise<void> {
        if (options.dryRun === true && options.execute === true) {
            out.write(`${BOTH}\n`)
            exit.exitCode = 1
            return
        }
        const path = options.map ?? DEFAULT_RESEED_MAP
        const report = await this.reseeds.reseedFor(out, {
            workspaceId: options.workspace,
            execute: options.execute,
            map: { json: await this.mapJsonOf(path, readText), path },
        })
        if (report.refusal !== null || report.failed > 0) exit.exitCode = 1
    }

    /** The JSON of a map file, or null when it cannot be read or parsed. */
    private async mapJsonOf(path: string, readText: ReseedTextReader): Promise<unknown> {
        try {
            const parsed: unknown = JSON.parse(await readText(path, "utf8"))
            return parsed
        } catch {
            return null
        }
    }
}
