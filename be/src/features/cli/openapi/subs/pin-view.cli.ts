import { CommandRunner, Option, SubCommand } from "nest-commander"
import { OpenApiToolsOperatorService } from "@modules/domain/data-hub"

/** What the command prints when a required flag is missing. */
const MISSING = "openapi pin-view: --workspace <id> and --connection <id> are required; nothing read"

/** What `pin-view` reads from its flags. */
export interface PinViewOpenApiOptions {
    /** The workspace. */
    readonly workspace?: string
    /** The API connection. */
    readonly connection?: string
}

@SubCommand({
    name: "pin-view",
    description:
        "Show what an API account of a workspace serves as tools now: the source key, the sha256 of its pinned document, each declared tool by id with its state, effect mark, whether it is asked for and who may call it, then each operation no plugin declares by the tool id it would have; reads only",
})
/** `cli openapi pin-view --workspace <id> --connection <id>`: hands the flags and stdout to the operator's view. */
export class PinViewOpenApiCli extends CommandRunner {
    constructor(private readonly operator: OpenApiToolsOperatorService) {
        super()
    }

    /** Prints the pin of the account; without both flags it reads nothing. */
    async run(_passedParams: Array<string>, options: PinViewOpenApiOptions = {}): Promise<void> {
        if (options.workspace === undefined || options.connection === undefined) {
            process.stdout.write(`${MISSING}\n`)
            return
        }
        await this.operator.view(process.stdout, { workspaceId: options.workspace, connectionId: options.connection })
    }

    /** The workspace. */
    @Option({ flags: "--workspace <id>", description: "The workspace that owns the API account" })
    parseWorkspace(value: string): string {
        return value
    }

    /** The API connection. */
    @Option({ flags: "--connection <id>", description: "The API connection whose pin is shown" })
    parseConnection(value: string): string {
        return value
    }
}
