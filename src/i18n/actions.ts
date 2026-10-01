"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { LOCALE_COOKIE, toLocale } from "./core";

/** Switch the interface language (cookie, one year) and re-render every route. */
export const setLocale = async (value: string) => {
  (await cookies()).set(LOCALE_COOKIE, toLocale(value), { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  revalidatePath("/", "layout");
};
