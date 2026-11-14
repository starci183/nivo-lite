import { injector, type TypedParameterDecorator } from "@modules/platform/composition"
import type { NivoApiExecutor } from "./nivo-api.contracts"
import type { NivoApiOpGroup } from "./nivo-api-ops.contracts"

/** The token of the executor of the NIVO data ops (`NivoApiExecutor`), provided by the app that serves the endpoint. */
export const NIVO_API_EXECUTOR: unique symbol = Symbol("domain.nivo-api.executor")

/** Injects the executor of the NIVO data ops. Parameter type: NivoApiExecutor. */
export const InjectNivoApiExecutor = (): TypedParameterDecorator<NivoApiExecutor> => injector<NivoApiExecutor>(NIVO_API_EXECUTOR)

/** The token of the op groups the app lists (one per feature that declares NIVO data ops). */
export const NIVO_API_OP_GROUPS: unique symbol = Symbol("domain.nivo-api.op-groups")

/** Injects the op groups the app lists. Parameter type: ReadonlyArray<NivoApiOpGroup>. */
export const InjectNivoApiOpGroups = (): TypedParameterDecorator<ReadonlyArray<NivoApiOpGroup>> =>
    injector<ReadonlyArray<NivoApiOpGroup>>(NIVO_API_OP_GROUPS)
