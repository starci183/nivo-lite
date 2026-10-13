import type { OptionalConnectionName } from "./connections.contracts"

const MAX_NAME = 60
const MIN_NAME = 2

/** The trimmed name cut to 60 characters, or null when fewer than two remain. */
export const cleanConnectionName = (name: string): OptionalConnectionName => {
    const cleaned = name.trim().slice(0, MAX_NAME)
    return cleaned.length < MIN_NAME ? null : cleaned
}
