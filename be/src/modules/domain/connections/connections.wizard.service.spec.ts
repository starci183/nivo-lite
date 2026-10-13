import { mockEntityManager } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { Secret } from "@modules/platform/config"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { MODULE_OPTIONS_TOKEN } from "./connections.module-definition"
import { ConnectionsService } from "./connections.service"
import { SETTLE_WIZARD } from "./persistence/connections.sql"

const build = async () => {
    const em = mockEntityManager({ query: [SETTLE_WIZARD, []] })
    const moduleRef = await Test.createTestingModule({
        providers: [
            ConnectionsService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
            {
                provide: MODULE_OPTIONS_TOKEN,
                useValue: {
                    channelTokenKey: new Secret(Buffer.alloc(32, 1).toString("base64")),
                    publicSiteUrl: undefined,
                },
            },
        ],
    }).compile()
    return { service: moduleRef.get(ConnectionsService), em }
}

describe("ConnectionsService", () => {
    describe("settleWizard", () => {
        it("settles a wizard command under its connection and ticket", async () => {
            const { service, em } = await build()

            await expect(
                service.settleWizard("c-1", "ticket-1", {
                    command: "begin",
                    state: "done",
                    url: "https://oauth.zaloapp.com/authorize",
                    code: "",
                    oaSecretSaved: false,
                }),
            ).resolves.toBeUndefined()

            expect(em.query).toHaveBeenCalledWith(SETTLE_WIZARD, [
                "c-1",
                "ticket-1",
                '{"wizard":{"ticket":"ticket-1","command":"begin","state":"done","url":"https://oauth.zaloapp.com/authorize","code":""}}',
            ])
        })

        it("includes the saved OA secret fact in a successful wizard settlement", async () => {
            const { service, em } = await build()

            await expect(
                service.settleWizard("c-1", "ticket-2", {
                    command: "oa",
                    state: "done",
                    url: "",
                    code: "",
                    oaSecretSaved: true,
                }),
            ).resolves.toBeUndefined()

            expect(em.query).toHaveBeenCalledWith(SETTLE_WIZARD, [
                "c-1",
                "ticket-2",
                '{"oa_secret_saved":true,"wizard":{"ticket":"ticket-2","command":"oa","state":"done","url":"","code":""}}',
            ])
        })

        it("records the refusal code in a failed wizard settlement", async () => {
            const { service, em } = await build()

            await expect(
                service.settleWizard("c-1", "ticket-3", {
                    command: "app",
                    state: "failed",
                    url: "",
                    code: "CHANNELS_SECRET_UNREADABLE",
                    oaSecretSaved: false,
                }),
            ).resolves.toBeUndefined()

            expect(em.query).toHaveBeenCalledWith(SETTLE_WIZARD, [
                "c-1",
                "ticket-3",
                '{"wizard":{"ticket":"ticket-3","command":"app","state":"failed","url":"","code":"CHANNELS_SECRET_UNREADABLE"}}',
            ])
        })
    })
})
