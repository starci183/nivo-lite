import type { AvatarFile, AvatarOwner } from "./avatars.contracts"

/** The public bucket pictures live in; only its upload addresses come from the back end, nobody else writes it. */
export const AVATAR_BUCKET = "avatars_public"

/** The largest picture, in bytes (the bucket's own file_size_limit). */
export const AVATAR_MAX_BYTES = 2 * 1024 * 1024

/** The accepted picture types and the extension each is stored under (the bucket's own allowed_mime_types). */
const AVATAR_EXTENSIONS: Readonly<Record<string, string>> = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/webp": "webp",
}

const OBJECT_NAME = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpg|webp)$/u

/** The extension a picture is stored under, or null when its type or size is not accepted. */
export const avatarExtensionOf = (file: AvatarFile): string | null => {
    const extension = AVATAR_EXTENSIONS[file.contentType]
    const sized = Number.isInteger(file.sizeBytes) && file.sizeBytes > 0 && file.sizeBytes <= AVATAR_MAX_BYTES
    return extension !== undefined && sized ? extension : null
}

/** The object path of a new picture: the owner's folder and a fresh id, so no name of a person or agent is ever public. */
export const avatarPathOf = (owner: AvatarOwner, objectId: string, extension: string): string =>
    `${owner}/${objectId}.${extension}`

/** Whether a path is one the back end issues for this owner's folder: one fresh id and an accepted extension, nothing else. */
export const isAvatarPath = (owner: AvatarOwner, path: string): boolean => {
    const [folder, name, ...rest] = path.split("/")
    return folder === owner && name !== undefined && rest.length === 0 && OBJECT_NAME.test(name)
}

/** Whether an address may be kept as a picture: HTTPS only, as the member avatars and the agents table require. */
export const isHttpsAddress = (url: string): boolean => url.startsWith("https://")
