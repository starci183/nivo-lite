import { Injectable } from "@nestjs/common"
import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { ConnectionsService, type ConnectionRecord } from "@modules/domain/connections"
import { WorkspaceMembersService, type WorkspaceMember } from "@modules/domain/workspace-members"
import { LOGGER, type Logger } from "@modules/platform/logging"
import { seededRecordOf } from "@tests/fixtures/builders/channel-connections.builder"
import type { ConnectionFieldWriter, ProviderFieldsDeclaration } from "./connection-fields.contracts"
import { CONNECTION_FIELD_WRITERS } from "./connection-fields.decorators"
import { ConnectionFieldsLogEvent } from "./connection-fields.log-events"
import { ConnectionFieldsService } from "./connection-fields.service"
import { ConnectionFieldsErrorCode } from "./errors/connection-fields.error"

const ACTOR = { principalId: "user-1", workspaceId: "ws-1" }

/** A mailbox-like form: one identity and one password sealed in the stored credential. */
const FORM: ProviderFieldsDeclaration = {
    provider: "smtp",
    editableBy: ["owner"],
    canTest: false,
    fields: [
        {
            key: "fromEmail",
            label: { vi: "v", en: "e" },
            kind: "identity",
            required: false,
            maxLength: null,
            choices: [],
            source: { kind: "meta", key: "from_email" },
        },
        {
            key: "password",
            label: { vi: "v", en: "e" },
            kind: "secret",
            required: false,
            maxLength: 50,
            choices: [],
            source: { kind: "none" },
            sealedBy: { kind: "stored-secret" },
        },
    ],
    actions: [
        {
            key: "test_send",
            label: { vi: "v", en: "e" },
            runBy: ["owner"],
            inputs: [{ key: "to", label: { vi: "v", en: "e" }, kind: "text", required: true, maxLength: 254, choices: [], source: { kind: "none" } }],
            results: [
                { key: "to", label: { vi: "v", en: "e" } },
                { key: "isDefault", label: { vi: "v", en: "e" } },
            ],
        },
    ],
}

const RECORD: ConnectionRecord = { ...seededRecordOf("c-1", "smtp", { from_email: "shop@example.test" }), name: "Shop mail" }

/** A member of the given role. */
const memberOf = (role: WorkspaceMember["role"]): WorkspaceMember => ({
    userId: "user-1",
    workspaceId: "ws-1",
    role,
    staffId: null,
    displayName: "Lan",
    status: "active",
})

const build = async (role: WorkspaceMember["role"], provider: ConnectionRecord["provider"] = "smtp") => {
    const members = mock<WorkspaceMembersService>()
    members.require.mockResolvedValue(memberOf(role))
    const connections = mock<ConnectionsService>()
    connections.get.mockResolvedValue({ ...RECORD, provider })
    connections.hasSecret.mockResolvedValue(true)
    const writer = mock<Required<ConnectionFieldWriter>>()
    Object.assign(writer, { declarations: [FORM] })
    const logger = mock<Logger>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            ConnectionFieldsService,
            { provide: LOGGER, useValue: logger },
            { provide: WorkspaceMembersService, useValue: members },
            { provide: ConnectionsService, useValue: connections },
            { provide: CONNECTION_FIELD_WRITERS, useValue: [writer] },
        ],
    }).compile()
    return { service: moduleRef.get(ConnectionFieldsService), members, connections, writer, logger }
}

describe("ConnectionFieldsService, the read", () => {
    it("shows any member the form: public values, the password only as sealed, nothing editable for staff", async () => {
        const { service, members, connections } = await build("staff")

        const view = await service.fieldsOf(ACTOR, "c-1")

        expect(members.require).toHaveBeenCalledWith("user-1", "ws-1")
        expect(connections.get).toHaveBeenCalledWith("ws-1", "c-1")
        expect(view).toMatchObject({ connectionId: "c-1", provider: "smtp", displayName: "Shop mail", canEdit: false, writable: true })
        expect(view.fields.map((field) => [field.key, field.value, field.sealed, field.editable])).toEqual([
            ["fromEmail", "shop@example.test", null, false],
            ["password", null, true, false],
        ])
        expect(connections.readSecret).not.toHaveBeenCalled()
    })

    it("answers a provider with no writer read-only, with no field", async () => {
        const { service } = await build("owner", "imap")

        await expect(service.fieldsOf(ACTOR, "c-1")).resolves.toMatchObject({ writable: false, canEdit: false, canTest: false, fields: [] })
    })
})

describe("ConnectionFieldsService, the change", () => {
    it("hands a checked change to the writer of the provider and logs the keys, never a value", async () => {
        const { service, writer, logger } = await build("owner")

        await service.update(ACTOR, "c-1", "Shop sender", [{ key: "password", value: "new-pass" }])

        expect(writer.write).toHaveBeenCalledWith(ACTOR, expect.objectContaining({ id: "c-1" }), {
            displayName: "Shop sender",
            values: { password: "new-pass" },
        })
        expect(logger.info).toHaveBeenCalledWith(ConnectionFieldsLogEvent.Updated, {
            workspaceId: "ws-1",
            connectionId: "c-1",
            provider: "smtp",
            keys: ["password"],
            renamed: true,
        })
        expect(JSON.stringify(logger.info.mock.calls)).not.toContain("new-pass")
    })

    it("writes nothing for an empty secret and the same name", async () => {
        const { service, writer } = await build("owner")

        await service.update(ACTOR, "c-1", "Shop mail", [{ key: "password", value: "" }])

        expect(writer.write).not.toHaveBeenCalled()
    })

    it("refuses a role the provider does not admit, a provider with no writer, and a field the form refuses", async () => {
        await expect((await build("manager")).service.update(ACTOR, "c-1", "X", [])).rejects.toMatchObject({
            code: ConnectionFieldsErrorCode.Forbidden,
        })
        await expect((await build("owner", "imap")).service.update(ACTOR, "c-1", "X", [])).rejects.toMatchObject({
            code: ConnectionFieldsErrorCode.NotWritable,
        })
        const { service, writer } = await build("owner")
        await expect(service.update(ACTOR, "c-1", null, [{ key: "fromEmail", value: "x@y.test" }])).rejects.toMatchObject({
            code: ConnectionFieldsErrorCode.FieldReadOnly,
        })
        expect(writer.write).not.toHaveBeenCalled()
    })
})

describe("ConnectionFieldsService, nothing written on a refusal", () => {
    it("checks the provider's own rules on the whole change BEFORE the first write: a refused value writes neither the secret nor the name", async () => {
        const { service, writer } = await build("owner")
        writer.check.mockReturnValue([{ key: "password", reason: "not_a_password" }])

        await expect(service.update(ACTOR, "c-1", "Shop sender", [{ key: "password", value: "new-pass" }])).rejects.toMatchObject({
            code: ConnectionFieldsErrorCode.FieldInvalid,
            params: { key: "password", reason: "not_a_password" },
        })
        expect(writer.check).toHaveBeenCalledWith(expect.objectContaining({ id: "c-1" }), { displayName: "Shop sender", values: { password: "new-pass" } })
        expect(writer.write).not.toHaveBeenCalled()
    })
})

describe("ConnectionFieldsService, the actions", () => {
    it("runs a declared action through the writer of the provider with its checked inputs, and answers its result members and the form", async () => {
        const { service, writer, logger } = await build("owner")
        writer.run.mockResolvedValue({ to: "a@b.test", isDefault: "true" })

        const result = await service.runAction(ACTOR, "c-1", "test_send", [{ key: "to", value: " a@b.test " }])

        expect(writer.run).toHaveBeenCalledWith(ACTOR, expect.objectContaining({ id: "c-1" }), "test_send", { to: "a@b.test" })
        expect(result.results.map((member) => [member.key, member.value])).toEqual([
            ["to", "a@b.test"],
            ["isDefault", "true"],
        ])
        expect(result.form.actions.map((action) => [action.key, action.canRun])).toEqual([["test_send", true]])
        expect(logger.info).toHaveBeenCalledWith(ConnectionFieldsLogEvent.ActionRun, expect.objectContaining({ action: "test_send", keys: ["to"] }))
    })

    it("refuses an undeclared action, a role it does not admit and a missing input, without running anything", async () => {
        const owner = await build("owner")
        await expect(owner.service.runAction(ACTOR, "c-1", "rotate", [])).rejects.toMatchObject({ code: ConnectionFieldsErrorCode.ActionUnknown })
        await expect(owner.service.runAction(ACTOR, "c-1", "test_send", [])).rejects.toMatchObject({ code: ConnectionFieldsErrorCode.FieldRequired })
        const staff = await build("staff")
        await expect(staff.service.runAction(ACTOR, "c-1", "test_send", [{ key: "to", value: "a@b.test" }])).rejects.toMatchObject({
            code: ConnectionFieldsErrorCode.Forbidden,
        })
        expect(owner.writer.run).not.toHaveBeenCalled()
        expect(staff.writer.run).not.toHaveBeenCalled()
    })
})

describe("ConnectionFieldsService, never a secret on a page", () => {
    it("drops a secret key a writer wrongly answers from an action, and logs it without the value", async () => {
        const { service, writer, logger } = await build("owner")
        writer.run.mockResolvedValue({ to: "a@b.test", isDefault: "true", password: "leaked-value" })

        const result = await service.runAction(ACTOR, "c-1", "test_send", [{ key: "to", value: "a@b.test" }])

        expect(JSON.stringify(result)).not.toContain("leaked-value")
        expect(logger.error).toHaveBeenCalledWith(ConnectionFieldsLogEvent.SecretAnswerDropped, null, {
            provider: "smtp",
            action: "test_send",
            keys: ["password"],
        })
        expect(JSON.stringify(logger.error.mock.calls)).not.toContain("leaked-value")
    })

})

/** A secret the bad form below declares readable, with the value a stored fact would hold. */
const STORED = "stored-value"

/** A form that could put a secret on a page: its password declares a readable source. */
const LEAKY: ProviderFieldsDeclaration = {
    ...FORM,
    fields: FORM.fields.map((field) => (field.kind === "secret" ? { ...field, source: { kind: "meta", key: "password" } } : field)),
}

@Injectable()
/** A plugin's writer that ships the bad form. */
class LeakyWriter implements ConnectionFieldWriter {
    readonly declarations = [LEAKY]
    readonly write = jest.fn(() => Promise.resolve())
}

@Injectable()
/** Another provider's writer, fit. */
class FitWriter implements ConnectionFieldWriter {
    readonly declarations = [{ ...FORM, provider: "zalo_oa" }]
    readonly write = jest.fn(() => Promise.resolve())
}

/** Boots the service with both writers, as the app registers them, over doubles of the global capabilities. */
const boot = async () => {
    const logger = mock<Logger>()
    const members = mock<WorkspaceMembersService>()
    members.require.mockResolvedValue(memberOf("owner"))
    const connections = mock<ConnectionsService>()
    connections.hasSecret.mockResolvedValue(true)

    const app = await Test.createTestingModule({
        providers: [
            ConnectionFieldsService,
            { provide: LOGGER, useValue: logger },
            { provide: WorkspaceMembersService, useValue: members },
            { provide: ConnectionsService, useValue: connections },
            { provide: CONNECTION_FIELD_WRITERS, useValue: [new LeakyWriter(), new FitWriter()] },
        ],
    }).compile()
    await app.init()
    return { service: app.get(ConnectionFieldsService), logger, connections }
}

describe("ConnectionFieldsService, a bad declaration at run time", () => {
    it("still boots: the bad provider is disabled with one error event, and another provider serves its form", async () => {
        const { service, logger, connections } = await boot()

        expect(logger.error.mock.calls).toEqual([
            [ConnectionFieldsLogEvent.DeclarationRefused, null, { provider: "smtp", codes: ["secret_source_readable"] }],
        ])
        connections.get.mockResolvedValueOnce({ ...RECORD, meta: { ...RECORD.meta, password: STORED } })
        await expect(service.fieldsOf(ACTOR, "c-1")).rejects.toMatchObject({
            code: ConnectionFieldsErrorCode.DeclarationInvalid,
            params: { provider: "smtp", codes: "secret_source_readable" },
        })
        connections.get.mockResolvedValueOnce({ ...RECORD, provider: "zalo_oa" })
        await expect(service.fieldsOf(ACTOR, "c-1")).resolves.toMatchObject({ provider: "zalo_oa", writable: true })
        expect(JSON.stringify(logger.error.mock.calls)).not.toContain(STORED)
    })

    it("refuses a change and an action of the disabled provider before any write", async () => {
        const { service, connections } = await boot()
        connections.get.mockResolvedValue(RECORD)

        await expect(service.update(ACTOR, "c-1", "X", [])).rejects.toMatchObject({ code: ConnectionFieldsErrorCode.DeclarationInvalid })
        await expect(service.runAction(ACTOR, "c-1", "test_send", [])).rejects.toMatchObject({
            code: ConnectionFieldsErrorCode.DeclarationInvalid,
        })
    })
})
