import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { declarationProblems } from "@modules/domain/connection-fields"
import { ConnectionsService } from "@modules/domain/connections"
import { seededRecordOf } from "@tests/fixtures/builders/channel-connections.builder"
import { SmtpConnectionFieldsService } from "./smtp-connection-fields.service"
import { SmtpWizardService } from "./smtp-wizard.service"

const ACTOR = { principalId: "user-1", workspaceId: "ws-1" }
const SENDER = seededRecordOf("c-1", "smtp", { from_email: "shop@example.test", host: "smtp.example.test", user: "shop" })

const build = async () => {
    const wizard = mock<SmtpWizardService>()
    const connections = mock<ConnectionsService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            SmtpConnectionFieldsService,
            { provide: SmtpWizardService, useValue: wizard },
            { provide: ConnectionsService, useValue: connections },
        ],
    }).compile()
    return { writer: moduleRef.get(SmtpConnectionFieldsService), wizard, connections }
}

describe("SmtpConnectionFieldsService", () => {
    it("declares the address, server and user as shown, and the password as write-only, sealed in the stored credential", async () => {
        const { writer } = await build()
        const [form] = writer.declarations

        expect(form).toMatchObject({ provider: "smtp", editableBy: ["owner"], canTest: false })
        expect(form?.fields.map((field) => [field.key, field.kind, field.source])).toEqual([
            ["fromEmail", "identity", { kind: "meta", key: "from_email" }],
            ["host", "identity", { kind: "meta", key: "host" }],
            ["user", "identity", { kind: "meta", key: "user" }],
            ["password", "secret", { kind: "none" }],
        ])
    })

    it("replaces the password through the wizard and renames through the connections capability", async () => {
        const { writer, wizard, connections } = await build()

        await writer.write(ACTOR, SENDER, { displayName: null, values: { password: "new-pass" } })
        await writer.write(ACTOR, SENDER, { displayName: "Shop mail", values: {} })

        expect(wizard.changePassword.mock.calls).toEqual([[ACTOR, "c-1", "new-pass"]])
        expect(connections.rename.mock.calls).toEqual([[ACTOR, "c-1", "Shop mail"]])
    })

    it("declares a test send and a make-default action, run by the owner, through the wizard's own service", async () => {
        const { writer, wizard } = await build()
        wizard.sendTest.mockResolvedValue({ to: "a@b.test", isDefault: true })

        expect(writer.declarations[0]?.actions?.map((action) => [action.key, action.runBy, action.inputs.map((input) => input.key)])).toEqual([
            ["test_send", ["owner"], ["to"]],
            ["set_default", ["owner"], []],
        ])
        await expect(writer.run(ACTOR, SENDER, "test_send", { to: "a@b.test" })).resolves.toEqual({ to: "a@b.test", isDefault: "true" })
        await expect(writer.run(ACTOR, SENDER, "set_default", {})).resolves.toEqual({})
        expect(wizard.sendTest).toHaveBeenCalledWith(ACTOR, { connectionId: "c-1", to: "a@b.test", makeDefault: false })
        expect(wizard.setDefault).toHaveBeenCalledWith(ACTOR, "c-1")
    })
})

describe("the secret check of the SMTP form", () => {
    it("registers: no secret has a readable source and no action answers a secret", async () => {
        const { writer } = await build()

        expect(writer.declarations.flatMap((declaration) => declarationProblems(declaration))).toEqual([])
    })
})
