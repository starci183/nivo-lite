/** The only process-environment reader in the landing app. */
const required = (name: string, value: string | undefined): string => {
    if (value === undefined || value === "") throw new Error(`${name} is not set`)
    return value
}

/** The public origin of the landing site (metadata base, canonical links). */
export const siteUrl = (): string => required("NEXT_PUBLIC_SITE_URL", process.env.NEXT_PUBLIC_SITE_URL)

/** The public origin of the console app every sign-in and try-it action leads to. */
export const appUrl = (): string => {
    const url = required("NEXT_PUBLIC_APP_URL", process.env.NEXT_PUBLIC_APP_URL)
    let end = url.length
    while (end > 0 && url[end - 1] === "/") end -= 1
    return url.slice(0, end)
}
