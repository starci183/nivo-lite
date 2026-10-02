export const cookies = async () => ({ get: () => undefined, getAll: () => [], set() {} });
export const headers = async () => new Headers();
export const revalidatePath = () => {};
export const after = () => {};
export const NextResponse = { json: () => ({}), next: () => ({}), redirect: () => ({}) };
export const unstable_cache = (fn) => fn; export const unstable_noStore = () => {}; export const revalidateTag = () => {}; export const connection = async () => {}; export const userAgent = () => ({});
