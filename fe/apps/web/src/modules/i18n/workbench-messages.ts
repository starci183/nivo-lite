import agentSdkEn from "@nivo-lite/agent-sdk/client/messages/en.json"
import agentSdkVi from "@nivo-lite/agent-sdk/client/messages/vi.json"
import { blocksMessagesEn, blocksMessagesVi, installed } from "@/modules/plugin-registry"
import type { AbstractIntlMessages } from "next-intl"

/** The namespace of the words the blocks and the renderer say themselves. */
const BLOCKS_NAMESPACE = "blocks"

/**
 * The messages of the generic workbench in one language, to lay over the app's own catalogue: the words of the blocks and of the
 * renderer under `blocks`, and the words of each declared module under its own namespace. Nothing here names a module: a module
 * that a plugin lists under `messages` reaches the catalogue by that one line.
 */
export const workbenchMessages = (locale: string): AbstractIntlMessages => {
    const isEnglish = locale === "en"
    const modules = Object.fromEntries(
        Object.entries(installed.messages).map(([namespace, messages]) => [
            namespace,
            isEnglish ? messages.en : messages.vi,
        ]),
    )
    return {
        ...modules,
        [BLOCKS_NAMESPACE]: isEnglish ? { ...blocksMessagesEn, ...agentSdkEn } : { ...blocksMessagesVi, ...agentSdkVi },
    }
}

/** A catalogue module whose default export is the message tree, as the request config reads it. */
interface CatalogModule {
    /** The message tree. */
    readonly default: AbstractIntlMessages
}

/**
 * The app's own catalogue module of a language with the words of the generic workbench laid over it. The loaded module is read as
 * `unknown`: what is not a message tree adds nothing.
 */
export const catalogWithWorkbench = async (loading: Promise<unknown>, locale: string): Promise<CatalogModule> => {
    const loaded = await loading
    const own = typeof loaded === "object" && loaded !== null && "default" in loaded ? loaded.default : {}
    return { default: { ...(typeof own === "object" ? own : {}), ...workbenchMessages(locale) } }
}
