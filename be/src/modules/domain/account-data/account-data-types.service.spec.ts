import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { LOGGER, type Logger } from "@modules/platform/logging"
import type { AccountDataTypeDef } from "./account-data.contracts"
import { AccountDataLogEvent } from "./account-data.log-events"
import { ACCOUNT_DATA_OPTIONS } from "./account-data.port"
import { AccountDataTypesService } from "./account-data-types.service"
import { AccountDataErrorCode } from "./errors/account-data.error"

/** What a call threw, or undefined when it threw nothing. */
const thrownBy = (run: () => unknown): unknown => {
    try {
        run()
        return undefined
    } catch (error) {
        return error
    }
}

const update: AccountDataTypeDef = {
    name: "telegram.update",
    provider: "telegram",
    version: 1,
    write: "append",
    fields: { updateId: { type: "text", required: true }, raw: { type: "json", required: true } },
    key: ["updateId"],
    wakes: true,
    retention: { days: 30 },
}
const snapshot: AccountDataTypeDef = {
    name: "interface.snapshot",
    provider: null,
    version: 1,
    write: "overwrite",
    fields: { verb: { type: "text", required: true } },
    key: ["verb"],
    ttlMs: 60_000,
    retention: "keep",
}

const build = async (types: ReadonlyArray<AccountDataTypeDef>) => {
    const logger = mock<Logger>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            AccountDataTypesService,
            { provide: ACCOUNT_DATA_OPTIONS, useValue: { types } },
            { provide: LOGGER, useValue: logger },
        ],
    }).compile()
    return { types: moduleRef.get(AccountDataTypesService), logger }
}

describe("AccountDataTypesService", () => {
    it("holds the declarations by name and lists them in name order", async () => {
        const { types } = await build([update, snapshot])

        expect(types.of("telegram.update")).toBe(update)
        expect(types.of("telegram.nope")).toBeNull()
        expect(types.all().map((def) => def.name)).toEqual(["interface.snapshot", "telegram.update"])
    })

    it("refuses a name declared twice at boot, with a clear error", async () => {
        await expect(build([update, { ...update }])).rejects.toMatchObject({
            code: AccountDataErrorCode.TypeInvalid,
            params: { type: "telegram.update", problems: "name: declared twice in the catalog" },
        })
    })

    it("refuses at boot a declaration that skipped defineAccountDataType and breaks its rules", async () => {
        await expect(build([{ ...update, name: "bad" }])).rejects.toMatchObject({
            code: AccountDataErrorCode.TypeInvalid,
        })
    })

    it("answers a declared type of the provider, or of any provider when it names none", async () => {
        const { types } = await build([update, snapshot])

        expect(types.declared("telegram.update", "telegram")).toBe(update)
        expect(types.declared("interface.snapshot", "zalo_oa")).toBe(snapshot)
        expect(types.declared("telegram.update")).toBe(update)
    })

    it("refuses and logs an undeclared type and another provider's type, with type and provider only", async () => {
        const { types, logger } = await build([update])

        expect(thrownBy(() => types.declared("telegram.nope", "telegram"))).toMatchObject({
            code: AccountDataErrorCode.TypeUndeclared,
            params: { type: "telegram.nope", provider: "telegram" },
        })
        expect(thrownBy(() => types.declared("telegram.update", "zalo_oa"))).toMatchObject({
            code: AccountDataErrorCode.TypeUndeclared,
        })
        expect(logger.error).toHaveBeenCalledWith(AccountDataLogEvent.WiringRefused, expect.anything(), {
            type: "telegram.update",
            provider: "zalo_oa",
        })
    })

    it("refuses and logs a type written another way than asked", async () => {
        const { types, logger } = await build([update])

        expect(types.declaredAs("telegram.update", ["append"])).toBe(update)
        expect(thrownBy(() => types.declaredAs("telegram.update", ["advance"]))).toMatchObject({
            code: AccountDataErrorCode.WriteMode,
            params: { type: "telegram.update", provider: "telegram" },
        })
        expect(logger.error).toHaveBeenCalledWith(AccountDataLogEvent.WiringRefused, expect.anything(), {
            type: "telegram.update",
            provider: "telegram",
        })
    })

    it("carries an empty provider for a type that names none", async () => {
        const { types } = await build([snapshot])

        expect(types.wiring(AccountDataErrorCode.WriteMode, "interface.snapshot", "").params).toEqual({
            type: "interface.snapshot",
            provider: "",
        })
    })
})
