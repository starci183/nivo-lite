import { defineEntity, field, type EntityDefinition, type FieldDef } from "@nivo-lite/agent-sdk/entity"

import { MAX_ID, MAX_LINE } from "../../bounds"
import { CHATBOT_SETTINGS_ENTITY } from "./chatbot-entity-names"

/** The key of the one settings record of a workspace's Chatbot: the record is found, and written, by it. */
export const CHATBOT_SETTINGS_SCOPE = "chatbot"

/** The longest holding message a workspace may save, in characters. */
const MAX_HOLDING = 400

type SettingsFields = {
    readonly scope: FieldDef<"text", false>
    readonly holdingMessage: FieldDef<"text", false>
    readonly updatedBy: FieldDef<"text", true>
}

const settingsFields: SettingsFields = {
    scope: field.text({ maxLength: MAX_ID }),
    holdingMessage: field.text({ maxLength: MAX_HOLDING }),
    updatedBy: field.text({ maxLength: MAX_LINE, nullable: true }),
}

/**
 * The rules of a workspace's Chatbot: what it tells a customer while the AI is still working (up to 400 characters). One record per
 * workspace, found by its `scope` (the module settings pattern: `<package>.<agent>.settings`).
 */
export const chatSettingsEntity: EntityDefinition<SettingsFields> = defineEntity({
    name: CHATBOT_SETTINGS_ENTITY,
    dataKind: "chatbot-settings",
    fields: settingsFields,
    indexes: [
        { name: "key", on: ["id"] },
        { name: "scope", on: ["scope", "id"] },
    ],
    constraints: [{ kind: "unique", name: "scope_key", on: ["scope"], refusal: "settings-exist" }],
})
