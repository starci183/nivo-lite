/** The IANA time zone in which a workspace's "today", "this week" and "this month" begin: every workspace is Vietnamese today, until the workspace carries a zone of its own. */
export const WORKSPACE_TIME_ZONE = "Asia/Ho_Chi_Minh"

/** The time zone of a workspace's day, week and month. */
export const timeZoneOfWorkspace = (_workspaceId: string): string => WORKSPACE_TIME_ZONE
