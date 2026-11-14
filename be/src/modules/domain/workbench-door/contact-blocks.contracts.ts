import type { Locale } from "@modules/platform/i18n"

/** What `nivo.api.nivo.contact.block.list` takes: the contact, in the selected workspace and the viewer's language. */
export interface ContactBlocksRequest {
    /** The workspace the request is made in. */
    readonly workspaceId: string
    /** The contact whose detail asks (an id merged into another follows the survivor). */
    readonly contactId: string
    /** The viewer's language: it picks the words of each block's title. */
    readonly locale: Locale
}

/** One block of one agent's module, drawn on the contact detail. */
export interface ContactModuleBlockView {
    /** The block's id within its module. */
    readonly id: string
    /** The block's title in the viewer's language. */
    readonly title: string
    /** The generic block as a spec node (block id, literal props, its slot bound to the module's read with the contact id), as JSON text. */
    readonly nodeJson: string
    /** What the read answered for the contact, `{ rows, cursor }` with the first rows only, as JSON text. */
    readonly dataJson: string
    /** The rows answered. */
    readonly count: number
    /** Whether the contact has rows beyond those answered. */
    readonly hasMore: boolean
}

/** What one installed agent knows about the contact. */
export interface ContactModuleAgentView {
    /** The installation the agent runs as. */
    readonly installationId: string
    /** The agent; null when the installation has none. */
    readonly agentId: string | null
    /** The agent's display name. */
    readonly agentName: string
    /** The key of the agent's module. */
    readonly moduleKey: string
    /** The blocks of its module the member may see. */
    readonly blocks: ReadonlyArray<ContactModuleBlockView>
}
