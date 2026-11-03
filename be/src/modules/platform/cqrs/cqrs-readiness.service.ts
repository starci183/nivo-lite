import { Injectable } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import { ModuleRef } from "@nestjs/core"
import { CqrsModule as NestCqrsModule } from "@nestjs/cqrs"

@Injectable()
/**
 * Says when the command, query and event handlers are registered on their buses. Nest registers them in the bootstrap hook of its CQRS
 * module, and runs the bootstrap hooks of global modules in the order they were added, so nothing in the app's module order can promise
 * that a module has its handlers by the time its own hook runs. This wraps that one hook while the app initialises (every init hook runs
 * before any bootstrap hook), so readiness is exact. Anything that drives handlers from outside a request (the queue consumers) waits for it.
 */
export class CqrsReadinessService implements OnModuleInit {
    private ready = false
    private open!: () => void
    private readonly gate: Promise<void>

    constructor(private readonly moduleRef: ModuleRef) {
        this.gate = new Promise<void>((resolve) => {
            this.open = resolve
        })
    }

    /** Wraps the registration of Nest's CQRS module so that it reports when it is done. */
    onModuleInit(): void {
        const cqrs = this.moduleRef.get(NestCqrsModule, { strict: false })
        const register = cqrs.onApplicationBootstrap.bind(cqrs)
        cqrs.onApplicationBootstrap = (): void => {
            register()
            this.ready = true
            this.open()
        }
    }

    /** True once the handlers are registered. */
    isReady(): boolean {
        return this.ready
    }

    /** Resolves once the handlers are registered. */
    whenReady(): Promise<void> {
        return this.gate
    }
}
