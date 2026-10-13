import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { ConfigurableModuleClass } from "./connection-commands.module-definition"
import { ConnectionCommandsModule } from "./connection-commands.module"
import { ConnectionCommandsService } from "./connection-commands.service"
import * as publicApi from "./index"

describe("ConnectionCommandsModule", () => {
    it("exports the module and service through the public entry", () => {
        expect(publicApi).toEqual({ ConnectionCommandsModule, ConnectionCommandsService })
    })

    it.each([false, true])("registers and exports the service with isGlobal=%p", async (isGlobal) => {
        const service = mock<ConnectionCommandsService>()
        const base = ConfigurableModuleClass.register({ isGlobal })
        const registration = ConnectionCommandsModule.register({ isGlobal })
        expect(registration).toEqual({
            ...base,
            module: ConnectionCommandsModule,
            providers: [...(base.providers ?? []), ConnectionCommandsService],
            exports: [ConnectionCommandsService],
        })
        expect(registration.global).toBe(isGlobal)

        const moduleRef = await Test.createTestingModule({ imports: [registration] })
            .overrideProvider(ConnectionCommandsService)
            .useValue(service)
            .compile()

        expect(moduleRef.get(ConnectionCommandsService)).toBe(service)
        await moduleRef.close()
    })

    it("defaults to a local registration", async () => {
        const service = mock<ConnectionCommandsService>()
        const registration = ConnectionCommandsModule.register({})
        const moduleRef = await Test.createTestingModule({ imports: [registration] })
            .overrideProvider(ConnectionCommandsService)
            .useValue(service)
            .compile()

        expect(registration.global).toBe(false)
        expect(registration.exports).toEqual([ConnectionCommandsService])
        expect(moduleRef.get(ConnectionCommandsService)).toBe(service)
        await moduleRef.close()
    })

    it("supplies the service when the configurable base supplies no providers", async () => {
        const service = mock<ConnectionCommandsService>()
        const register = jest
            .spyOn(ConfigurableModuleClass, "register")
            .mockReturnValueOnce({ module: ConnectionCommandsModule })

        try {
            const registration = ConnectionCommandsModule.register({})
            expect(register).toHaveBeenCalledWith({})
            expect(registration).toEqual({
                module: ConnectionCommandsModule,
                providers: [ConnectionCommandsService],
                exports: [ConnectionCommandsService],
            })

            const moduleRef = await Test.createTestingModule({ imports: [registration] })
                .overrideProvider(ConnectionCommandsService)
                .useValue(service)
                .compile()

            expect(moduleRef.get(ConnectionCommandsService)).toBe(service)
            await moduleRef.close()
        } finally {
            register.mockRestore()
        }
    })

    it.each([
        "./connection-commands.contracts",
        "./connection-commands.options",
        "./persistence/connection-commands.rows",
    ])("keeps %s as a type-only module", (moduleName) => {
        expect(jest.requireActual<object>(moduleName)).toEqual({})
    })
})
