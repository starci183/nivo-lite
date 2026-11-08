import { defineEntity, field, type EntityDefinition, type FieldDef } from "@nivo-lite/agent-sdk/entity"

/** The longest IANA time zone name kept (`America/Argentina/ComodRivadavia` is 32). */
const MAX_TIME_ZONE = 64

/** The time zone a workspace starts with. */
export const DEFAULT_TIME_ZONE = "Asia/Ho_Chi_Minh"

type WorkspaceSettingsFields = {
    readonly key: FieldDef<"enum", false>
    readonly timeZone: FieldDef<"text", false>
}

const workspaceSettingsFields: WorkspaceSettingsFields = {
    key: field.enum({ of: ["workspace"], default: { literal: "workspace" } }),
    timeZone: field.text({ maxLength: MAX_TIME_ZONE, default: { literal: DEFAULT_TIME_ZONE } }),
}

/**
 * The settings of a workspace that belong to no module: one record per workspace (the key is the same for every write, so the unique
 * constraint holds the one row). Later workspace-level settings are fields of this record. `timeZone` is the IANA name in which the
 * workspace's day, week and month begin; the back end refuses a name the platform does not know.
 */
export const workspaceSettingsEntity: EntityDefinition<WorkspaceSettingsFields> = defineEntity({
    name: "workspace.settings",
    dataKind: "workspace-settings",
    fields: workspaceSettingsFields,
    indexes: [{ name: "key_id", on: ["key", "id"] }],
    constraints: [{ kind: "unique", name: "workspace_key", on: ["key"], refusal: "settings-exist" }],
})
