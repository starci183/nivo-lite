import { MODULE_SERVERS } from "./module-servers"

/** The keys of every module this registry lists, for a host that checks its own wiring against it. */
export const REGISTERED_MODULE_KEYS: ReadonlyArray<string> = MODULE_SERVERS.map((module) => module.key)
