import type { FlowPayload } from "../flows.contracts"

/** The inputs of a command as a record, copied so the engine owns what it reads. */
export const payloadOf = (payload: object): FlowPayload => Object.fromEntries(Object.entries(payload))
