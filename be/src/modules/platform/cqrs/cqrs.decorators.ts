import { CommandBus, QueryBus } from "@nestjs/cqrs"
import { injector, type TypedParameterDecorator } from "@modules/platform/composition"
import type { CqrsReadinessService } from "./cqrs-readiness.service"

/** Injects the command bus. Parameter type: CommandBus. */
export const InjectCommandBus = (): TypedParameterDecorator<CommandBus> => injector<CommandBus>(CommandBus)

/** Injects the query bus. Parameter type: QueryBus. */
export const InjectQueryBus = (): TypedParameterDecorator<QueryBus> => injector<QueryBus>(QueryBus)

/** Token of the readiness of the CQRS handlers, exported so a spec can provide it. */
export const CQRS_READINESS: unique symbol = Symbol("platform.cqrs.readiness")

/** Injects the readiness of the CQRS handlers. Parameter type: CqrsReadinessService. */
export const InjectCqrsReadiness = (): TypedParameterDecorator<CqrsReadinessService> =>
    injector<CqrsReadinessService>(CQRS_READINESS)
