/** The permission to see the video projects, their renders and the brand kit. */
export const VIDEO_VIEW = "video.view"

/** The permission to change the projects and the brand kit. */
export const VIDEO_MANAGE = "video.manage"

/** The permissions the Video module declares. */
export const VIDEO_PERMISSIONS: ReadonlyArray<string> = [VIDEO_VIEW, VIDEO_MANAGE]

/** The most projects one page of the list holds. */
export const PROJECTS_PAGE = 30

/** The most renders a project's history lists. */
export const RENDERS_SHOWN = 20
