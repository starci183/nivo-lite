import { Test } from "@nestjs/testing"
import { builder } from "@starci/jest-preset"
import { Secret } from "@modules/platform/config"
import { MailErrorCode } from "./errors/mail.error"
import { MailClient } from "./mail.client"
import { MAIL_OPTIONS } from "./mail.decorators"
import type { MailOptions } from "./mail.options"

const DEFAULTS: MailOptions = { allowPrivateHosts: false, platform: null, helloName: "nivo.test" }

const build = async (overrides?: Partial<MailOptions>) => {
    const options = builder<MailOptions>(DEFAULTS)(overrides)
    const moduleRef = await Test.createTestingModule({
        providers: [MailClient, { provide: MAIL_OPTIONS, useValue: options }],
    }).compile()
    return moduleRef.get(MailClient)
}

describe("MailClient", () => {
    describe("hasPlatformSender", () => {
        it("tells whether the deployment has a platform sender", async () => {
            expect((await build()).hasPlatformSender()).toBe(false)
            expect(
                (
                    await build({
                        platform: { url: new Secret("smtp://platform"), from: "NIVO <no-reply@nivo.test>" },
                    })
                ).hasPlatformSender(),
            ).toBe(true)
        })
    })

    describe("assertSmtpTarget", () => {
        it("accepts a public address literal on a mail port without a lookup", async () => {
            const client = await build()

            await expect(client.assertSmtpTarget("8.8.8.8", 465)).resolves.toBeUndefined()
        })

        it("refuses a malformed host and a port out of range before any lookup", async () => {
            const client = await build({ allowPrivateHosts: true })

            await expect(client.assertSmtpTarget("bad host", 587)).rejects.toMatchObject({ code: MailErrorCode.Dns })
            await expect(client.assertSmtpTarget("smtp.example.com", 70000)).rejects.toMatchObject({
                code: MailErrorCode.Connect,
            })
        })

        it("lets a development site reach any port without a lookup", async () => {
            const client = await build({ allowPrivateHosts: true })

            await expect(client.assertSmtpTarget("localhost", 1025)).resolves.toBeUndefined()
        })

        it("refuses a port that is not a mail port on a public site", async () => {
            const client = await build()

            await expect(client.assertSmtpTarget("smtp.example.com", 1025)).rejects.toMatchObject({
                code: MailErrorCode.Connect,
            })
        })
    })
})
