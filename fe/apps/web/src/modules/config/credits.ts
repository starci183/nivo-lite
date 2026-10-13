/** Where the credits page sends a request for a custom plan. */
export const creditsContactHref = (): string => {
    const href = process.env.NIVO_CONTACT_URL || process.env.NEXT_PUBLIC_SITE_URL
    if (!href) throw new Error("NIVO_CONTACT_URL or NEXT_PUBLIC_SITE_URL must be configured")
    return href
}
