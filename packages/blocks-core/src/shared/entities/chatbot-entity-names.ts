/**
 * The record types of the chatbot agent, named `<package>.<agent>.<domain>`: the chatbot's working state on customer conversations
 * (the words of a conversation are the engine's, ruling R26). One constant per type, imported everywhere a type name is needed, so a
 * mismatch is a compile error.
 */

/** One conversation of a customer with the chatbot agent on a channel. */
export const CHATBOT_CHAT_ENTITY = "blocks-core.chatbot.chat"

/** The chatbot agent's own settings (the one record of its holding message). */
export const CHATBOT_SETTINGS_ENTITY = "blocks-core.chatbot.settings"

/** A reply a member typed, until the delivery job hands it to the engine (a job payload carries ids only). */
export const CHATBOT_REPLY_ENTITY = "blocks-core.chatbot.reply"

/** The chatbot's own note on a conversation (a person took it over or gave it back). */
export const CHATBOT_NOTE_ENTITY = "blocks-core.chatbot.note"
