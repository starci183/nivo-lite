import { Injectable } from "@nestjs/common"
import type { ModuleProfiles, OptionalAgentText } from "@modules/domain/agents"
import { InjectMessageCatalog } from "@modules/platform/i18n"
import type { Locale, MessageCatalog } from "@modules/platform/i18n"
import { knowledgeFolderOf } from "./knowledge-view.policy"

/** The language the contracts are embedded in, like the rest of the bundle. */
const LOCALE: Locale = "vi"

@Injectable()
/**
 * What the module catalog gives an agent's synced workspace: its knowledge folder and the reply contract it is held to. The chatbot
 * is held to the base customer contract; booking and loyalty add their part; hiring has its own fairness contract; other modules none.
 */
export class ModuleProfilesService implements ModuleProfiles {
    constructor(@InjectMessageCatalog() private readonly catalog: MessageCatalog) {}

    /** The knowledge folder of a module key, or null when the key is not a module. */
    knowledgeFolderOf(module: string): OptionalAgentText {
        return knowledgeFolderOf(module)
    }

    /** The reply contract of the module given the base customer contract. */
    replyContractOf(module: string, base: string): OptionalAgentText {
        if (module === "chatbot") return base
        if (module === "booking") return `${base}\n${this.text("bundle.bookingAddendum")}`
        if (module === "loyalty") return `${base}\n${this.text("bundle.loyaltyContract")}`
        if (module === "hiring") return this.text("bundle.hiringContract")
        return null
    }

    /** The chat-intake clause of a job application the base contract embeds, on its own line. */
    applicationClause(): string {
        return `${this.text("hiring.chat.clause")}\n`
    }

    /** The JSON member of a job application the base contract embeds. */
    applicationShape(): string {
        return this.text("hiring.chat.shape")
    }

    private text(key: string): string {
        return this.catalog.get(key, {}, LOCALE)
    }
}
