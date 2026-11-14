import { join } from "node:path"
import { Injectable } from "@nestjs/common"
import type { GraphFolderReader, ResetWorkflowsCommand } from "./workflow-reset-command.contracts"
import { WorkflowResetService } from "./workflow-reset.service"

@Injectable()
/**
 * `cli reset-workflows`: reads every `.json` graph of the folder, in name order, into the envelope the stack seed step writes, and hands
 * it to the reset, which keeps agents and every other record. A folder that is missing and a file that is not JSON fail before the
 * reset is asked anything.
 */
export class WorkflowResetCommandService {
    constructor(private readonly reset: WorkflowResetService) {}

    /** Reads the graphs of the folder, in name order, and runs the reset (a dry run only counts). */
    async run(command: ResetWorkflowsCommand, files: GraphFolderReader): Promise<void> {
        const names = (await files.readdir(command.graphs)).filter((name) => name.endsWith(".json")).toSorted()
        const documents = await Promise.all(
            names.map(async (name) => {
                const document: unknown = JSON.parse(await files.readFile(join(command.graphs, name), "utf8"))
                return { document }
            }),
        )
        const text = JSON.stringify({ documents })
        if (command.dryRun === true) await this.reset.run(text, command.workspace, { dryRun: true })
        else await this.reset.run(text, command.workspace)
    }
}
