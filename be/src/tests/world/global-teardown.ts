/** Supabase CLI owns stack startup, migrations and shutdown; suite worlds own their connections. */
export default function lifecycle(): Promise<void> {
    return Promise.resolve()
}
