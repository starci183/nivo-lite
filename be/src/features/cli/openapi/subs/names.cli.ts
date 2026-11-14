import { readFile, writeFile } from "node:fs/promises"
import { CommandRunner, Option, SubCommand } from "nest-commander"
import { toolNamesOf, toolNamesTextOf } from "@modules/domain/openapi-tools"

/** What the command prints when a required flag is missing. */
const MISSING = "openapi names: --crm <id>, --document <file> and --out <file> are required; nothing read"

/** What `names` reads from its flags. */
export interface NamesOpenApiOptions {
    /** The CRM id the package is written against (`nivoweb`): fixed, never read from the document. */
    readonly crm?: string
    /** The path of the CRM's OpenAPI document the package pins (`src/crm/<id>/openapi.json`). */
    readonly document?: string
    /** The path of the generated names file. */
    readonly out?: string
    /** True only compares the file on disk with what the document gives; nothing is written. */
    readonly check?: boolean
}

/** The text of a file, or null when it cannot be read (absent). */
const textOf = (file: string): Promise<string | null> => readFile(file, "utf8").then(
    (text) => text,
    () => null,
)

@SubCommand({
    name: "names",
    description:
        "Generate a package's CRM operation names from the OpenAPI document it pins for that CRM (src/crm/<id>/openapi.json): every operation under the base path (servers[0] path, else info x-nivo-source basePath) is nivo.api.crm.<id>.<method>.<path segments>, one name a node calls and an interface reads, under the member <method>_<path> of CRM_<ID>, with CRM_<ID>_ID, CRM_<ID>_PROVIDER (crm.<id>) and the augmentation of @nivo-lite/agent-sdk/names (ToolNames, ApiNames, ProviderNames); an operation whose name breaks the law is left out; the document is read from a local JSON file, nothing is fetched; --check writes nothing and exits non-zero when the file on disk differs",
})
/** `cli openapi names --crm <id> --document <file> --out <file> [--check]`. */
export class NamesOpenApiCli extends CommandRunner {
    /**
     * Reads the document, makes the names file's text and writes it to `--out`; with `--check` only compares it with the file on disk
     * and sets a non-zero exit code when they differ. A document that gives no names prints why and sets a non-zero exit code.
     */
    async run(_passedParams: Array<string>, options: NamesOpenApiOptions = {}): Promise<void> {
        const { crm, document, out } = options
        if (crm === undefined || document === undefined || out === undefined) {
            process.stdout.write(`${MISSING}\n`)
            process.exitCode = 1
            return
        }
        const reading = toolNamesOf(await readFile(document, "utf8"), crm)
        if (!reading.ok) {
            const where = reading.at === null ? "" : ` at ${reading.at}`
            process.stdout.write(`openapi names: ${reading.problem}${where}; nothing written\n`)
            process.exitCode = 1
            return
        }
        const text = toolNamesTextOf(crm, reading)
        const count = reading.entries.length
        if (options.check === true) {
            const same = (await textOf(out)) === text
            process.stdout.write(`openapi names: ${out} ${same ? "matches" : "differs from"} the document (${count} operations)\n`)
            if (!same) process.exitCode = 1
            return
        }
        await writeFile(out, text, "utf8")
        process.stdout.write(`openapi names: wrote ${out} (${count} operations of CRM ${crm})\n`)
    }

    /** The CRM id. */
    @Option({ flags: "--crm <id>", description: "The CRM id the package is written against (nivoweb)" })
    parseCrm(value: string): string {
        return value
    }

    /** The document file. */
    @Option({ flags: "--document <file>", description: "Path of the source's OpenAPI document, a JSON file the command can read" })
    parseDocument(value: string): string {
        return value
    }

    /** The names file. */
    @Option({ flags: "--out <file>", description: "Path of the generated names file (for example src/crm/nivoweb/api.generated.ts)" })
    parseOut(value: string): string {
        return value
    }

    /** Compare instead of writing. */
    @Option({ flags: "--check", description: "Write nothing; exit non-zero when the file on disk differs from what the document gives" })
    parseCheck(): boolean {
        return true
    }
}
