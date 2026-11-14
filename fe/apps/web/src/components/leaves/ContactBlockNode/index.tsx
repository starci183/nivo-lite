import { AnsweredNode } from "@nivo-lite/agent-sdk/client"
import { installed } from "@/modules/plugin-registry"
import { CardScopeProvider } from "@/modules/plugin-registry/client"

/** What the leaf draws: one block of an agent's module, with the answer its read already gave for the person. */
interface ContactBlockNodeProps {
    /** The module whose declaration holds the read and the words of the block. */
    readonly moduleKey: string
    readonly installationId: string
    /** The spec node the back end drew for this person, as JSON text. */
    readonly nodeJson: string
    /** What the node's read answered, as JSON text. */
    readonly dataJson: string
    /** The answer is still being read: the block's place keeps its rows as geometry. */
    readonly isLoading: boolean
}

/**
 * One block an agent's module mounts on a person, drawn by the block host of the workbench (the same renderers, reads and words as the
 * module's own workbench) as rows inside the card the contact detail already draws. The back end ran the read for this person and the
 * viewer's rights; the block takes its rows from that answer, so nothing is requested twice.
 */
export const ContactBlockNode = (props: ContactBlockNodeProps) => (
    <CardScopeProvider>
        <AnsweredNode
            module={installed.modules.find((declaration) => declaration.key === props.moduleKey) ?? null}
            installationId={props.installationId}
            nodeJson={props.nodeJson}
            dataJson={props.dataJson}
            isWaiting={props.isLoading}
        />
    </CardScopeProvider>
)
