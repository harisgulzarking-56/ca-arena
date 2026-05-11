/**
 * ═══════════════════════════════════════════════════════════════════
 *  FRESHMART SESSION GENERATOR
 *  Drop this file into /src/lib/generateFreshMartSession.js
 *
 *  Usage:
 *    import { generateFreshMartSession, startSession, loadSession } from './lib/generateFreshMartSession';
 *
 *  Flow:
 *    1. generateFreshMartSession(userXp)  → builds a unique seeded instance
 *    2. startSession(supabase, userId, session) → persists it to Supabase
 *    3. loadSession(supabase, sessionId)  → rehydrates an in-progress run
 * ═══════════════════════════════════════════════════════════════════
 */

// ─── Helpers ──────────────────────────────────────────────────────

/** Seeded pseudo-random number generator (Mulberry32).
 *  Same seed always gives same sequence — so two players with the
 *  same seed see the same numbers. Every session gets a unique seed,
 *  so every player gets different numbers. */
function seededRng(seed) {
  let s = seed >>> 0;
  return function () {
    s += 0x6d2b79f5;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Pick a random value in [min, max] using rng, rounded to `decimals`. */
function randBetween(rng, min, max, decimals = 0) {
  const raw = min + rng() * (max - min);
  const factor = Math.pow(10, decimals);
  return Math.round(raw * factor) / factor;
}

/** Pick a random element from an array using rng. */
function randPick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}

// ─── Variable Ranges ──────────────────────────────────────────────
// These define the envelope of what each run's numbers can look like.
// Keep ranges wide enough to create genuinely different difficulty
// profiles, but not so extreme that scenarios become implausible.

const VARIABLE_RANGES = {
  // Financials
  capital_invested:    { min: 20_000_000, max: 40_000_000 },   // PKR
  cash_embezzled:      { min: 3_000_000,  max: 8_000_000  },   // PKR
  monthly_sales:       { min: 700_000,    max: 1_400_000  },   // PKR
  profit_margin:       { min: 0.06,       max: 0.16,  dec: 2 },// ratio
  rent_expense:        { min: 300_000,    max: 550_000        },
  salary_expense:      { min: 350_000,    max: 600_000        },// 10-20 staff
  electricity_expense: { min: 40_000,     max: 80_000         },
  dead_stock_units:    { min: 250,        max: 600            },// SKUs
  customer_footfall:   { min: 70,         max: 140            },// /day

  // Stakeholder baselines
  customer_satisfaction: { min: 0.45, max: 0.70, dec: 2 },
  employee_morale:       { min: 0.40, max: 0.65, dec: 2 },
  supplier_relations:    { min: 0.40, max: 0.65, dec: 2 },
  debt_stress:           { min: 0.50, max: 0.80, dec: 2 },
  inventory_turnover:    { min: 0.20, max: 0.45, dec: 2 },
};

// ─── Flavour Pools ────────────────────────────────────────────────
const OWNER_NAMES = [
  "Ahmed Raza", "Bilal Sheikh", "Tariq Mahmood",
  "Kamran Baig", "Faisal Qureshi", "Imran Siddiqui",
  "Naveed Anwar", "Sajjad Mirza",
];

const CRISIS_TYPES = [
  {
    id:      "embezzlement",
    label:   "Cash Embezzlement",
    icon:    "💸",
    flavour: (v) =>
      `A senior cashier absconded with PKR ${fmt(v.cash_embezzled)} — ` +
      `${pct(v.cash_embezzled / v.capital_invested)} of total capital — ` +
      `leaving a gaping hole in working capital.`,
    grimoire_concept: "Fraud Risk & Internal Controls",
  },
  {
    id:      "supplier_default",
    label:   "Supplier Default",
    icon:    "🚚",
    flavour: (v) =>
      `FreshMart's primary supplier defaulted mid-season, leaving shelves ` +
      `sparse. Restocking on short notice cost PKR ${fmt(v.cash_embezzled)} ` +
      `in emergency purchases at unfavourable terms.`,
    grimoire_concept: "Supply Chain Risk & Procurement Strategy",
  },
  {
    id:      "inventory_shrinkage",
    label:   "Inventory Shrinkage",
    icon:    "📦",
    flavour: (v) =>
      `A stocktake revealed PKR ${fmt(v.cash_embezzled)} in unrecorded ` +
      `shrinkage — a mix of spoilage, pilferage, and poor receiving controls. ` +
      `Cash reserves took the hit.`,
    grimoire_concept: "Inventory Management & Shrinkage Control",
  },
];

// ─── Difficulty Modifiers ─────────────────────────────────────────
// Adjusts the generated numbers so higher-XP players get harder setups.
const DIFFICULTY_PROFILES = {
  SEED:   { salesMod: 1.0, marginMod: 1.0,  cashMod: 1.0,  label: "Standard"   },
  GROWTH: { salesMod: 0.85,marginMod: 0.85, cashMod: 0.80, label: "Tighter"    },
  APEX:   { salesMod: 0.70,marginMod: 0.70, cashMod: 0.60, label: "Crisis Mode" },
};

function difficultyFromXp(xp) {
  if (xp >= 800) return "APEX";
  if (xp >= 200) return "GROWTH";
  return "SEED";
}

// ─── XP Table ─────────────────────────────────────────────────────
// Tied to ending type. Outcomes also feed the Grimoire entry.
export const SESSION_XP_TABLE = {
  perfect:  { xp: 250, commission: 15000, label: "Optimal Recovery"   },
  good:     { xp: 150, commission: 9000,  label: "Business Stabilised" },
  struggle: { xp: 75,  commission: 4500,  label: "Ongoing Struggle"    },
  bad:      { xp: 25,  commission: 1000,  label: "Business Collapsed"  },
};

// ─── Grimoire Concepts ────────────────────────────────────────────
// Each decision path in the sim maps to a concept slug.
// After session completion the caller can pass these to upsertGrimoireEntry().
export const PATH_CONCEPT_MAP = {
  layoff_employees:     { slug: "cost-structure-management",      label: "Cost Structure Management"    },
  take_loan:            { slug: "debt-financing-capital-structure",label: "Debt Financing & Capital Structure" },
  increase_prices:      { slug: "pricing-strategy-margin-mgmt",   label: "Pricing Strategy & Margin Management" },
  supplier_credit:      { slug: "working-capital-management",     label: "Working Capital Management"   },
  // Month 2+
  aggressive_expansion: { slug: "growth-strategy-capex",          label: "Growth Strategy & CapEx Trade-offs" },
  debt_restructuring:   { slug: "debt-restructuring",             label: "Debt Restructuring"           },
  inventory_optimization:{ slug: "inventory-management-jit",      label: "Inventory Management & JIT"   },
  online_channels:      { slug: "digital-channel-strategy",       label: "Digital Channel Strategy"     },
  private_label:        { slug: "brand-margin-strategy",          label: "Brand & Margin Strategy"      },
};

// ─── Core Generator ───────────────────────────────────────────────

/**
 * Generates a fully seeded FreshMart session instance.
 *
 * @param {number} userXp   - User's current XP (determines difficulty envelope)
 * @returns {FreshMartSession}
 */
export function generateFreshMartSession(userXp = 0) {
  // 1. Unique seed — time-based so every call gives a new session
  const seed    = Date.now() ^ (Math.random() * 0xffffffff);
  const rng     = seededRng(seed);

  // 2. Difficulty tier
  const diff    = difficultyFromXp(userXp);
  const profile = DIFFICULTY_PROFILES[diff];

  // 3. Roll all variable values within their ranges
  const R = VARIABLE_RANGES;
  const v = {
    capital_invested:      randBetween(rng, R.capital_invested.min,    R.capital_invested.max),
    cash_embezzled:        randBetween(rng, R.cash_embezzled.min,      R.cash_embezzled.max),
    rent_expense:          randBetween(rng, R.rent_expense.min,        R.rent_expense.max),
    salary_expense:        randBetween(rng, R.salary_expense.min,      R.salary_expense.max),
    electricity_expense:   randBetween(rng, R.electricity_expense.min, R.electricity_expense.max),
    dead_stock_units:      randBetween(rng, R.dead_stock_units.min,    R.dead_stock_units.max),
    customer_footfall:     randBetween(rng, R.customer_footfall.min,   R.customer_footfall.max),
    customer_satisfaction: randBetween(rng, R.customer_satisfaction.min, R.customer_satisfaction.max, 2),
    employee_morale:       randBetween(rng, R.employee_morale.min,     R.employee_morale.max, 2),
    supplier_relations:    randBetween(rng, R.supplier_relations.min,  R.supplier_relations.max, 2),
    debt_stress:           randBetween(rng, R.debt_stress.min,         R.debt_stress.max, 2),
    inventory_turnover:    randBetween(rng, R.inventory_turnover.min,  R.inventory_turnover.max, 2),
  };

  // 4. Apply difficulty modifiers to key financials
  const monthly_sales   = Math.round(
    randBetween(rng, R.monthly_sales.min, R.monthly_sales.max) * profile.salesMod
  );
  const profit_margin   = parseFloat(
    (randBetween(rng, R.profit_margin.min, R.profit_margin.max, 2) * profile.marginMod).toFixed(2)
  );
  const cash_on_hand    = Math.round(
    (monthly_sales * 0.9) * profile.cashMod // starts roughly 1 month of sales-ish
  );

  // 5. Derived values
  const monthly_burn    = v.rent_expense + v.salary_expense + v.electricity_expense;
  const remaining_capital = v.capital_invested - v.cash_embezzled;

  // Targets scale proportionally with starting capital
  const month_target_3  = Math.round(monthly_sales * 2.0);
  const month_target_6  = Math.round(monthly_sales * 4.0);

  // 6. Flavour picks
  const owner_name   = randPick(rng, OWNER_NAMES);
  const crisis       = randPick(rng, CRISIS_TYPES);

  // 7. Build initial game state — same shape as FM_INITIAL_STATE in App.jsx
  //    so it drops straight in as a replacement.
  const initialState = {
    // Financials
    cash_on_hand,
    monthly_sales,
    monthly_expenses:  monthly_burn,
    monthly_burn,
    debt_stress:       v.debt_stress,

    // Fixed costs
    rent_expense:        v.rent_expense,
    salary_expense:      v.salary_expense,
    electricity_expense: v.electricity_expense,

    // Business performance
    customer_footfall:  v.customer_footfall,
    profit_margin,
    dead_stock_units:   v.dead_stock_units,
    dead_stock_share:   parseFloat((v.dead_stock_units / 500).toFixed(2)),
    inventory_turnover: v.inventory_turnover,

    // Stakeholder metrics
    customer_satisfaction: v.customer_satisfaction,
    employee_morale:       v.employee_morale,
    supplier_relations:    v.supplier_relations,

    // Growth targets (dynamic)
    month_target_3,
    month_target_6,
    capital_invested:   v.capital_invested,
    cash_embezzled:     v.cash_embezzled,

    // Multipliers (unchanged)
    growth_base:             monthly_sales,
    footfall_multiplier:     1.0,
    conversion_multiplier:   1.0,
    momentum_multiplier:     1.0,
    month1_decision_impact:  0,
    month2_decision_impact:  0,
    month3_decision_impact:  0,

    // Game state
    current_month:     0,
    decisions_made:    0,
    path_taken:        [],
    checkpoint_passed: false,
    scaling_phase:     false,
    distress_phase:    false,
  };

  // 8. Build the opening scenario description with live numbers injected
  const openingDescription =
    `You walk into FreshMart as a CA intern. The owner, ${owner_name}, invested ` +
    `PKR ${fmt(v.capital_invested)} — but the business is in crisis. ` +
    `${crisis.flavour(v)} ` +
    `Now the store has PKR ${fmt(remaining_capital)} in remaining capital, ` +
    `mostly locked in ${v.dead_stock_units} slow-moving SKUs. ` +
    `Monthly sales stand at PKR ${fmt(monthly_sales)} against a burn rate of ` +
    `PKR ${fmt(monthly_burn)} (rent PKR ${fmt(v.rent_expense)} + ` +
    `salaries PKR ${fmt(v.salary_expense)} + electricity PKR ${fmt(v.electricity_expense)}). ` +
    `Profit margin is only ${pct(profit_margin)} due to competitor pressure. ` +
    `The owner needs PKR ${fmt(month_target_3)} sales by Month 3 and ` +
    `PKR ${fmt(month_target_6)} by Month 6 to recover his investment. ` +
    `What's your first move?`;

  // 9. Context panel entries (replaces the hardcoded CASE_GROCERY.context array)
  const contextEntries = [
    { label: "Initial Investment",    value: `PKR ${fmt(v.capital_invested)}`, delta: "Owner's equity" },
    { label: "Monthly Rent",          value: `PKR ${fmt(v.rent_expense)}`,     delta: "Fixed — unavoidable" },
    { label: crisis.label,            value: `PKR ${fmt(v.cash_embezzled)}`,   delta: `${pct(v.cash_embezzled / v.capital_invested)} of total capital — gone` },
    { label: "Remaining Capital",     value: `PKR ${fmt(remaining_capital)}`,  delta: "Mostly locked in inventory" },
    { label: "Dead Stock SKUs",       value: `${v.dead_stock_units} units`,    delta: "Slow-moving, cash-blocking" },
    { label: "Current Monthly Sales", value: `PKR ${fmt(monthly_sales)}`,      delta: "Cannot cover burn rate" },
    { label: "Monthly Burn Rate",     value: `PKR ${fmt(monthly_burn)}`,       delta: `${pct(monthly_sales / monthly_burn * -1 + 1)} cash shortfall per month` },
    { label: "Profit Margin",         value: `${pct(profit_margin)}`,          delta: "Competitor pressure eroding margins" },
  ];

  // 10. XP reward multiplier — harder conditions = more XP ceiling
  const xpMultiplier = diff === "APEX" ? 1.5 : diff === "GROWTH" ? 1.2 : 1.0;

  // 11. Assemble the full session object
  return {
    // Identity
    session_id:        `fm-${seed.toString(16).slice(-8)}-${Date.now().toString(36)}`,
    template_id:       "freshmart-crisis-v1",
    seed,
    created_at:        new Date().toISOString(),
    difficulty:        diff,
    difficulty_label:  profile.label,

    // Flavour
    owner_name,
    crisis_type:       crisis.id,
    crisis_label:      crisis.label,
    crisis_icon:       crisis.icon,
    grimoire_concept:  crisis.grimoire_concept,

    // Live numbers used by the engine
    initialState,

    // UI helpers
    openingDescription,
    contextEntries,

    // Scoring
    xpMultiplier,
    xpTable: SESSION_XP_TABLE,

    // Progress (starts empty — Supabase will track updates)
    currentScenarioId: "start",
    path_taken:        [],
    decisions_made:    0,
    completed:         false,
    ending_type:       null,
    final_score:       null,
    xp_earned:         null,
    commission_earned: null,
  };
}

// ─── Supabase Helpers ─────────────────────────────────────────────

/**
 * Persists a new session to the `simulation_sessions` table.
 * Call this the moment the user clicks "Start Simulation".
 *
 * Required Supabase table schema:
 *   simulation_sessions (
 *     id            text primary key,
 *     user_id       uuid references auth.users,
 *     template_id   text,
 *     seed          bigint,
 *     difficulty    text,
 *     owner_name    text,
 *     crisis_type   text,
 *     initial_state jsonb,
 *     current_state jsonb,
 *     path_taken    jsonb,
 *     completed     boolean default false,
 *     ending_type   text,
 *     xp_earned     integer,
 *     commission_earned integer,
 *     xp_multiplier float,
 *     created_at    timestamptz default now(),
 *     updated_at    timestamptz default now()
 *   )
 */
export async function startSession(supabase, userId, session) {
  const { data, error } = await supabase
    .from("simulation_sessions")
    .insert({
      id:               session.session_id,
      user_id:          userId,
      template_id:      session.template_id,
      seed:             session.seed,
      difficulty:       session.difficulty,
      owner_name:       session.owner_name,
      crisis_type:      session.crisis_type,
      initial_state:    session.initialState,
      current_state:    session.initialState,   // starts identical to initial
      path_taken:       [],
      completed:        false,
      ending_type:      null,
      xp_earned:        null,
      commission_earned:null,
      xp_multiplier:    session.xpMultiplier,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Saves a decision step mid-simulation.
 * Call this after every choice the user makes.
 *
 * @param {object} supabase
 * @param {string} sessionId
 * @param {object} currentState  - Latest FM_INITIAL_STATE-shaped object
 * @param {string[]} pathTaken   - Array of decision IDs made so far
 */
export async function saveDecision(supabase, sessionId, currentState, pathTaken) {
  const { error } = await supabase
    .from("simulation_sessions")
    .update({
      current_state: currentState,
      path_taken:    pathTaken,
      updated_at:    new Date().toISOString(),
    })
    .eq("id", sessionId);

  if (error) throw error;
}

/**
 * Marks a session as complete and awards XP + commission.
 * Also triggers the Grimoire upsert for each concept unlocked.
 *
 * @param {object} supabase
 * @param {string} sessionId
 * @param {string} endingType   - "perfect" | "good" | "struggle" | "bad"
 * @param {object} finalState
 * @param {number} finalScore   - 0–100 from calculateRecoveryScore()
 * @param {number} xpMultiplier - from session.xpMultiplier
 * @param {string[]} pathTaken
 * @param {string} userId
 */
export async function completeSession(
  supabase,
  sessionId,
  endingType,
  finalState,
  finalScore,
  xpMultiplier,
  pathTaken,
  userId
) {
  const rewards    = SESSION_XP_TABLE[endingType] ?? SESSION_XP_TABLE.bad;
  const xp_earned  = Math.round(rewards.xp * xpMultiplier);
  const commission = Math.round(rewards.commission * xpMultiplier);

  // 1. Update the session row
  const { error: sessionError } = await supabase
    .from("simulation_sessions")
    .update({
      completed:         true,
      ending_type:       endingType,
      final_score:       Math.round(finalScore),
      xp_earned,
      commission_earned: commission,
      current_state:     finalState,
      path_taken:        pathTaken,
      updated_at:        new Date().toISOString(),
    })
    .eq("id", sessionId);

  if (sessionError) throw sessionError;

  // 2. Credit XP + commission to user profile using standard Supabase operations
  const { data: currentProfile, error: fetchError } = await supabase
    .from("profiles")
    .select("xp, commission")
    .eq("id", userId)
    .single();
    
  if (fetchError) {
    console.warn("Error fetching current profile:", fetchError.message);
  } else {
    const { error: xpError } = await supabase
      .from("profiles")
      .update({
        xp: (currentProfile.xp || 0) + xp_earned,
        commission: (currentProfile.commission || 0) + commission
      })
      .eq("id", userId);
      
    if (xpError) console.warn("XP increment error:", xpError.message);
  }

  // 3. Unlock Grimoire concepts from path taken
  const conceptsUnlocked = pathTaken
    .map((decisionId) => PATH_CONCEPT_MAP[decisionId])
    .filter(Boolean);

  for (const concept of conceptsUnlocked) {
    await upsertGrimoireEntry(supabase, userId, concept.slug, concept.label, sessionId);
  }

  return { xp_earned, commission, conceptsUnlocked };
}

/**
 * Adds a concept to the user's Grimoire (or updates the timestamp if already present).
 *
 * Required Supabase table schema:
 *   grimoire_entries (
 *     id           uuid default gen_random_uuid() primary key,
 *     user_id      uuid references auth.users,
 *     concept_slug text,
 *     concept_label text,
 *     source_session_id text,
 *     earned_at    timestamptz default now(),
 *     UNIQUE(user_id, concept_slug)
 *   )
 */
export async function upsertGrimoireEntry(supabase, userId, conceptSlug, conceptLabel, sessionId) {
  const { error } = await supabase
    .from("grimoire_entries")
    .upsert(
      {
        user_id:           userId,
        concept_slug:      conceptSlug,
        concept_label:     conceptLabel,
        source_session_id: sessionId,
        earned_at:         new Date().toISOString(),
      },
      { onConflict: "user_id,concept_slug" }
    );

  if (error) console.warn("Grimoire upsert error:", error.message);
}

/**
 * Loads an in-progress session from Supabase.
 * Use this to resume a session if user navigates away mid-sim.
 */
export async function loadSession(supabase, sessionId) {
  const { data, error } = await supabase
    .from("simulation_sessions")
    .select("*")
    .eq("id", sessionId)
    .single();

  if (error) throw error;
  return data;
}

// ─── Formatting Helpers (internal) ────────────────────────────────
function fmt(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(0)}K`;
  return String(Math.round(n));
}
function pct(n) {
  return `${Math.round(n * 100)}%`;
}