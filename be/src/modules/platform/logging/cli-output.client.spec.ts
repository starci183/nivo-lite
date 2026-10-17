import { Test } from "@nestjs/testing"
import { printConsoleLine } from "./cli-output.client"

/** Exposes the terminal adapter as one real provider in the Nest test graph. */
class ConsoleOutputSubject {
    readonly print = printConsoleLine
}

describe("CLI output", () => {
    it("appends one line break to the operator report and writes it once", async () => {
        const moduleRef = await Test.createTestingModule({ providers: [ConsoleOutputSubject] }).compile()
        const output = moduleRef.get(ConsoleOutputSubject)
        const chunks: Array<string> = []
        const write = jest.spyOn(process.stdout, "write").mockImplementation((chunk) => {
            chunks.push(String(chunk))
            return true
        })
        try {
            output.print("workspace ready")
            expect(write).toHaveBeenCalledTimes(1)
            expect(chunks.join("")).toBe("workspace ready\n")
        } finally {
            write.mockRestore()
        }
    })
})
