import { catalogueCopyOf, type CatalogueCopy } from "../../../shared/agent/catalogue-copy"
import * as en from "./messages/en.json"
import * as vi from "./messages/vi.json"

/** A key of the chatbot template's own message catalogue. */
export type ChatbotCopyKey = Exclude<keyof typeof vi, "default">

/** The words of the chatbot template, read from its own message catalogue. */
export const CHATBOT_COPY: CatalogueCopy<ChatbotCopyKey> = catalogueCopyOf<ChatbotCopyKey>(vi, en)
