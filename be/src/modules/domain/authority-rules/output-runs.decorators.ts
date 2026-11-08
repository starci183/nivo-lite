import { injector, type TypedParameterDecorator } from "@modules/platform/composition"
import type { OutputNodeReader } from "./output-runs.port"

/** Token of the reader of output nodes: absent until the action graph binds one. */
export const OUTPUT_NODE_READER: unique symbol = Symbol("domain.authority-rules.output-node-reader")

/** Injects the reader of output nodes. Parameter type: OutputNodeReader. */
export const InjectOutputNodeReader = (): TypedParameterDecorator<OutputNodeReader> =>
    injector<OutputNodeReader>(OUTPUT_NODE_READER)
