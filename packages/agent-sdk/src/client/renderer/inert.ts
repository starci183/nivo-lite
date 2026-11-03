import type { ActionHandle, ReadHandle } from "../../block/block.types"

/** The handle of an optional read slot a spec left unbound: empty, with nothing to retry. */
export const UNBOUND_READ: ReadHandle = {
    slot: { isEmpty: true },
    retry: () => undefined,
    variables: {},
    setVariables: () => undefined,
    page: null,
}

/** The handle of a read slot whose read is not installed: an error slot, with nothing to retry. */
export const MISSING_READ: ReadHandle = { ...UNBOUND_READ, slot: { isError: true } }

/** The handle of an action slot a spec left unbound or whose action is not installed: not allowed, and running it fails. */
export const UNBOUND_ACTION: ActionHandle = {
    run: () => Promise.resolve({ ok: false, reason: "failed", message: { key: "renderer.unbound" } }),
    isAllowed: false,
    isRunning: false,
    label: "",
}
