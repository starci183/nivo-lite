import { injector, type TypedParameterDecorator } from "@modules/platform/composition"
import type { ConnectionFieldWriter } from "./connection-fields.contracts"

/** Token of the writers the providers registered; absent in an app where none did. */
export const CONNECTION_FIELD_WRITERS: unique symbol = Symbol("domain.connection-fields.writers")

/** Injects the registered writers. Parameter type: ReadonlyArray<ConnectionFieldWriter>. */
export const InjectConnectionFieldWriters = (): TypedParameterDecorator<ReadonlyArray<ConnectionFieldWriter>> =>
    injector<ReadonlyArray<ConnectionFieldWriter>>(CONNECTION_FIELD_WRITERS)
