/* ═══════════════════════════════════════════════════════════════════
   GRIMOIRE — CA Arena
   Drop this file into /src/components/Grimoire.jsx

   Usage in App.jsx (Progress tab):
     import Grimoire from './components/Grimoire';
     ...
     {screen === "progress" && user && (
       <>
         ...existing progress panels...
         <Grimoire userId={user.id} token={token} supabase={supabase} />
       </>
     )}

   Supabase table required:
     grimoire_entries (
       id           uuid default gen_random_uuid() primary key,
       user_id      uuid references auth.users,
       concept_slug text,
       concept_label text,
       category     text,
       source        text,       -- "case" | "simulation"
       source_id     text,       -- caseId or sessionId
       source_label  text,       -- human-readable source name
       earned_at    timestamptz default now(),
       reinforced_at timestamptz,
       reinforcement_count integer default 1,
       xp_at_earn   integer,
       unique(user_id, concept_slug)
     )

   To seed from case completions, call upsertGrimoireFromCase() after awardXP().
   To seed from sim completions, call upsertGrimoireFromSim() after completeSession().
═══════════════════════════════════════════════════════════════════ */

import { useState, useEffect, useRef } from "react";

// ─── Design Tokens (mirrors App.jsx T object) ──────────────────────
const T = {
  bg:       "#0A0A0A",
  surf:     "#121212",
  surf2:    "#1A1A1A",
  surf3:    "#1E1E1E",
  border:   "#2A2A2A",
  txt:      "#F5F5F5",
  dim:      "#9CA3AF",
  muted:    "#3A3A3A",
  gold:     "#D4AF37",
  goldSoft: "#D4AF3722",
  goldM:    "#D4AF3788",
  blue:     "#3B82F6",
  green:    "#10B981",
  red:      "#F43F5E",
  purple:   "#8B5CF6",
  sans:     "'IBM Plex Sans', sans-serif",
  serif:    "'Playfair Display', serif",
  mono:     "'IBM Plex Mono', monospace",
};

// ─── All known concepts ────────────────────────────────────────────
// Matches CASE_CONCEPTS in App.jsx + PATH_CONCEPT_MAP from generateFreshMartSession.js
// Each concept lives in a category (school of magic) and has flavour text.
export const GRIMOIRE_MASTER = [
  // ── Liquidity & Working Capital ──
  { slug: "working-capital-management",        label: "Working Capital Management",       category: "Liquidity",       icon: "💧", flavour: "The lifeblood of operations. A business that cannot pay today has no tomorrow, regardless of profit on paper." },
  { slug: "liquidity-trap-vs-sunk-cost",       label: "Liquidity Trap vs. Sunk Cost",     category: "Liquidity",       icon: "🕳️", flavour: "Cash locked in dead stock is not investment — it is a trap. The sunk cost has been paid. The question is only what the cash can do next." },
  { slug: "current-ratio-liquidity",           label: "Current Ratio & Liquidity",        category: "Liquidity",       icon: "⚖️", flavour: "Current Ratio = Current Assets ÷ Current Liabilities. Below 1.5x is uncomfortable. Below 1.0x is a fire alarm." },
  { slug: "working-capital-squeeze",           label: "Working Capital Squeeze",          category: "Liquidity",       icon: "🗜️", flavour: "When receivables balloon, inventory builds, and payables shorten simultaneously — the squeeze. Cash disappears even as profit grows." },
  { slug: "creditor-days-deterioration",       label: "Creditor Days Deterioration",      category: "Liquidity",       icon: "📅", flavour: "Paying suppliers faster than before while growing is usually not strategy — it is a signal that credit terms were tightened. Investigate why." },

  // ── Cost & Margin ──
  { slug: "gross-margin-analysis",             label: "Gross Margin Analysis",            category: "Margin",          icon: "📐", flavour: "Revenue is vanity. Gross margin is the first line of defence. Know your floor before you price anything." },
  { slug: "contribution-margin",               label: "Contribution Margin",              category: "Margin",          icon: "➗", flavour: "Contribution = Revenue − Variable Costs. The engine of break-even logic. Every unit above break-even is pure contribution to fixed cost coverage." },
  { slug: "break-even-revenue-calculation",    label: "Break-Even Revenue",               category: "Margin",          icon: "🎯", flavour: "Break-Even = Fixed Costs ÷ Contribution Margin Ratio. The question every owner must answer before hiring or expanding." },
  { slug: "cost-structure-management",         label: "Cost Structure Management",        category: "Margin",          icon: "🏗️", flavour: "Fixed vs. variable cost mix determines how fragile or resilient a business is to revenue swings. High fixed costs = high operating leverage = high risk." },
  { slug: "pricing-strategy-margin-mgmt",      label: "Pricing Strategy & Margin Mgmt",   category: "Margin",          icon: "🏷️", flavour: "Price is not just what the market bears — it is the primary lever on margin. Raising price by 5% with no volume loss is worth more than cutting costs 10%." },

  // ── Debt & Capital ──
  { slug: "debt-financing-capital-structure",  label: "Debt Financing & Capital Structure",category: "Capital",         icon: "🏦", flavour: "Debt amplifies returns in good times and losses in bad. The question is not whether to use debt — it is how much, at what cost, and for what purpose." },
  { slug: "debt-restructuring",                label: "Debt Restructuring",               category: "Capital",         icon: "🔄", flavour: "When debt service exceeds cash generation, restructuring is not failure — it is strategy. The goal is to buy time for the underlying business to recover." },
  { slug: "finance-cost-impact-analysis",      label: "Finance Cost Impact Analysis",     category: "Capital",         icon: "📈", flavour: "Finance costs that grow faster than revenue compress margins regardless of operational performance. Watch EBIT vs Interest Coverage." },
  { slug: "debt-funded-growth-warning",        label: "Debt-Funded Growth Warning",       category: "Capital",         icon: "⚠️", flavour: "Negative free cash flow whilst showing profit is the hallmark of debt-funded expansion. Sustainable only if returns exceed the cost of debt." },
  { slug: "growth-strategy-capex",             label: "Growth Strategy & CapEx Trade-offs",category: "Capital",        icon: "🚀", flavour: "Capital allocation is the ultimate strategic act. Every rupee of CapEx is a bet on future cash flows. Underspending stunts growth; overspending kills liquidity." },
  { slug: "net-debt-ebitda-leverage",          label: "Net Debt / EBITDA Leverage",       category: "Capital",         icon: "🔢", flavour: "The most watched leverage ratio by lenders. Above 3.0x raises eyebrows. Above 5.0x raises covenant breach warnings." },

  // ── Inventory & Supply Chain ──
  { slug: "pareto-inventory",                  label: "Pareto Inventory (80/20)",         category: "Operations",      icon: "📦", flavour: "80% of your sales come from 20% of your SKUs. The art is identifying which 20% — and having the courage to liquidate the rest." },
  { slug: "inventory-management-jit",          label: "Inventory Management & JIT",       category: "Operations",      icon: "🔃", flavour: "Just-in-time reduces holding costs but creates supply chain fragility. The right buffer depends on supplier reliability and demand volatility." },
  { slug: "inventory-management-shrinkage",    label: "Inventory Shrinkage Control",      category: "Operations",      icon: "🔍", flavour: "Shrinkage is the silent margin killer — pilferage, spoilage, miscounting. 2–3% is industry acceptable. Anything above signals a controls failure." },
  { slug: "supply-chain-risk-procurement",     label: "Supply Chain Risk & Procurement",  category: "Operations",      icon: "🚚", flavour: "Single-supplier dependency is a concentration risk. Diversification costs slightly more in normal times — and saves the business in a crisis." },
  { slug: "break-even-and-velocity",           label: "Break-Even & Inventory Velocity",  category: "Operations",      icon: "⚡", flavour: "Inventory that does not turn is cash in chains. Velocity — how fast stock converts to cash — matters as much as margin." },

  // ── Fraud & Controls ──
  { slug: "fraud-risk-internal-controls",      label: "Fraud Risk & Internal Controls",   category: "Governance",      icon: "🔐", flavour: "Fraud thrives where segregation of duties is absent. One person who authorises, executes, and records a transaction is one person too many." },
  { slug: "fraud-response-ias-legal",          label: "Fraud Response — IAS & Legal",     category: "Governance",      icon: "⚖️", flavour: "On discovery of fraud: secure evidence, notify board, consult legal counsel. Do not confront the suspect alone. Do not delete records." },

  // ── Financial Reporting & IFRS ──
  { slug: "depreciation-true-profit",          label: "Depreciation & True Profit",       category: "Reporting",       icon: "📉", flavour: "A business that does not depreciate its assets reports phantom profit. Non-cash does not mean not-real — it means the cost is deferred, not avoided." },
  { slug: "small-business-profitability",      label: "Small Business Profitability",     category: "Reporting",       icon: "🏪", flavour: "Owner-draw vs. salary, depreciation omissions, and informal credit arrangements — the three most common distortions in small business financials." },
  { slug: "ifrs-9-ecl-staging",                label: "IFRS 9 ECL Staging",               category: "Reporting",       icon: "🏛️", flavour: "Stage 1 = 12-month ECL. Stage 2 = lifetime ECL (significant credit risk increase). Stage 3 = credit-impaired. Staging is not just accounting — it is risk management." },
  { slug: "ias-36-impairment-testing",         label: "IAS 36 Impairment Testing",        category: "Reporting",       icon: "🔎", flavour: "Test goodwill annually — and whenever there is an indicator. Recoverable amount is the higher of VIU and FVLCTD. Impairment losses cannot be reversed for goodwill." },
  { slug: "ifrs-3-goodwill-treatment",         label: "IFRS 3 Goodwill Treatment",        category: "Reporting",       icon: "🤝", flavour: "Goodwill = Consideration Paid − Fair Value of Net Assets Acquired. It represents expected future synergies. It must be tested for impairment, not amortised." },
  { slug: "conglomerate-pat-attribution",      label: "Conglomerate PAT Attribution",     category: "Reporting",       icon: "🏢", flavour: "In a conglomerate, PAT attributable to the parent and to non-controlling interests must be separated. NCI growth can dilute parent returns even as group profit rises." },
  { slug: "fcf-coverage-of-dividend",          label: "FCF Coverage of Dividend",         category: "Reporting",       icon: "💸", flavour: "Dividends paid from debt rather than free cash flow are unsustainable. FCF Coverage = Free Cash Flow ÷ Dividends Paid. Below 1.0x is a red flag." },

  // ── Strategy & Channels ──
  { slug: "digital-channel-strategy",          label: "Digital Channel Strategy",         category: "Strategy",        icon: "📱", flavour: "Online channels reduce dependence on footfall and extend reach. The economics differ sharply from physical retail — margin, fulfilment cost, and returns must be remodelled." },
  { slug: "brand-margin-strategy",             label: "Brand & Margin Strategy",          category: "Strategy",        icon: "🏆", flavour: "Private label commands higher margin but requires volume and brand trust. The strategic question: own the shelf or own the brand?" },
  { slug: "car-and-credit-risk",               label: "CAR and Credit Risk",              category: "Banking",         icon: "🏦", flavour: "Capital Adequacy Ratio = Tier 1 + Tier 2 Capital ÷ Risk-Weighted Assets. The regulatory floor is 10.5% under Basel III. Below it, growth must stop." },
  { slug: "kibor-spread-compression",          label: "KIBOR Spread Compression",         category: "Banking",         icon: "📊", flavour: "When policy rates fall, NIMs compress as asset repricing lags liability repricing. Banks must diversify into fee income to protect profitability." },
  { slug: "non-funded-income-strategy",        label: "Non-Funded Income Strategy",       category: "Banking",         icon: "💼", flavour: "Fee income — trade finance, guarantees, remittances — does not consume capital and is not rate-sensitive. The most resilient banks grow it deliberately." },
  { slug: "syndicated-lending-accounting",     label: "Syndicated Lending Accounting",    category: "Banking",         icon: "🔗", flavour: "In a syndication, the lead arranger and participants account for their proportionate share. Arrangement fees are recognised over the loan tenor under IFRS 9." },
];

// Index for O(1) lookup by slug
const GRIMOIRE_INDEX = Object.fromEntries(GRIMOIRE_MASTER.map(c => [c.slug, c]));

// Category metadata
const CATEGORIES = {
  Liquidity:   { color: "#3B82F6", icon: "💧", label: "Liquidity & Working Capital" },
  Margin:      { color: "#10B981", icon: "📐", label: "Cost & Margin" },
  Capital:     { color: "#F4C430", icon: "🏦", label: "Debt & Capital" },
  Operations:  { color: "#F97316", icon: "📦", label: "Inventory & Operations" },
  Governance:  { color: "#F43F5E", icon: "🔐", label: "Fraud & Governance" },
  Reporting:   { color: "#8B5CF6", icon: "📑", label: "Financial Reporting" },
  Strategy:    { color: "#D4AF37", icon: "🎯", label: "Strategy & Channels" },
  Banking:     { color: "#06B6D4", icon: "🏛️", label: "Banking & Risk" },
};

// ─── Supabase fetch helpers ────────────────────────────────────────

async function fetchGrimoireEntries(supabase, userId, token) {
  const data = await supabase.from("grimoire_entries", {
    select: "concept_slug,concept_label,category,source,source_label,earned_at,reinforced_at,reinforcement_count,xp_at_earn",
    eq: { user_id: userId },
    order: "earned_at.desc",
    limit: 200,
  }, token);
  return Array.isArray(data) ? data : [];
}

// Called from App.jsx after case completion
export async function upsertGrimoireFromCase(supabase, userId, caseId, caseLabel, concepts, userXp, token) {
  for (const conceptLabel of concepts) {
    const master = GRIMOIRE_MASTER.find(
     c => c.label.toLowerCase() === conceptLabel.toLowerCase()
    );
    const slug = master?.slug || conceptLabel.toLowerCase().replace(/[^a-z0-9]+/g, "-");
await supabase.insert("grimoire_entries", {
      user_id:             userId,
      concept_slug:        slug,
      concept_label:       conceptLabel,  
      category:            master?.category || "Reporting",
      source:              "case",
      source_id:           caseId,
      source_label:        caseLabel,
      earned_at:           new Date().toISOString(),
      reinforced_at:       new Date().toISOString(),
      reinforcement_count: 1,
      xp_at_earn:          userXp || 0,
    }, token)?.catch(() => null);
  }
}

// ─── Sub-components ────────────────────────────────────────────────

function SpellCard({ entry, masterEntry, onClick, isNew }) {
  const cat = CATEGORIES[masterEntry?.category] || CATEGORIES.Reporting;
  const [hovered, setHovered] = useState(false);

  const earnedDate = entry?.earned_at
    ? new Date(entry.earned_at).toLocaleDateString("en-PK", { day: "numeric", month: "short", year: "numeric" })
    : null;
  const reinforced = entry?.reinforcement_count > 1;

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? T.surf2 : T.surf,
        border: `1px solid ${hovered ? cat.color + "55" : T.border}`,
        padding: "14px 16px",
        cursor: "pointer",
        transition: "all .18s",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Category colour bar */}
      <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, background: cat.color }} />

      {/* NEW badge */}
      {isNew && (
        <div style={{
          position: "absolute", top: 8, right: 8,
          fontFamily: T.mono, fontSize: 7, color: T.green,
          border: `1px solid ${T.green}55`, padding: "1px 6px", letterSpacing: 1.5,
        }}>NEW</div>
      )}

      <div style={{ display: "flex", alignItems: "flex-start", gap: 10, paddingLeft: 8 }}>
        <span style={{ fontSize: 20, flexShrink: 0, lineHeight: 1.2 }}>{masterEntry?.icon || "📖"}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: T.sans, fontSize: 12, color: T.txt, fontWeight: 600, marginBottom: 4, lineHeight: 1.3 }}>
            {masterEntry?.label || entry.concept_label}
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            <span style={{
              fontFamily: T.mono, fontSize: 7, color: cat.color,
              border: `1px solid ${cat.color}44`, padding: "1px 6px", letterSpacing: 1,
            }}>{masterEntry?.category || "—"}</span>
            {reinforced && (
              <span style={{
                fontFamily: T.mono, fontSize: 7, color: T.gold,
                border: `1px solid ${T.goldM}`, padding: "1px 6px", letterSpacing: 1,
              }}>×{entry.reinforcement_count} REINFORCED</span>
            )}
          </div>
          {earnedDate && (
            <div style={{ fontFamily: T.mono, fontSize: 7, color: T.dim, marginTop: 5, letterSpacing: 1 }}>
              {entry.source === "simulation" ? "⚡ SIM" : "📋 CASE"} · {entry.source_label || entry.source_id} · {earnedDate}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SpellModal({ entry, masterEntry, onClose }) {
  const cat = CATEGORIES[masterEntry?.category] || CATEGORIES.Reporting;
  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const earnedDate = entry?.earned_at
    ? new Date(entry.earned_at).toLocaleDateString("en-PK", { day: "numeric", month: "short", year: "numeric" })
    : null;
  const reinforcedDate = entry?.reinforced_at && entry.reinforced_at !== entry.earned_at
    ? new Date(entry.reinforced_at).toLocaleDateString("en-PK", { day: "numeric", month: "short", year: "numeric" })
    : null;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, background: "#00000088",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 600, padding: 24, animation: "fadeIn .15s both",
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: T.surf, border: `1px solid ${cat.color}55`,
          maxWidth: 480, width: "100%", padding: "28px 28px 24px",
          animation: "fadeUp .2s both", position: "relative",
        }}
      >
        {/* Close */}
        <button
          onClick={onClose}
          style={{ position: "absolute", top: 14, right: 14, background: "none", border: "none", color: T.dim, cursor: "pointer", fontFamily: T.mono, fontSize: 11, letterSpacing: 1 }}
        >ESC ✕</button>

        {/* Category strip */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
          <div style={{ width: 3, height: 28, background: cat.color, flexShrink: 0 }} />
          <span style={{ fontFamily: T.mono, fontSize: 8, color: cat.color, letterSpacing: 2 }}>{CATEGORIES[masterEntry?.category]?.label?.toUpperCase() || "CONCEPT"}</span>
        </div>

        {/* Icon + title */}
        <div style={{ display: "flex", gap: 14, alignItems: "flex-start", marginBottom: 18 }}>
          <span style={{ fontSize: 36, lineHeight: 1 }}>{masterEntry?.icon || "📖"}</span>
          <div>
            <div style={{ fontFamily: T.serif, fontSize: 20, color: T.txt, fontWeight: 800, lineHeight: 1.2, marginBottom: 6 }}>
              {masterEntry?.label || entry.concept_label}
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <span style={{ fontFamily: T.mono, fontSize: 7, color: cat.color, border: `1px solid ${cat.color}44`, padding: "2px 7px", letterSpacing: 1 }}>
                {masterEntry?.category || "CONCEPT"}
              </span>
              {entry.reinforcement_count > 1 && (
                <span style={{ fontFamily: T.mono, fontSize: 7, color: T.gold, border: `1px solid ${T.goldM}`, padding: "2px 7px", letterSpacing: 1 }}>
                  ×{entry.reinforcement_count} REINFORCED
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Flavour text — the "spell description" */}
        <div style={{
          background: T.bg, border: `1px solid ${T.border}`,
          borderLeft: `3px solid ${cat.color}`,
          padding: "14px 16px", marginBottom: 18,
        }}>
          <div style={{ fontFamily: T.mono, fontSize: 8, color: T.dim, letterSpacing: 2, marginBottom: 8 }}>DOCTRINE</div>
          <div style={{ fontFamily: T.sans, fontSize: 13, color: "#ccc", lineHeight: 1.65 }}>
            {masterEntry?.flavour || "A concept you have encountered and survived."}
          </div>
        </div>

        {/* Provenance */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
          <div style={{ background: T.surf2, border: `1px solid ${T.border}`, padding: "10px 12px" }}>
            <div style={{ fontFamily: T.mono, fontSize: 7, color: T.dim, letterSpacing: 1.5, marginBottom: 4 }}>FIRST EARNED</div>
            <div style={{ fontFamily: T.mono, fontSize: 11, color: T.txt }}>{earnedDate || "—"}</div>
            <div style={{ fontFamily: T.mono, fontSize: 8, color: T.dim, marginTop: 2 }}>
              {entry.source === "simulation" ? "⚡ Simulation" : "📋 Case"} — {entry.source_label || "—"}
            </div>
          </div>
          <div style={{ background: T.surf2, border: `1px solid ${T.border}`, padding: "10px 12px" }}>
            <div style={{ fontFamily: T.mono, fontSize: 7, color: T.dim, letterSpacing: 1.5, marginBottom: 4 }}>XP WHEN EARNED</div>
            <div style={{ fontFamily: T.serif, fontSize: 16, color: T.gold, fontWeight: 700 }}>{entry.xp_at_earn?.toLocaleString() || "—"}</div>
            {reinforcedDate && (
              <div style={{ fontFamily: T.mono, fontSize: 8, color: T.green, marginTop: 2 }}>Last seen {reinforcedDate}</div>
            )}
          </div>
        </div>

        <button
          onClick={onClose}
          style={{
            background: "transparent", border: `1px solid ${T.border}`,
            color: T.dim, fontFamily: T.mono, fontSize: 9,
            padding: "8px 18px", cursor: "pointer", letterSpacing: 1.5, width: "100%",
          }}
        >CLOSE</button>
      </div>
    </div>
  );
}

function LockedSpell({ masterEntry }) {
  const cat = CATEGORIES[masterEntry.category] || CATEGORIES.Reporting;
  return (
    <div style={{
      background: T.bg, border: `1px solid ${T.muted}22`,
      padding: "14px 16px", opacity: 0.35, position: "relative", overflow: "hidden",
    }}>
      <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, background: T.muted }} />
      <div style={{ display: "flex", alignItems: "center", gap: 10, paddingLeft: 8 }}>
        <span style={{ fontSize: 20, flexShrink: 0, filter: "grayscale(1)", lineHeight: 1.2 }}>{masterEntry.icon}</span>
        <div>
          <div style={{ fontFamily: T.sans, fontSize: 12, color: T.dim, fontWeight: 600 }}>{masterEntry.label}</div>
          <div style={{ fontFamily: T.mono, fontSize: 7, color: T.muted, letterSpacing: 1, marginTop: 4 }}>🔒 NOT YET EARNED</div>
        </div>
      </div>
    </div>
  );
}

// ─── MAIN GRIMOIRE COMPONENT ───────────────────────────────────────

export default function Grimoire({ userId, token, supabase }) {
  const [entries, setEntries]           = useState([]);
  const [loading, setLoading]           = useState(true);
  const [activeCategory, setActiveCategory] = useState("ALL");
  const [showLocked, setShowLocked]     = useState(false);
  const [search, setSearch]             = useState("");
  const [selectedEntry, setSelectedEntry] = useState(null); // {entry, masterEntry}
  const [recentSlugs, setRecentSlugs]   = useState(new Set());

  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    fetchGrimoireEntries(supabase, userId, token)
      .then(data => {
        setEntries(data);
        // Mark entries earned in the last 7 days as "new"
        const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
        const newSlugs = new Set(
          data.filter(e => new Date(e.earned_at).getTime() > cutoff).map(e => e.concept_slug)
        );
        setRecentSlugs(newSlugs);
      })
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
  }, [userId, token]);

  // Build lookup: slug → entry row
  const entryMap = Object.fromEntries(entries.map(e => [e.concept_slug, e]));
  const earnedSlugs = new Set(entries.map(e => e.concept_slug));

  // Filter earned concepts
  const filteredEarned = GRIMOIRE_MASTER.filter(m => {
    if (!earnedSlugs.has(m.slug)) return false;
    if (activeCategory !== "ALL" && m.category !== activeCategory) return false;
    if (search && !m.label.toLowerCase().includes(search.toLowerCase()) &&
        !m.category.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  // Filter locked (only show if toggled)
  const filteredLocked = showLocked
    ? GRIMOIRE_MASTER.filter(m => {
        if (earnedSlugs.has(m.slug)) return false;
        if (activeCategory !== "ALL" && m.category !== activeCategory) return false;
        if (search && !m.label.toLowerCase().includes(search.toLowerCase())) return false;
        return true;
      })
    : [];

  // Category counts (earned only)
  const catCounts = {};
  entries.forEach(e => {
    const m = GRIMOIRE_INDEX[e.concept_slug];
    if (m) catCounts[m.category] = (catCounts[m.category] || 0) + 1;
  });

  const totalKnown   = earnedSlugs.size;
  const totalPossible = GRIMOIRE_MASTER.length;
  const completionPct = Math.round((totalKnown / totalPossible) * 100);

  return (
    <div style={{ marginTop: 24 }}>

      {/* ── Header ── */}
      <div style={{
        background: T.surf, border: `1px solid ${T.border}`,
        borderLeft: `3px solid ${T.gold}`,
        padding: "20px 22px", marginBottom: 16,
        display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap",
      }}>
        <div>
          <div style={{ fontFamily: T.mono, fontSize: 8, color: T.dim, letterSpacing: 3, marginBottom: 6 }}>PERSONAL COMPENDIUM</div>
          <div style={{ fontFamily: T.serif, fontSize: 22, color: T.gold, fontWeight: 900, letterSpacing: 1 }}>The Grimoire</div>
          <div style={{ fontFamily: T.sans, fontSize: 12, color: T.dim, marginTop: 4, maxWidth: 420, lineHeight: 1.5 }}>
            Every concept you have encountered through cases and simulations. Earned through doing, not memorising.
          </div>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ fontFamily: T.serif, fontSize: 30, color: T.gold, fontWeight: 900, lineHeight: 1 }}>{totalKnown}</div>
          <div style={{ fontFamily: T.mono, fontSize: 8, color: T.dim, letterSpacing: 1 }}>of {totalPossible} concepts</div>
          {/* Progress bar */}
          <div style={{ width: 120, height: 3, background: T.muted, marginTop: 8, marginLeft: "auto" }}>
            <div style={{ height: "100%", width: `${completionPct}%`, background: T.gold, transition: "width .6s" }} />
          </div>
          <div style={{ fontFamily: T.mono, fontSize: 8, color: T.gold, marginTop: 4, letterSpacing: 1 }}>{completionPct}% complete</div>
        </div>
      </div>

      {/* ── Category filter strip ── */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
        <button
          onClick={() => setActiveCategory("ALL")}
          style={{
            background: activeCategory === "ALL" ? T.gold : "transparent",
            border: `1px solid ${activeCategory === "ALL" ? T.gold : T.border}`,
            color: activeCategory === "ALL" ? "#000" : T.dim,
            fontFamily: T.mono, fontSize: 8, padding: "5px 12px",
            cursor: "pointer", letterSpacing: 1.5, transition: "all .15s",
          }}
        >ALL ({totalKnown})</button>

        {Object.entries(CATEGORIES).map(([key, meta]) => {
          const count = catCounts[key] || 0;
          const active = activeCategory === key;
          return (
            <button
              key={key}
              onClick={() => setActiveCategory(key)}
              style={{
                background: active ? meta.color + "22" : "transparent",
                border: `1px solid ${active ? meta.color : T.border}`,
                color: active ? meta.color : T.dim,
                fontFamily: T.mono, fontSize: 8, padding: "5px 12px",
                cursor: "pointer", letterSpacing: 1, transition: "all .15s",
              }}
            >{meta.icon} {key} {count > 0 ? `(${count})` : ""}</button>
          );
        })}
      </div>

      {/* ── Search + toggle ── */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16, alignItems: "center" }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search concepts..."
          style={{
            flex: 1, background: T.surf, border: `1px solid ${T.border}`,
            color: T.txt, fontFamily: T.mono, fontSize: 11, padding: "8px 12px",
            outline: "none",
          }}
        />
        <button
          onClick={() => setShowLocked(s => !s)}
          style={{
            background: "transparent",
            border: `1px solid ${showLocked ? T.gold : T.border}`,
            color: showLocked ? T.gold : T.dim,
            fontFamily: T.mono, fontSize: 8, padding: "8px 14px",
            cursor: "pointer", letterSpacing: 1, whiteSpace: "nowrap", flexShrink: 0,
          }}
        >{showLocked ? "HIDE LOCKED" : "SHOW LOCKED"}</button>
      </div>

      {/* ── Loading ── */}
      {loading && (
        <div style={{ fontFamily: T.mono, fontSize: 10, color: T.dim, padding: "24px 0", textAlign: "center", letterSpacing: 2 }}>
          LOADING GRIMOIRE...
        </div>
      )}

      {/* ── Empty state ── */}
      {!loading && totalKnown === 0 && (
        <div style={{
          background: T.surf, border: `1px solid ${T.border}`,
          padding: "32px 24px", textAlign: "center",
        }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>📖</div>
          <div style={{ fontFamily: T.serif, fontSize: 18, color: T.dim, fontWeight: 700, marginBottom: 8 }}>Your Grimoire is empty</div>
          <div style={{ fontFamily: T.sans, fontSize: 13, color: T.muted, lineHeight: 1.6 }}>
            Complete a case or simulation to earn your first concept.<br />Every decision you survive teaches you something.
          </div>
        </div>
      )}

      {/* ── Earned spells grid ── */}
      {!loading && filteredEarned.length > 0 && (
        <>
          <div style={{ fontFamily: T.mono, fontSize: 7, color: T.dim, letterSpacing: 2, marginBottom: 10 }}>
            EARNED CONCEPTS — {filteredEarned.length} shown
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 8, marginBottom: 16 }}>
            {filteredEarned.map(m => (
              <SpellCard
                key={m.slug}
                masterEntry={m}
                entry={entryMap[m.slug]}
                isNew={recentSlugs.has(m.slug)}
                onClick={() => setSelectedEntry({ entry: entryMap[m.slug], masterEntry: m })}
              />
            ))}
          </div>
        </>
      )}

      {/* ── Locked spells ── */}
      {!loading && showLocked && filteredLocked.length > 0 && (
        <>
          <div style={{ fontFamily: T.mono, fontSize: 7, color: T.muted, letterSpacing: 2, marginBottom: 10, marginTop: 8 }}>
            LOCKED — {filteredLocked.length} concepts not yet encountered
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 8 }}>
            {filteredLocked.map(m => <LockedSpell key={m.slug} masterEntry={m} />)}
          </div>
        </>
      )}

      {/* ── No results from search ── */}
      {!loading && filteredEarned.length === 0 && totalKnown > 0 && !showLocked && (
        <div style={{ fontFamily: T.mono, fontSize: 10, color: T.dim, padding: "16px 0", letterSpacing: 1 }}>
          No concepts match this filter. Try a different category or clear search.
        </div>
      )}

      {/* ── Spell detail modal ── */}
      {selectedEntry && (
        <SpellModal
          entry={selectedEntry.entry}
          masterEntry={selectedEntry.masterEntry}
          onClose={() => setSelectedEntry(null)}
        />
      )}
    </div>
  );
}