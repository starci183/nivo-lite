"use server"

import { cookies } from "next/headers"
import { revalidatePath } from "next/cache"
import { sessionCookieOptions } from "@/modules/config"
import { LOCALE_COOKIE, toLocale } from "./core"

/** Switch the interface language (cookie, one year) and re-render every route. The URL never carries the locale. */
export const setLocale = async (value: string) => {
    ;(await cookies()).set(LOCALE_COOKIE, toLocale(value), {
        ...sessionCookieOptions,
        path: "/",
        maxAge: 60 * 60 * 24 * 365,
    })
    revalidatePath("/", "layout")
}
