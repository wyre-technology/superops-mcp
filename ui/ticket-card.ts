/**
 * Iframe bridge + renderer for the SuperOps ticket card (MCP Apps, SEP-1865).
 *
 * Runs inside the host's sandboxed iframe. Uses the official MCP Apps client
 * (`App`) to receive the tool result from the host and to call
 * superops_tickets_add_note back (the "Add note" round-trip).
 *
 * The server attaches a normalized `_card` payload to superops_tickets_get
 * results (see src/card.builder.ts) so this renderer never needs to resolve
 * ids or entity names itself.
 *
 * Rendering uses DOM construction (no innerHTML) — ticket subjects, notes,
 * and descriptions are untrusted PSA data, so text only ever lands in text
 * nodes.
 *
 * White-label: the card is neutral by default (no vendor identity) and applies
 * an injected `window.__BRAND__` override (set by the MCP server via
 * MCP_BRAND_* env vars, or a gateway per-org) so the same card can render in
 * any operator's brand.
 */
import { App } from "@modelcontextprotocol/ext-apps";

interface Brand {
  name?: string;
  logoUrl?: string;
  primaryColor?: string;
  accentColor?: string;
  bg?: string;
  text?: string;
}
declare global {
  interface Window {
    __BRAND__?: Brand;
  }
}

/** Mirror of TicketCard in src/card.builder.ts — keep in sync. */
interface TicketCard {
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

const brand: Brand = window.__BRAND__ ?? {};
const brandName = brand.name ?? "";

// Apply any injected brand overrides onto the CSS custom properties.
function applyBrand(): void {
  const root = document.documentElement.style;
  if (brand.primaryColor) root.setProperty("--brand-primary", brand.primaryColor);
  if (brand.accentColor) root.setProperty("--brand-accent", brand.accentColor);
  if (brand.bg) root.setProperty("--brand-bg", brand.bg);
  if (brand.text) root.setProperty("--brand-text", brand.text);
}

const app = new App({ name: "SuperOps Ticket Card", version: "1.0.0" });
let current: TicketCard | null = null;
// Notes added from this card in this session (superops_tickets_get does not
// return note history, so the card only shows what it posted itself).
let addedNotes: string[] = [];

/** Create an element with a class and (safe, text-node) children. */
function el(
  tag: string,
  className = "",
  ...children: Array<Node | string | null>
): HTMLElement {
  const node = document.createElement(tag);
  if (className) node.className = className;
  for (const child of children) {
    if (child == null) continue;
    node.append(child); // strings become text nodes — never parsed as HTML
  }
  return node;
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function field(label: string, value: string | undefined): HTMLElement | null {
  if (!value) return null;
  return el(
    "div",
    "field",
    el("div", "field__label", label),
    el("div", "field__value", value),
  );
}

function badge(text: string | undefined, cls: string): HTMLElement | null {
  return text ? el("span", `badge ${cls}`, text) : null;
}

function render(t: TicketCard): void {
  current = t;

  // Brand identity only renders when a brand was injected — the neutral
  // default shows just the ticket number/vendor context in the header.
  let brandId: HTMLElement | null = null;
  if (brandName || brand.logoUrl) {
    brandId = el("span", "brandid");
    if (brand.logoUrl) {
      const logo = document.createElement("img");
      logo.src = brand.logoUrl;
      logo.alt = brandName;
      logo.style.display = "inline-block";
      brandId.append(logo);
    }
    if (brandName) brandId.append(el("span", "brand", brandName));
  }

  const description = t.description
    ? el("div", "desc", el("div", "desc__h", "Description"), el("div", "desc__text", t.description))
    : null;

  let notesSection: HTMLElement | null = null;
  if (t.noteDefaults) {
    notesSection = el("div", "notes", el("div", "notes__h", "Notes"));
    for (const note of addedNotes) notesSection.append(el("div", "note", note));

    const input = document.createElement("input");
    input.id = "note-input";
    input.type = "text";
    input.placeholder = "Add an internal note to this ticket…";
    const btn = el("button", "btn", "Add note") as HTMLButtonElement;
    btn.id = "note-btn";

    const submit = async () => {
      const note = input.value.trim();
      if (!note || !current?.noteDefaults) return;
      btn.disabled = true;
      btn.textContent = "Adding…";
      try {
        // The server resolved a safe internal-only visibility default into
        // noteDefaults (isPublic: false); the card never guesses visibility.
        await app.callServerTool({
          name: "superops_tickets_add_note",
          arguments: {
            ticketId: current.ticketId,
            content: note,
            isPublic: current.noteDefaults.isPublic,
          },
        });
        // The note tool returns the created note, not the ticket — append
        // optimistically and re-render.
        addedNotes = [...addedNotes, note];
        render(current);
      } catch {
        btn.disabled = false;
        btn.textContent = "Add note";
      }
    };
    btn.addEventListener("click", submit);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") submit();
    });
    notesSection.append(el("div", "addnote", input, btn));
  }

  const ticketRef = t.ticketNumber ?? t.ticketId;
  const body = el(
    "div",
    "card__body",
    el("div", "brandrow", brandId, el("span", "ticketno", `#${ticketRef} · SuperOps`)),
    el("h1", "", t.subject),
    el("div", "badges", badge(t.status, "badge--status"), badge(t.priority, "badge--prio")),
    el(
      "div",
      "grid",
      field("Client", t.client),
      field("Requester", t.requester),
      field("Assignee", t.assignee ?? "Unassigned"),
      field("Tech group", t.techGroup),
      field("Category", t.category),
      field("Site", t.site),
      field("Opened", t.createdTime && fmtDate(t.createdTime)),
      field("Updated", t.lastUpdatedTime && fmtDate(t.lastUpdatedTime)),
    ),
    description,
    notesSection,
  );

  const root = document.getElementById("root")!;
  root.replaceChildren(el("div", "card", el("div", "card__bar"), body));
}

// superops-mcp returns the ticket JSON directly and attaches the normalized
// card to superops_tickets_get results as _card.
function extractCard(obj: unknown): TicketCard | null {
  const card = (obj as { _card?: TicketCard })?._card;
  return card && typeof card.ticketId === "string" && typeof card.subject === "string"
    ? card
    : null;
}

applyBrand();

// Must be set before connect() so the initial tool-result isn't missed.
app.ontoolresult = (result: { content?: Array<{ type: string; text?: string }> }) => {
  const payload = (result.content ?? []).find((c) => c.type === "text");
  if (!payload?.text) return;
  try {
    const card = extractCard(JSON.parse(payload.text));
    if (card) render(card);
  } catch {
    /* ignore malformed payloads */
  }
};

app.connect();
