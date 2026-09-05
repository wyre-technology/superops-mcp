/**
 * Ticket-card payload builder for the MCP Apps (SEP-1865) UI surface.
 *
 * superops_tickets_get results get a normalized `_card` object attached
 * (see domains/tickets.ts) that the ui:// ticket card renders from. The card
 * is progressive enhancement: every step here is best-effort, and a null
 * return simply means the host renders no card while the JSON payload is
 * unchanged.
 */

export const TICKET_CARD_RESOURCE_URI = "ui://superops/ticket-card.html";

/** MCP Apps resource MIME (RESOURCE_MIME_TYPE in @modelcontextprotocol/ext-apps). */
export const MCP_APP_RESOURCE_MIME = "text/html;profile=mcp-app";

/**
 * Tool `_meta` advertising the card. Carries both the canonical flat key
 * (RESOURCE_URI_META_KEY in ext-apps) and the nested form ext-apps'
 * registerAppTool emits, so any MCP Apps host revision finds it.
 */
export const TICKET_CARD_META = {
  "ui/resourceUri": TICKET_CARD_RESOURCE_URI,
  ui: { resourceUri: TICKET_CARD_RESOURCE_URI },
} as const;

/** Mirror of Brand in ui/ticket-card.ts — keep in sync. */
export interface CardBrand {
  name?: string;
  logoUrl?: string;
  primaryColor?: string;
  accentColor?: string;
  bg?: string;
  text?: string;
}

/** The BRAND_INJECT comment marker baked into the card HTML (see ui/index.html). */
const BRAND_INJECT_RE = /<!--\s*BRAND_INJECT:[\s\S]*?-->/;

/**
 * Serve-time brand injection: replace the BRAND_INJECT marker with an inline
 * `window.__BRAND__` script so self-hosters can theme the card without
 * rebuilding the bundle. An empty brand returns the HTML unchanged (the card
 * renders its neutral defaults). `<` is escaped so brand values can never
 * break out of the script tag.
 */
export function applyBrandInjection(html: string, brand: CardBrand): string {
  if (!brand || Object.values(brand).every((v) => !v)) return html;
  const json = JSON.stringify(brand).replace(/</g, "\\u003c");
  return html.replace(BRAND_INJECT_RE, `<script>window.__BRAND__=${json}</script>`);
}

/**
 * Resolve brand overrides from MCP_BRAND_* environment variables. Guarded for
 * runtimes without `process` (Cloudflare Workers), where this returns an empty
 * brand and the card serves its neutral defaults.
 */
export function resolveBrandFromEnv(): CardBrand {
  if (typeof process === "undefined" || !process.env) return {};
  const env = process.env;
  const brand: CardBrand = {};
  if (env.MCP_BRAND_NAME) brand.name = env.MCP_BRAND_NAME;
  if (env.MCP_BRAND_LOGO_URL) brand.logoUrl = env.MCP_BRAND_LOGO_URL;
  if (env.MCP_BRAND_PRIMARY_COLOR) brand.primaryColor = env.MCP_BRAND_PRIMARY_COLOR;
  if (env.MCP_BRAND_ACCENT_COLOR) brand.accentColor = env.MCP_BRAND_ACCENT_COLOR;
  if (env.MCP_BRAND_BG) brand.bg = env.MCP_BRAND_BG;
  if (env.MCP_BRAND_TEXT) brand.text = env.MCP_BRAND_TEXT;
  return brand;
}

/** Mirror of TicketCard in ui/ticket-card.ts — keep in sync. */
export interface TicketCard {
  ticketId: string;
  ticketNumber?: string;
  subject: string;
  status?: string;
  priority?: string;
  client?: string;
  site?: string;
  requester?: string;
  assignee?: string;
  techGroup?: string;
  category?: string;
  createdTime?: string;
  lastUpdatedTime?: string;
  description?: string;
  noteDefaults?: { isPublic: boolean };
}

const CARD_DESCRIPTION_MAX_LENGTH = 500;

/**
 * Resolve a display label for a nested SuperOps entity.
 *
 * These fields (`client`, `site`, `requester`, `technician`, `techGroup`)
 * arrive through the GraphQL `JSON` scalar, so they are opaque objects rather
 * than typed selections — prefer whichever name-ish key is present and fall
 * back to `#id`. Some, like `category`, are plain strings.
 */
function label(entity: unknown, ...nameKeys: string[]): string | undefined {
  if (typeof entity === "string") return entity || undefined;
  if (!entity || typeof entity !== "object") return undefined;
  const record = entity as Record<string, unknown>;
  for (const key of nameKeys) {
    const value = record[key];
    if (typeof value === "string" && value) return value;
  }
  const id = record.id ?? record.accountId ?? record.userId ?? record.groupId;
  if (id != null && id !== "") return `#${id}`;
  return undefined;
}

/**
 * SuperOps ticket descriptions can be rich text; the card shows a plain-text
 * snippet, so strip tags and collapse whitespace before truncating.
 */
function toSnippet(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const text = value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  return text ? text.slice(0, CARD_DESCRIPTION_MAX_LENGTH) : undefined;
}

/**
 * Build the renderable card from a superops_tickets_get payload. The GraphQL
 * query resolves entity names server-side, so no extra lookups are needed.
 * Best-effort: any unexpected shape returns null and the tool result is
 * served without a card.
 */
export function buildTicketCard(ticket: Record<string, unknown>): TicketCard | null {
  try {
    if (
      typeof ticket?.ticketId !== "string" ||
      !ticket.ticketId ||
      typeof ticket.subject !== "string" ||
      !ticket.subject
    ) {
      return null;
    }

    const card: TicketCard = {
      ticketId: ticket.ticketId,
      subject: ticket.subject,
      // SuperOps controls note visibility with the NotePrivacyType enum
      // (PUBLIC/PRIVATE); superops_tickets_add_note exposes that as an
      // `isPublic` boolean and maps it. Defaulting to false (PRIVATE) keeps
      // a note internal unless someone opts in — the card never guesses
      // visibility itself.
      noteDefaults: { isPublic: false },
    };

    // SuperOps calls the human-facing ticket number `displayId`.
    if (typeof ticket.displayId === "string" && ticket.displayId) {
      card.ticketNumber = ticket.displayId;
    }
    if (typeof ticket.status === "string" && ticket.status) card.status = ticket.status;
    if (typeof ticket.priority === "string" && ticket.priority) {
      card.priority = ticket.priority;
    }

    const client = label(ticket.client, "name");
    const site = label(ticket.site, "name");
    const requester = label(ticket.requester, "name", "email");
    // The assigned tech is `technician` in SuperOps; the card calls it assignee.
    const assignee = label(ticket.technician, "name", "email");
    const techGroup = label(ticket.techGroup, "name");
    // `category` is a plain String in SuperOps, which label() passes through.
    const category = label(ticket.category, "name");
    if (client) card.client = client;
    if (site) card.site = site;
    if (requester) card.requester = requester;
    if (assignee) card.assignee = assignee;
    if (techGroup) card.techGroup = techGroup;
    if (category) card.category = category;

    if (ticket.createdTime) card.createdTime = String(ticket.createdTime);
    if (ticket.updatedTime) card.lastUpdatedTime = String(ticket.updatedTime);

    // SuperOps' Ticket type has no readable description/body — it is write-only
    // on CreateTicketInput, and the thread lives in getTicketConversationList.
    // Callers may still pass one through; render it when present.
    const description = toSnippet(ticket.description);
    if (description) card.description = description;

    return card;
  } catch {
    // Best-effort: never let card building affect the tool result.
    return null;
  }
}
