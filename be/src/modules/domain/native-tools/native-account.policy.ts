import { toolSpecOf } from "@modules/domain/tool-specs"
import { nativeRefusal } from "./native-refusal.policy"

/**
 * The ONE account of a native call that no runner handed an account (ARCH-REVIEW 2026-11-12 S7: never a silent pick): exactly one
 * candidate, that one; several, the refusal `not_selected` (setup: a person or the node chooses); none, `not_connected`. It is the
 * rule of the engine's own caller, a person's read and an `each` read that holds a single account; the candidates are the accounts
 * the caller may use, already narrowed by its rights.
 */
export const soleAccountOf = <T>(candidates: ReadonlyArray<T>): T => {
    const [only, ...more] = candidates
    if (only === undefined) throw nativeRefusal("not_connected")
    if (more.length > 0) throw nativeRefusal("not_selected")
    return only
}

/**
 * True for a tool whose call covers every held account at once (`account: "each"` in the engine's tool specs): the runner hands it
 * no account by design, so an agent's call of it without one is no missing hand. Any other tool of an agent reaches its adapter with
 * the account the runner chose, or with none because it holds none.
 */
export const coversEachAccount = (tool: string): boolean => toolSpecOf(tool)?.account === "each"
