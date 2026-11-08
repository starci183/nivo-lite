import { Injectable, type OnModuleInit } from "@nestjs/common"
import type { ModulesContainer } from "@nestjs/core"
import { CqrsModule as NestCqrsModule } from "@nestjs/cqrs"
import { InjectModulesContainer } from "./cqrs-modules.decorators"

/** The hook of Nest's CQRS module that registers the handlers on their buses. */
interface BootstrapHook {
    onApplicationBootstrap(): void
}

const hasBootstrapHook = (value: unknown): value is BootstrapHook =>
    typeof value === "object" &&
    value !== null &&
    "onApplicationBootstrap" in value &&
    typeof value.onApplicationBootstrap === "function"

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

    constructor(@InjectModulesContainer() private readonly modules: ModulesContainer) {
        this.gate = new Promise<void>((resolve) => {
            this.open = resolve
        })
    }

    /** Wraps the registration of Nest's CQRS module so that it reports when it is done; an app without that module has nothing to wait for. */
    onModuleInit(): void {
        const cqrs = this.cqrsHook()
        if (cqrs === undefined) {
            this.ready = true
            this.open()
            return
        }
        const register = cqrs.onApplicationBootstrap.bind(cqrs)
        cqrs.onApplicationBootstrap = (): void => {
            register()
            this.ready = true
            this.open()
        }
    }

    private cqrsHook(): BootstrapHook | undefined {
        for (const module of this.modules.values()) {
            if (module.metatype === NestCqrsModule && hasBootstrapHook(module.instance)) return module.instance
        }
        return undefined
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
