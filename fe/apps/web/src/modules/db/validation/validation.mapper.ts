interface SignInInput {
    readonly email: string
    readonly password: string
}

type SignInParse = { readonly success: true; readonly data: SignInInput } | { readonly success: false }

const ADDRESS = /^[^\s@]+@([^\s@]+)$/u

/** Whether the text is one local part, one `@` and a domain with a dot that has a character on each side; linear in the length. */
const isEmail = (value: string): boolean => {
    const domain = ADDRESS.exec(value)?.[1]
    if (domain === undefined) return false
    const dot = domain.indexOf(".", 1)
    return dot !== -1 && dot < domain.length - 1
}

/** Bounds credentials before a sign-in request reaches Supabase Auth. */
export const signInInputSchema = {
    safeParse: (input: FormData): SignInParse => {
        const email = input.get("email")
        const password = input.get("password")
        if (
            typeof email !== "string" ||
            email.length > 254 ||
            !isEmail(email) ||
            typeof password !== "string" ||
            password.length < 1 ||
            password.length > 256
        ) {
            return { success: false }
        }
        return { success: true, data: { email, password } }
    },
}
