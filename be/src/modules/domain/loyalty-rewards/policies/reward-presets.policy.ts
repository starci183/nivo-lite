import type { MessageCatalog } from "@modules/platform/i18n"
import type { RewardEdit } from "../loyalty-rewards.contracts"
import { REWARD_PRESETS } from "../loyalty-rewards.templates"

const STORED_LOCALE = "vi"

/** Resolves the starter catalogue wording in the locale used for stored customer-facing programme content. */
export const rewardPresetEdits = (messages: MessageCatalog): ReadonlyArray<RewardEdit> =>
    REWARD_PRESETS.map(({ nameKey, noteKey, ...reward }): RewardEdit => ({
        ...reward,
        name: messages.get(nameKey, {}, STORED_LOCALE),
        note: messages.get(noteKey, {}, STORED_LOCALE),
    }))
