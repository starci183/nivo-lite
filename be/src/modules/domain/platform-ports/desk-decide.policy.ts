/** The separator of a waiting row's key as the desk read builds it: `<installation>~<row id>`. */
export const DESK_ROW_KEY_SEPARATOR = "~"

/** An id the workspace's records carry: a uuid. */
const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu

/** The installation and the waiting row a verdict is about. */
export interface DeskDecideTarget {
    /** The installation. */
    readonly installation: string
    /** The waiting row (an approval's owner work item). */
    readonly id: string
}

/**
 * The target of a verdict, parsed STRICTLY: the installation and the row are each one id, and a row id that carries the row key
 * (`<installation>~<row id>`, the queue's binding) holds exactly one separator between two ids and names the same installation. Null
 * for anything else (no id, a third part, an empty half, another installation): the verdict is refused and nothing is read.
 */
export const deskDecideTargetOf = (installation: string, id: string): DeskDecideTarget | null => {
    const parts = id.split(DESK_ROW_KEY_SEPARATOR)
    const [keyed, row] = parts.length === 2 ? parts : [installation, parts.length === 1 ? id : ""]
    if (keyed !== installation || row === undefined) return null
    return ID.test(installation) && ID.test(row) ? { installation, id: row } : null
}
