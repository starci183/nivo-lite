import { readFile } from "node:fs/promises"
import { CommandRunner, Option, SubCommand } from "nest-commander"
import { OpenApiToolsOperatorService } from "@modules/domain/data-hub"
import { crmProviderKeyOf } from "@nivo-lite/agent-sdk/names"

/** What the command prints when a required flag is missing. */
const MISSING = "openapi pin: --workspace <id>, --connection <id>, --crm <id> and --document <path> are required; nothing read"

/** The header a workspace id goes in when the operator names none. */
const DEFAULT_HEADER = "X-Workspace-Id"

/** What `pin` reads from its flags. */
export interface PinOpenApiOptions {
    /** The workspace. */
    readonly workspace?: string
    /** The API connection. */
    readonly connection?: string
    /** The CRM id the connection serves (`nivoweb`). */
    readonly crm?: string
    /** The path of the OpenAPI document, a JSON file. */
    readonly document?: string
    /** The header parameter that carries the workspace id. */
    readonly header?: string
    /** True lets writes act for real. */
    readonly live?: boolean
    /** True writes the pin; absent only reports. */
    readonly execute?: boolean
}

@SubCommand({
    name: "pin",
    description:
        "Pin a CRM's OpenAPI document on a CRM connection of a workspace, as its owner, under the CRM id given (--crm nivoweb): every operation becomes nivo.api.crm.<id>.<method>.<path>; prints the sha256 of the document, each operation the installed packages call on that CRM with its state (ready, missing, unsupported, mode_mismatch), its effect mark and who may call it, then each operation no package calls; refuses a document the provider cannot read, a malformed CRM id and a CRM id another account of the workspace serves; the document is read from a local JSON file, nothing is fetched; dry by default, --execute writes, a second identical run writes nothing",
})
/** `cli openapi pin --workspace <id> --connection <id> --crm <id> --document <path> [--header <name>] [--live] [--execute]`. */
export class PinOpenApiCli extends CommandRunner {
    constructor(private readonly operator: OpenApiToolsOperatorService) {
        super()
    }

    /**
     * Reads the document file and hands it with the flags and stdout to the operator's pin; without the three required flags it reads
     * nothing. The CRM is `--crm`, never read from the document.
     */
    async run(_passedParams: Array<string>, options: PinOpenApiOptions = {}): Promise<void> {
        const { workspace, connection, crm, document } = options
        if (workspace === undefined || connection === undefined || crm === undefined || document === undefined) {
            process.stdout.write(`${MISSING}\n`)
            return
        }
        const documentText = await readFile(document, "utf8")
        await this.operator.pin(process.stdout, {
            workspaceId: workspace,
            connectionId: connection,
            connector: crmProviderKeyOf(crm),
            swaggerUrl: "",
            workspaceHeader: options.header ?? DEFAULT_HEADER,
            documentText,
            live: options.live === true,
            execute: options.execute,
        })
    }

    /** The workspace. */
    @Option({ flags: "--workspace <id>", description: "The workspace that owns the API account" })
    parseWorkspace(value: string): string {
        return value
    }

    /** The API connection. */
    @Option({ flags: "--connection <id>", description: "The API connection to pin the document on" })
    parseConnection(value: string): string {
        return value
    }

    /** The CRM id. */
    @Option({ flags: "--crm <id>", description: "The CRM id the connection serves (for example nivoweb)" })
    parseCrm(value: string): string {
        return value
    }

    /** The document file. */
    @Option({
        flags: "--document <path>",
        description: "Path of the OpenAPI document, a JSON file the command can read",
    })
    parseDocument(value: string): string {
        return value
    }

    /** The workspace header. */
    @Option({
        flags: "--header <name>",
        description: "The header parameter that carries the workspace id (default X-Workspace-Id)",
    })
    parseHeader(value: string): string {
        return value
    }

    /** Let writes act for real. */
    @Option({ flags: "--live", description: "Let writes act for real (without it every write that can is a dry run)" })
    parseLive(): boolean {
        return true
    }

    /** Write instead of only reporting. */
    @Option({ flags: "--execute", description: "Write the pin (without it the command only reports)" })
    parseExecute(): boolean {
        return true
    }
}
