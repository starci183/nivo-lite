import { PauseClient } from "./pause.client"

describe("PauseClient", () => {
    it("resolves once the time has passed", async () => {
        const client = new PauseClient()
        const resolved = jest.fn()

        await client.wait(20).then(resolved)

        expect(resolved).toHaveBeenCalledTimes(1)
    })
})
