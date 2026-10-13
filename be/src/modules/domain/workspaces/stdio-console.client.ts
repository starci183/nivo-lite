import { createInterface } from "node:readline/promises"
import type { PruneConsole } from "./workspaces.contracts"

/** The operator's terminal over a pair of streams: lines out, one answered question at a time in. */
export class StdioConsoleClient implements PruneConsole {
    constructor(
        private readonly input: NodeJS.ReadableStream,
        private readonly output: NodeJS.WritableStream,
    ) {}

    /** Writes one line. */
    print(line: string): void {
        this.output.write(`${line}\n`)
    }

    /** Writes the question and answers the line the operator types. */
    async ask(question: string): Promise<string> {
        const lines = createInterface({ input: this.input, output: this.output })
        const answer = await lines.question(question)
        lines.close()
        return answer
    }
}
