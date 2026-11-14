import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { declarationProblems } from "@modules/domain/connection-fields"
import type { ConnectionRecord } from "@modules/domain/connections"
import { seededRecordOf } from "@tests/fixtures/builders/channel-connections.builder"
import { ChannelConnectionsService } from "./channel-connections.service"
import { MoneyConnectionFieldsService } from "./money-connection-fields.service"

const ACTOR = { principalId: "user-1", workspaceId: "ws-1" }

const SEPAY: ConnectionRecord = {
    ...seededRecordOf("c-1", "sepay", { bank_code: "VCB", account_holder: "NGUYEN VAN A", account_masked: "**** 4567" }),
    name: "Vietcombank 4567",
    environment: "test",
}

const build = async () => {
    const channels = mock<ChannelConnectionsService>()
    const moduleRef = await Test.createTestingModule({
        providers: [MoneyConnectionFieldsService, { provide: ChannelConnectionsService, useValue: channels }],
    }).compile()
    return { writer: moduleRef.get(MoneyConnectionFieldsService), channels }
}

describe("MoneyConnectionFieldsService", () => {
    it("declares SePay with its bank account, test or live and a write-only key; Casso its bank account; payOS only its name", async () => {
        const { writer } = await build()

        expect(writer.declarations.map((form) => [form.provider, form.editableBy, form.fields.map((field) => `${field.key}:${field.kind}`)])).toEqual([
            ["sepay", ["owner"], ["webhookUrl:identity", "bankCode:choice", "accountNumber:text", "holder:text", "environment:choice", "apiKey:secret"]],
            ["casso", ["owner"], ["bankCode:choice", "accountNumber:text", "holder:text"]],
            ["payos", ["owner"], []],
        ])
    })

    it("offers the listed banks as a searchable picker, and asks before going live", async () => {
        const { writer } = await build()
        const fields = writer.declarations[0]?.fields ?? []
        const bank = fields.find((field) => field.key === "bankCode")
        const environment = fields.find((field) => field.key === "environment")

        expect(bank).toMatchObject({ choiceSource: "banks", searchable: true })
        expect(bank?.choices.map((choice) => choice.value)).toContain("VCB")
        expect(environment?.choices.map((choice) => [choice.value, choice.confirm?.key ?? null])).toEqual([
            ["test", null],
            ["live", "sepayConnection.liveConfirmBody"],
        ])
    })

    it("refuses before any write what the feed's own edit would refuse: an account number of no 6 to 20 digits, a malformed key", async () => {
        const { writer, channels } = await build()

        expect(writer.check(SEPAY, { displayName: null, values: { accountNumber: "12 34", apiKey: "short" } })).toEqual([
            { key: "accountNumber", reason: "not_an_account_number" },
            { key: "apiKey", reason: "not_a_key" },
        ])
        expect(writer.check(SEPAY, { displayName: null, values: { accountNumber: "0123 456 789", apiKey: "k".repeat(20) } })).toEqual([])
        expect(channels.updateMoneyConnection).not.toHaveBeenCalled()
    })

    it("hands a change to the feed's own edit, keeping every stored value the change leaves out", async () => {
        const { writer, channels } = await build()

        await writer.write(ACTOR, SEPAY, { displayName: null, values: { environment: "live", apiKey: "k".repeat(20) } })
        await writer.write(ACTOR, SEPAY, { displayName: "ACB 9999", values: { holder: "TRAN B" } })

        expect(channels.updateMoneyConnection.mock.calls).toEqual([
            [
                ACTOR,
                "c-1",
                { environment: "live", name: "Vietcombank 4567", bankCode: "VCB", accountNumber: "", holder: "NGUYEN VAN A", apiKey: "k".repeat(20) },
            ],
            [ACTOR, "c-1", { environment: "test", name: "ACB 9999", bankCode: "VCB", accountNumber: "", holder: "TRAN B", apiKey: undefined }],
        ])
    })
})

describe("the secret check of the SePay, Casso and payOS form", () => {
    it("registers: no secret has a readable source and no action answers a secret", async () => {
        const { writer } = await build()

        expect(writer.declarations.flatMap((declaration) => declarationProblems(declaration))).toEqual([])
    })
})
