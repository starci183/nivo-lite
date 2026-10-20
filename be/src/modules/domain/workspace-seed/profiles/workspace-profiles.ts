import type { WorkspaceProfile } from "../workspace-profile.contracts"
import { HAKUEN_PROFILE } from "./hakuen.profile"

/** The workspace profiles `seed-workspace profile --profile <key>` can apply, by key. */
export const WORKSPACE_PROFILES: ReadonlyMap<string, WorkspaceProfile> = new Map([[HAKUEN_PROFILE.key, HAKUEN_PROFILE]])
