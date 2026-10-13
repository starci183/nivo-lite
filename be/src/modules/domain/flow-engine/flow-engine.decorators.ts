import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { SimulatedInputs } from "./flow-engine.contracts"

/** Token of the door the flow engine records a simulated customer input through; the module binds it to the Inbox simulator. */
export const FLOW_SIMULATED_INPUTS: unique symbol = Symbol("domain.flow-engine.simulated-inputs")

/** Injects the simulated-input door. Parameter type: SimulatedInputs. */
export const InjectSimulatedInputs = (): TypedParameterDecorator<SimulatedInputs> =>
    injector<SimulatedInputs>(FLOW_SIMULATED_INPUTS)
