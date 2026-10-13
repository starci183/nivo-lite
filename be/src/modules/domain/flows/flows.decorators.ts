import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { FlowGate } from "./flows.contracts"

/** Token of the operating-flow engine the decisions capability binds. */
export const FLOW_GATE: unique symbol = Symbol("domain.flows.gate")

/** Injects the operating-flow engine. Parameter type: FlowGate. */
export const InjectFlowGate = (): TypedParameterDecorator<FlowGate> => injector<FlowGate>(FLOW_GATE)
