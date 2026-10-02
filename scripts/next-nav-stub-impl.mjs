export const useRouter = () => ({ refresh() {}, push() {}, replace() {}, back() {}, prefetch() {} });
export const usePathname = () => "/m/hiring/workbench";
export const useSearchParams = () => new URLSearchParams();
export const notFound = () => { throw new Error("notFound"); };
export const redirect = (u) => { throw new Error(`redirect ${u}`); };
