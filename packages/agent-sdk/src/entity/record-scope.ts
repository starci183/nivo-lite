import { moduleKeyOfName } from "../schema/namespaced"

/**
 * The agent (module key) a record type belongs to: the `<agent>` part of `<package>.<agent>.<domain>`, else the first part of an old-form
 * `<module>.<thing>` name (`moduleKeyOfName`, the one rule).
 */
export const agentOfRecordType = (name: string): string => moduleKeyOfName(name)
