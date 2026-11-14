import { createContext, useContext, useMemo, type ReactNode } from "react"
import type { BlockFiles } from "../../block/block.types"
import { FILE_RECORD_SLOT, FILE_WRITE_SLOT, filesVia, type FileBindings } from "../../block/files"
import { useBlockHost } from "../host/WorkbenchHostProvider"

/** The file bindings of the node that is drawn: nothing bound outside a node. */
const NodeFilesContext = createContext<FileBindings>({ read: null, write: null })

/** What the marker takes: the ids a spec bound to the node's slots, by slot name. */
export interface NodeFilesProviderProps {
    /** The id of the read bound to each read slot of the node. */
    readonly reads: Readonly<Record<string, string>>
    /** The id of the action bound to each action slot of the node. */
    readonly actions: Readonly<Record<string, string>>
    readonly children: ReactNode
}

/** Marks the node below with the read and action its spec bound to the file slots, so its file calls are made for them. */
export const NodeFilesProvider = (props: NodeFilesProviderProps): ReactNode => {
    const read = props.reads[FILE_RECORD_SLOT] ?? null
    const write = props.actions[FILE_WRITE_SLOT] ?? null
    const value = useMemo<FileBindings>(() => ({ read, write }), [read, write])
    return <NodeFilesContext.Provider value={value}>{props.children}</NodeFilesContext.Provider>
}

/**
 * The file store as the block of the node being drawn calls it: record and field only, the host's store closed over the read and
 * action the node's spec bound to its file slots. Null when the host has no store behind it.
 */
export const useNodeFiles = (): BlockFiles | null => {
    const store = useBlockHost().files ?? null
    const { read, write } = useContext(NodeFilesContext)
    return useMemo(() => (store === null ? null : filesVia(store, { read, write })), [store, read, write])
}
