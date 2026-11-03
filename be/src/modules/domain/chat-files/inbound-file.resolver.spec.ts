import { lookup } from "node:dns/promises"
import { NodeHostResolver } from "./inbound-file.resolver"

jest.mock("node:dns/promises", () => ({ lookup: jest.fn() }))

const lookupMock = jest.mocked(lookup)

describe("NodeHostResolver", () => {
    it("answers every address of the host as a connection target, in both families", async () => {
        lookupMock.mockResolvedValue([
            { address: "203.0.113.7", family: 4 },
            { address: "2001:db8::7", family: 6 },
        ] as never)

        await expect(new NodeHostResolver().resolve("photo.example.test")).resolves.toEqual([
            { address: "203.0.113.7", family: 4 },
            { address: "2001:db8::7", family: 6 },
        ])
        expect(lookupMock).toHaveBeenCalledWith("photo.example.test", { all: true })
    })

    it("answers nothing for a name that does not resolve", async () => {
        lookupMock.mockRejectedValue(new Error("ENOTFOUND"))

        await expect(new NodeHostResolver().resolve("no-such-host.invalid")).resolves.toEqual([])
    })
})
