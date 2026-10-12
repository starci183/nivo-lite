import { PassThrough } from "node:stream"
import { StdioConsoleClient } from "./stdio-console.client"

const build = () => {
    const input = new PassThrough()
    const output = new PassThrough()
    const chunks: Array<string> = []
    output.on("data", (chunk: Buffer) => chunks.push(chunk.toString("utf8")))
    return { client: new StdioConsoleClient(input, output), input, written: () => chunks.join("") }
}

describe("StdioConsoleClient", () => {
    it("writes a line", () => {
        const { client, written } = build()

        client.print("KEEP:")

        expect(written()).toBe("KEEP:\n")
    })

    it("writes the question and answers the line that is typed", async () => {
        const { client, input, written } = build()

        const answer = client.ask("Type DELETE: ")
        input.write("DELETE\n")

        await expect(answer).resolves.toBe("DELETE")
        expect(written()).toContain("Type DELETE: ")
    })
})
