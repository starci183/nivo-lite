import type { ModuleRef } from "@nestjs/core"
import type { CqrsModule as NestCqrsModule } from "@nestjs/cqrs"
import { mock } from "@starci/jest-preset"
import { CqrsReadinessService } from "./cqrs-readiness.service"

const build = () => {
    const registered = jest.fn()
    const cqrs = { onApplicationBootstrap: registered } as unknown as NestCqrsModule
    const moduleRef = mock<ModuleRef>()
    moduleRef.get.mockReturnValue(cqrs)
    const readiness = new CqrsReadinessService(moduleRef)
    return { readiness, cqrs, registered, moduleRef }
}

describe("CqrsReadinessService", () => {
    it("is not ready, and keeps its waiters waiting, until Nest's CQRS module has registered the handlers", async () => {
        const { readiness, cqrs, registered, moduleRef } = build()
        const waited = jest.fn()
        readiness.onModuleInit()
        void readiness.whenReady().then(waited)

        await Promise.resolve()
        expect(moduleRef.get).toHaveBeenCalledWith(expect.anything(), { strict: false })
        expect(readiness.isReady()).toBe(false)
        expect(waited).not.toHaveBeenCalled()

        cqrs.onApplicationBootstrap()
        await readiness.whenReady()

        expect(registered).toHaveBeenCalledTimes(1)
        expect(readiness.isReady()).toBe(true)
        expect(waited).toHaveBeenCalledTimes(1)
    })
})
