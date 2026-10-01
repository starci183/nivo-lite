/** Marketing layout classes for the public landing page. Raw brand hex is allowed here (campaign/marketing blocks). */
export const PAGE = "min-h-dvh bg-white text-[#0F172A]";
export const RAIL = "mx-auto w-full max-w-[1040px] px-4 md:px-0";
export const SECTION = "scroll-mt-20 py-16 md:py-24";
export const EYEBROW = "inline-flex h-[26px] items-center gap-2 rounded-sm border border-[#E2E8F0] bg-white px-2.5 text-xs font-medium uppercase tracking-wider text-[#334155]";
export const EYEBROW_DOT = "block size-1.5 bg-[#E11D48]";
export const H2 = "text-3xl font-bold leading-tight tracking-tight md:text-4xl";
export const LEAD = "text-base leading-7 text-[#334155] md:text-lg";
export const CENTER = "flex flex-col items-center gap-4 text-center";

/* Nav */
export const NAV = "sticky top-0 z-30 border-b border-[#E2E8F0] bg-white/90 backdrop-blur";
export const NAV_ROW = "mx-auto flex h-16 w-full max-w-[1200px] items-center justify-between gap-3 px-4 md:h-20 md:px-8";
export const NAV_LINKS = "hidden items-center gap-1 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-1 lg:flex";
export const NAV_LINK = "flex h-9 items-center rounded-sm px-3.5 text-sm font-medium text-[#0F172A] hover:bg-white hover:text-[#7F1D1D]";
export const NAV_ACTIONS = "flex items-center gap-2 md:gap-3";
export const NAV_SIGNIN = "hidden sm:block";

/* Hero */
export const HERO = "relative isolate overflow-hidden border-b border-[#E2E8F0] bg-white pt-12 md:pt-20";
export const HERO_GLOW = "pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-2/3 bg-gradient-to-b from-transparent to-[#FFE4E6]";
export const HERO_COPY = "mx-auto flex max-w-4xl flex-col items-center gap-5 px-4 text-center";
export const H1 = "text-balance text-4xl font-bold leading-[1.1] tracking-tight md:text-6xl md:leading-[1.14]";
export const H1_ACCENT = "block text-[#E11D48]";
export const HERO_ACTIONS = "flex w-full flex-col items-center gap-3 sm:w-auto sm:flex-row";
export const HERO_NOTE = "text-xs text-[#64748B]";
export const HERO_SHOT = "mx-auto mt-12 w-full max-w-[1120px] px-4 md:mt-16";
export const HERO_SHOT_FADE = "translate-y-6 md:translate-y-10";

/* Browser frame */
export const FRAME = "overflow-hidden rounded-lg border border-[#E2E8F0] bg-white shadow-[0_24px_60px_-24px_rgba(15,23,42,0.28)]";
export const FRAME_BAR = "flex items-center gap-3 border-b border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2";
export const FRAME_DOTS = "flex gap-1.5";
export const FRAME_DOT = "block size-2.5 rounded-full bg-[#CBD5E1]";
export const FRAME_LABEL = "ml-auto rounded-sm bg-[#FB7185] px-2 py-0.5 text-[11px] font-medium text-[#0F172A]";
export const FRAME_IMG = "block h-auto w-full";
export const TAGLINE = "text-xs font-medium uppercase tracking-wider text-[#64748B]";

/* Trust strip */
export const TRUST = "py-12 md:py-16";
export const TRUST_LEAD = "mb-7 text-center text-sm text-[#334155]";
export const TRUST_BOX = "relative flex flex-col border border-[#E2E8F0] md:flex-row";
export const TRUST_CORNER = "absolute size-[5px] bg-[#CBD5E1]";
export const TRUST_WHO = "flex flex-col justify-center gap-1.5 border-b border-[#E2E8F0] p-6 md:w-80 md:shrink-0 md:border-b-0 md:border-r";
export const TRUST_CHIPS = "flex flex-wrap content-center gap-3 p-5 md:p-6";
export const CHIP = "inline-flex h-10 items-center gap-2 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3.5 text-sm text-[#0F172A]";

/* Product */
export const PRODUCT_HEAD = CENTER;
export const PRODUCT_BOX = "mt-12 flex flex-col border border-[#E2E8F0] md:mt-14";
export const PRODUCT_TABS = "overflow-x-auto border-b border-[#E2E8F0] px-3 pt-2";
export const PRODUCT_PANEL = "flex min-w-0 grow flex-col gap-5 p-6";
export const BULLETS = "flex flex-col gap-3";
export const BULLET = "flex items-start gap-3 text-sm leading-6 text-[#334155]";
export const BULLET_MARK = "mt-2 block size-1.5 shrink-0 bg-[#E11D48]";
export const PANEL_TITLE = "text-xl font-bold leading-7";
export const STACK = "mt-10 flex flex-col gap-10 md:hidden";
export const STACK_ITEM = "flex flex-col gap-4";
export const STACK_NAME = "text-xs font-medium uppercase tracking-wider text-[#64748B]";

/* Flow */
export const FLOW = "border-y border-[#E2E8F0] bg-[#F8FAFC]";
export const FLOW_GRID = "mt-12 grid grid-cols-1 gap-4 md:mt-14 md:grid-cols-2 lg:grid-cols-4";
export const FLOW_STEP = "relative flex flex-col gap-3 rounded-lg border border-[#E2E8F0] bg-white p-5";
export const FLOW_STEP_HUMAN = "relative flex flex-col gap-3 rounded-lg border border-[#E11D48] bg-[#FFE4E6] p-5";
export const FLOW_ART = "h-28 w-auto self-start select-none";
export const FLOW_META = "flex items-center justify-between gap-2 text-xs text-[#64748B]";
export const FLOW_NAME = "flex items-center gap-2 text-sm font-medium text-[#334155]";
export const FLOW_TITLE = "text-lg font-bold leading-6";
export const FLOW_TEXT = "text-sm leading-6 text-[#334155]";
export const FLOW_ARROW = "absolute -right-3.5 top-1/2 z-10 hidden size-7 -translate-y-1/2 items-center justify-center rounded-full border border-[#E2E8F0] bg-white text-[#64748B] lg:flex";
export const AI_CHIP = "rounded-sm bg-[#FB7185] px-1.5 py-0.5 text-[11px] font-bold text-[#0F172A]";
export const FLOW_TAG = "text-xs font-medium text-[#166534]";

/* Connect */
export const CONNECT = "bg-[#0F172A] text-white";
export const CONNECT_GRID = "grid grid-cols-1 gap-10 lg:grid-cols-2 lg:items-center lg:gap-16";
export const CONNECT_EYEBROW = "inline-flex h-[26px] items-center gap-2 rounded-sm border border-white/20 px-2.5 text-xs font-medium uppercase tracking-wider text-[#FB7185]";
export const CONNECT_LEAD = "text-base leading-7 text-white/75 md:text-lg";
export const CONNECT_LIST = "flex flex-col gap-3";
export const CONNECT_ITEM = "flex items-start justify-between gap-4 rounded-lg border border-white/15 bg-white/5 p-4";
export const CONNECT_ITEM_ON = "flex items-start justify-between gap-4 rounded-lg border border-[#FB7185] bg-white/10 p-4";
export const CONNECT_NAME = "text-base font-medium";
export const CONNECT_TEXT = "mt-1 text-sm leading-6 text-white/70";
export const CONNECT_OK = "shrink-0 rounded-sm bg-[#FB7185] px-2 py-0.5 text-xs font-bold text-[#0F172A]";
export const CONNECT_SOON = "shrink-0 rounded-sm border border-white/30 px-2 py-0.5 text-xs font-medium text-white/80";
export const CONNECT_NOTE = "text-sm text-white/60";
export const CONNECT_ART = "h-40 w-auto self-start select-none";
