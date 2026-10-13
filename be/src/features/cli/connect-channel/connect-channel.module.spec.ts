import { MODULE_METADATA } from "@nestjs/common/constants"
import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { ConnectChannelCli } from "./connect-channel.cli"
import { ConnectChannelModule } from "./connect-channel.module"

describe("ConnectChannelModule", () => {
    it("provides the connect-channel command", async () => {
        const command = mock<ConnectChannelCli>()
        expect(Reflect.getMetadata(MODULE_METADATA.PROVIDERS, ConnectChannelModule)).toEqual([ConnectChannelCli])

        const moduleRef = await Test.createTestingModule({ imports: [ConnectChannelModule] })
            .overrideProvider(ConnectChannelCli)
            .useValue(command)
            .compile()

        expect(moduleRef.get(ConnectChannelModule)).toBeInstanceOf(ConnectChannelModule)
        expect(moduleRef.get(ConnectChannelCli)).toBe(command)
        await moduleRef.close()
    })
})
