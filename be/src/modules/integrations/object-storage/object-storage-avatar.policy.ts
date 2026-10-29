/** The address of a picture, or null for none. */
export type AvatarAddress = string | null

/** The path every address of the old Supabase Storage carries; those addresses die with the old project. */
const LEGACY_STORAGE_PATH = "/storage/v1/object/"

/**
 * The picture address worth showing: an address of the old Supabase Storage is dropped (null), so the screens fall back to the
 * generated initials picture instead of a broken image; null, provider (Google) and new storage addresses are kept as they are.
 */
export const storedAvatarAddress = (address: AvatarAddress): AvatarAddress => {
    if (address === null || !URL.canParse(address)) return null
    return new URL(address).pathname.startsWith(LEGACY_STORAGE_PATH) ? null : address
}
