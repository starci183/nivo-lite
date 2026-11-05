import { Test } from "@nestjs/testing"
import { ModulesContainer } from "@nestjs/core"
import { CqrsModule as NestCqrsModule } from "@nestjs/cqrs"
import { mock } from "@starci/jest-preset"
import { CqrsReadinessService } from "./cqrs-readiness.service"

const build = async (hosted: boolean) => {
    const registered = jest.fn()
    const cqrs = { onApplicationBootstrap: registered }
    const modules = mock<ModulesContainer>({
        values: jest.fn().mockReturnValue(
            hosted
                ? [
                      { metatype: class OtherModule {}, instance: {} },
                      { metatype: NestCqrsModule, instance: cqrs },
                  ]
                : [{ metatype: class OtherModule {}, instance: {} }],
        ),
    })
    const moduleRef = await Test.createTestingModule({
        providers: [CqrsReadinessService, { provide: ModulesContainer, useValue: modules }],
    }).compile()
    return { readiness: moduleRef.get(CqrsReadinessService), cqrs, registered }
}

describe("CqrsReadinessService", () => {
    it("is not ready, and keeps its waiters waiting, until Nest's CQRS module has registered the handlers", async () => {
        const { readiness, cqrs, registered } = await build(true)
        const waited = jest.fn()
        readiness.onModuleInit()
        void readiness.whenReady().then(waited)

        await Promise.resolve()
        expect(readiness.isReady()).toBe(false)
        expect(waited).not.toHaveBeenCalled()

        cqrs.onApplicationBootstrap()
        await readiness.whenReady()

        expect(registered).toHaveBeenCalledTimes(1)
        expect(readiness.isReady()).toBe(true)
        expect(waited).toHaveBeenCalledTimes(1)
    })

    it("is ready at once in an app that holds no CQRS module, because no handlers are coming", async () => {
        const { readiness } = await build(false)

        readiness.onModuleInit()
        await readiness.whenReady()

        expect(readiness.isReady()).toBe(true)
    })
})
