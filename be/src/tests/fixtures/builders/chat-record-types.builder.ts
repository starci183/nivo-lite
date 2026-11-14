import { INSTALLED } from "@modules/domain/installed-plugins"

/** The record type installed for a data kind: the engine never names the chatbot's record types, a test reads them from the installation. */
const recordTypeOf = (dataKind: string): string => {
    const found = INSTALLED.entities().find((entity) => entity.dataKind === dataKind)
    if (found === undefined) throw new Error(`no installed record type of the data kind ${dataKind}`)
    return found.name
}

/** The installed record type of a customer conversation. */
export const CHAT_ENTITY: string = recordTypeOf("conversation")

/** The installed record type of one line of a conversation. */
export const MESSAGE_ENTITY: string = recordTypeOf("message")
