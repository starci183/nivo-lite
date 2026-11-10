import type { PictureChoiceKey } from "@/modules/agentAvatar"
import type { ModuleKey } from "@/modules/catalog"

/** The address key that opens the create dialog: a role key ("sales") or {@link CREATE_ANY_ROLE}. */
export const CREATE_AGENT_PARAM = "create"

/** The value of {@link CREATE_AGENT_PARAM} that opens the dialog with the role still to choose. */
export const CREATE_ANY_ROLE = "new"

/** The picture a new agent starts with: a preset, or a file already uploaded (its object path and its public address). */
export type PictureChoice =
    | { readonly kind: "preset"; readonly preset: PictureChoiceKey }
    | { readonly kind: "upload"; readonly path: string; readonly url: string }

/** Where the setup of the new agent starts: a sibling of the same role (its installation id), or the default setup. */
export type StartChoice = { readonly kind: "copy"; readonly installationId: string } | { readonly kind: "default" }

/** The value a start choice is listed by in the radio group. */
export const startValueOf = (choice: StartChoice): string =>
    choice.kind === "copy" ? `copy:${choice.installationId}` : "default"

/** The role key from the address, or null when the address asks for any role or for none. */
export const roleOfParam = (value: string | null, isRole: (value: string) => value is ModuleKey): ModuleKey | null =>
    value === null || value === CREATE_ANY_ROLE || !isRole(value) ? null : value
