import { PauseClient } from "./pause.client"

describe("PauseClient", () => {
    it("resolves once the time has passed", async () => {
        const client = new PauseClient()

        await expect(client.wait(20)).resolves.toBeUndefined()
    })
})
