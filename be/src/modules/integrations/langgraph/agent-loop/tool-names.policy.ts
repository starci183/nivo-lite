import { LanggraphError, LanggraphErrorCode } from "../errors/langgraph.error"

/** What a dot of a tool id becomes on the wire, and what becomes a dot again on the way back. */
const WIRE_DOT = "__"

/** The names OpenAI-style chat APIs document as legal for a tool: letters, digits, `_` and `-`, at most 64 characters. */
const WIRE_NAME = /^[a-zA-Z0-9_-]{1,64}$/

/**
 * The wire name of a tool id when the model's profile cannot take a dot: every `.` becomes `__` (`customer.message.send` ->
 * `customer__message__send`). An id has a wire name only when the way back is certain: it holds no `__` of its own, and what comes
 * out is a legal name of at most 64 characters.
 *
 * @param id - The id of an effect or a tool, as NIVO names it everywhere else.
 * @returns The wire name, or null when the id has none.
 */
export const wireNameOf = (id: string): string | null => {
    if (id.includes(WIRE_DOT)) return null
    const wire = id.replaceAll(".", WIRE_DOT)
    return WIRE_NAME.test(wire) ? wire : null
}

/**
 * The id a wire name stands for: every `__` is a dot again. It is the inverse of `wireNameOf` on every id that has a wire name.
 *
 * @param wire - A name as the model wrote it.
 * @returns The id.
 */
export const idOfWireName = (wire: string): string => wire.replaceAll(WIRE_DOT, ".")

/**
 * The wire name of an id that must have one.
 *
 * @param id - The id of an effect or a tool.
 * @returns The wire name.
 * @throws LanggraphError `LANGGRAPH_TOOL_NAME_UNMAPPABLE` (`name`) when the id has none.
 */
const requiredWireNameOf = (id: string): string => {
    const wire = wireNameOf(id)
    if (wire === null) throw new LanggraphError({ code: LanggraphErrorCode.ToolNameUnmappable, params: { name: id } })
    return wire
}

/** The two directions of the names of one run: what the model is shown for an id, and the id a name of the model stands for. */
export interface ToolNames {
    /** The name the model is shown for an id. */
    readonly shown: (id: string) => string
    /** The id a name the model wrote stands for. */
    readonly idOf: (name: string) => string
}

/** The names of a profile that takes dotted names: nothing is changed in either direction. */
const AS_WRITTEN: ToolNames = { shown: (id) => id, idOf: (name) => name }

/**
 * The names of one run. With the map off (the default, and the `work` profile: dotted names are accepted there) every name is sent
 * and read as written. With the map on, each id is shown under its wire name and read back from it; a set with an id that has
 * none (a `__` of its own, or longer than the limit once mapped) is refused by name before any model call, so no tool is ever sent
 * under a name the provider refuses or read back as another id. A name the model made up is read back by the same rule, so the
 * refusal it gets names it with dots.
 *
 * @param ids - The ids of the agent's whole tool set.
 * @param mapped - True when the model's profile needs wire names.
 * @returns Both directions.
 * @throws LanggraphError `LANGGRAPH_TOOL_NAME_UNMAPPABLE` (`name`) when the map is on and an id has no wire name.
 */
export const toolNamesOf = (ids: ReadonlyArray<string>, mapped: boolean): ToolNames => {
    if (!mapped) return AS_WRITTEN
    const wires = new Map(ids.map((id) => [id, requiredWireNameOf(id)] as const))
    const back = new Map([...wires].map(([id, wire]) => [wire, id] as const))
    return {
        shown: (id) => wires.get(id) ?? id,
        idOf: (name) => back.get(name) ?? idOfWireName(name),
    }
}
