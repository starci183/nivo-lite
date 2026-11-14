/** The permission to see the content plan, its posts and the brand. */
export const CONTENT_VIEW = "content.view"

/** The permission to change the posts and the brand, approve a post and mark it published. */
export const CONTENT_MANAGE = "content.manage"

/** The permissions the Content module declares. */
export const CONTENT_PERMISSIONS: ReadonlyArray<string> = [CONTENT_VIEW, CONTENT_MANAGE]

/** The most posts one page of the list holds. */
export const POSTS_PAGE = 30

/** The most posts of one week the week figures read. */
export const WEEK_POSTS_MAX = 100
