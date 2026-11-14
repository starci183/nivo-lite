/** The id of the style element the boot script paints from the cache, before the first theme read answers. */
export const WORKSPACE_THEME_BOOT_ID = "nivo-workspace-theme-boot"

/** The id of the font link the boot script adds. */
const BOOT_FONT_ID = `${WORKSPACE_THEME_BOOT_ID}-font`

/** The only host a font stylesheet may be loaded from. */
const FONT_HOST = "https://fonts.googleapis.com/"

/** The theme as kept in the browser: its stylesheet and its font address. */
interface CachedTheme {
    readonly css: string
    readonly fontHref: string | null
}

const keyOf = (workspaceId: string): string => `nivo.workspace-theme.${workspaceId}`

/** Removes the boot style and font the layout's script drew, once the provider draws the real ones. */
export const removeThemeBoot = (): void => {
    document.getElementById(WORKSPACE_THEME_BOOT_ID)?.remove()
    document.getElementById(BOOT_FONT_ID)?.remove()
}

/** Keeps the theme the workspace wears in this browser; answers false when the browser refused (private window, site data blocked). */
export const rememberThemeCache = (workspaceId: string, theme: CachedTheme): boolean => {
    try {
        window.localStorage.setItem(keyOf(workspaceId), JSON.stringify(theme))
        return true
    } catch {
        return false
    }
}

/** Forgets the kept theme of a workspace that returned to the NIVO default; answers false when the browser refused. */
export const forgetThemeCache = (workspaceId: string): boolean => {
    try {
        window.localStorage.removeItem(keyOf(workspaceId))
        return true
    } catch {
        return false
    }
}

/**
 * The script the console layout runs before the page paints: it draws the kept theme of the workspace in a style element (and its font),
 * so a return visit shows no flash of the NIVO colours. It reads only this browser's own cache and loads a font only from the one font host.
 */
export const themeBootScript = (workspaceId: string): string => {
    const key = JSON.stringify(keyOf(workspaceId)).replaceAll("<", String.raw`\u003c`)
    const ids = [WORKSPACE_THEME_BOOT_ID, BOOT_FONT_ID].map((id) => JSON.stringify(id))
    const host = JSON.stringify(FONT_HOST)
    return [
        "(function(){try{",
        `var c=window.localStorage.getItem(${key});if(!c)return;`,
        'var o=JSON.parse(c);if(typeof o.css!=="string")return;',
        `var s=document.createElement("style");s.id=${ids[0]};s.textContent=o.css;document.head.appendChild(s);`,
        `if(typeof o.fontHref==="string"&&o.fontHref.indexOf(${host})===0){`,
        `var l=document.createElement("link");l.rel="stylesheet";l.id=${ids[1]};l.href=o.fontHref;document.head.appendChild(l)}`,
        "}catch(e){}})()",
    ].join("")
}
