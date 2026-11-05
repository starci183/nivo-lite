import { createHash } from "node:crypto"
import { registryLinesOf } from "@nivo-lite/agent-sdk/installation"
import { installed } from "./installed"

describe("installed", () => {
    it("holds the hash of what it lists, so a change to a package without `npm run plugins:generate` fails here", () => {
        const hash = createHash("sha256")
            .update(registryLinesOf([installed]).join("\n"))
            .digest("hex")
        expect(installed.registryHash).toBe(hash)
    })

    it("lists every block with a unique id", () => {
        const ids = installed.blocks.map((block) => block.id)
        expect(ids.length).toBeGreaterThan(0)
        expect(new Set(ids).size).toBe(ids.length)
    })
})
