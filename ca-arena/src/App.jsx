import { useState, useEffect, useRef, createContext, useContext } from "react";
import { supabase } from "./lib/supabase";

/* ═══════════════════════════════════════════════════════════════════
   SUPABASE CONFIG  ← paste your real values here
   Supabase Dashboard → Settings → API
═══════════════════════════════════════════════════════════════════ */

/* Inline Supabase REST client (no npm needed in this environment) */
/* ─── User Context (flows through entire app) ─────────────────── */
const UserCtx = createContext(null);
function useUser(){ return useContext(UserCtx); }

const XP_REWARD = { SEED:80, GROWTH:150, APEX:250 };
function xpToRank(xp){ return xp>=10000?"APEX":xp>=5000?"GROWTH":"SEED"; }



/* ═══════════════════════════════════════════════════════════════════
   DESIGN TOKENS
═══════════════════════════════════════════════════════════════════ */
const T = {
  gold:"#F4C430", goldD:"#F4C43018", goldM:"#F4C43055",
  blue:"#4FC3F7", blueD:"#4FC3F714",
  red:"#FF5252", redD:"#FF525212",
  green:"#3DEB8A", greenD:"#3DEB8A10",
  orange:"#FF9800",
  bg:"#060608", surf:"#0d0d10", surf2:"#111116", border:"#1c1c22", mid:"#252530",
  txt:"#f0f0f0", dim:"#4a4a58", muted:"#1e1e26",
  mono:"'IBM Plex Mono',monospace",
  serif:"'Playfair Display',Georgia,serif",
  sans:"'IBM Plex Sans',sans-serif",
};
const DC = { SEED:"#3DEB8A", GROWTH:"#F4C430", APEX:"#FF5252" };

const css = `
@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;700&family=IBM+Plex+Sans:wght@400;600;700&family=Playfair+Display:wght@700;900&display=swap');
*{box-sizing:border-box;margin:0;padding:0;}
@keyframes ticker{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.18}}
@keyframes fadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}
@keyframes flash{0%{opacity:1}50%{opacity:.4}100%{opacity:1}}
::-webkit-scrollbar{width:3px;background:#060608;}
::-webkit-scrollbar-thumb{background:#252530;}
input:focus,button:focus{outline:none;}
`;

/* ═══════════════════════════════════════════════════════════════════
   ── FRESHMART BRANCHING SIMULATION DATA ──
═══════════════════════════════════════════════════════════════════ */
const FM_INITIAL = {
  cash:2000000, monthlySales:280000, inventory:22000000,
  customerCount:140, staffMorale:45, ownerStress:82, rentArrears:0,
};
const RENT = 400000;
const FM_STAT_META = {
  cash:         {label:"Liquid Cash",     fmt:"money", icon:"💰", good:"high"},
  monthlySales: {label:"Monthly Sales",   fmt:"money", icon:"📈", good:"high"},
  inventory:    {label:"Inventory Value", fmt:"money", icon:"📦", good:"mid"},
  customerCount:{label:"Daily Footfall",  fmt:"num",   icon:"👥", good:"high"},
  staffMorale:  {label:"Staff Morale",    fmt:"pct",   icon:"😐", good:"high"},
  ownerStress:  {label:"Owner Stress",    fmt:"pct",   icon:"😰", good:"low"},
};
const FM_STAT_KEYS = ["cash","monthlySales","inventory","customerCount","staffMorale","ownerStress"];

function fmtMoney(v){
  const a=Math.abs(v);
  if(a>=1e6) return `${(v/1e6).toFixed(1)}M`;
  if(a>=1e3) return `${(v/1e3).toFixed(0)}K`;
  return String(Math.round(v));
}
function fmtStat(key,v){
  const m=FM_STAT_META[key];
  if(m.fmt==="money") return `PKR ${fmtMoney(v)}`;
  return `${Math.round(v)}`;
}
function statHealth(key,v){
  if(key==="cash") return v>=1500000?"good":v>=600000?"warn":"bad";
  if(key==="monthlySales") return v>=400000?"good":v>=260000?"warn":"bad";
  if(key==="inventory") return v<=10000000?"good":v<=18000000?"warn":"bad";
  if(key==="customerCount") return v>=120?"good":v>=70?"warn":"bad";
  if(key==="staffMorale") return v>=60?"good":v>=35?"warn":"bad";
  if(key==="ownerStress") return v<=50?"good":v<=70?"warn":"bad";
  return "good";
}
const HC={good:T.green,warn:T.gold,bad:T.red,neutral:T.blue};

const Nodes = {

  /* ══ MONTH 1 ══════════════════════════════════════════════════ */
  start:{
    id:"start", month:1, title:"Day 1 in the Crisis",
    situation:`You walk into FreshMart Monday morning. The cashier who stole PKR 5 million is gone. Liquid cash: PKR 2M — barely 5 months of rent. Shelves hold 400+ products, many unmoved for weeks. Monthly sales: PKR 280,000 — not covering the PKR 400,000 rent. You have one month before the first cash shortfall. What's your first move?`,
    choices:[
      {id:"a",label:"Raise prices across the board",desc:"Margins are thin — charge 15–20% more on everything.",impact:{monthlySales:-90000,customerCount:-42,ownerStress:+8,staffMorale:-5},next:"raise_prices"},
      {id:"b",label:"Launch a clearance sale",desc:"Slash slow-moving items 30–40%. Convert inventory to cash fast.",impact:{cash:+650000,monthlySales:+180000,inventory:-3200000,customerCount:+35,staffMorale:+10,ownerStress:-12},next:"clearance"},
      {id:"c",label:"Take out a PKR 5M business loan",desc:"Bank financing to cover operations and restock variety.",impact:{cash:+5000000,inventory:+2000000,ownerStress:+15,staffMorale:+5},next:"loan",debtAdded:5000000},
      {id:"d",label:"Wait — let word of mouth build",desc:"Prime location. Customers will find you. Give it time.",impact:{cash:-400000,monthlySales:-20000,customerCount:-8,staffMorale:-12,ownerStress:+18},next:"wait"},
    ],
  },

  /* ══ RAISE PRICES PATH ════════════════════════════════════════ */
  raise_prices:{
    id:"raise_prices", month:2, title:"The Price Hike Backfires",
    narrative:`You raised prices 18% across the board. Within two weeks, regulars noticed. Three customers told you directly: "D-Mart two blocks away is cheaper." Footfall dropped sharply. Sales fell to PKR 190,000 — worse than before. Staff morale fell watching empty aisles.`,
    situation:`Customer trust burned, sales worsened, inventory unchanged. ~3 months of cash left at this burn rate. New direction needed urgently.`,
    choices:[
      {id:"a",label:"Reverse prices + run a 'Sorry Sale'",desc:"Own the mistake publicly. Win customers back with a promotional event.",impact:{monthlySales:+120000,customerCount:+38,ownerStress:-8,staffMorale:+8,cash:-80000},next:"sorry_sale"},
      {id:"b",label:"Double down — target premium customers",desc:"The location IS premium. Refocus on quality products and higher-income shoppers.",impact:{monthlySales:-40000,customerCount:-30,inventory:-500000,ownerStress:+20,staffMorale:-15},next:"premium_fail"},
      {id:"c",label:"Cut below market — flood store with customers first",desc:"Aggressive below-cost pricing to build habits, profit later.",impact:{monthlySales:+160000,customerCount:+60,cash:-300000,inventory:-1500000,staffMorale:+5,ownerStress:+5},next:"below_market"},
    ],
  },
  sorry_sale:{
    id:"sorry_sale", month:3, title:"Customers Forgive — Now Fix the Real Problem",
    narrative:`The Sorry Sale worked socially — footfall partially recovered. But the issue was never prices. PKR 22M is still frozen in slow stock while PKR 400K rent drains monthly. Sales improved but remain below breakeven.`,
    situation:`Customer relationship stabilised. The inventory constraint stares you down. 400 slow-moving SKUs. What do you do?`,
    choices:[
      {id:"a",label:"Apply Pareto — cut to 80 fast-moving SKUs, liquidate the rest",desc:"Identify top sellers, liquidate everything else, restock only what sells fast.",impact:{cash:+3800000,inventory:-9000000,monthlySales:+220000,customerCount:+20,staffMorale:+12,ownerStress:-25},next:"end_recovered"},
      {id:"b",label:"Negotiate returns with suppliers first",desc:"Call suppliers. Ask for credit notes or returns on slow-moving items.",impact:{cash:+1200000,inventory:-4000000,ownerStress:-10,staffMorale:+5},next:"end_recovered_slow"},
    ],
  },
  premium_fail:{
    id:"premium_fail", month:3, title:"The Premium Pivot Collapses", isWarning:true,
    narrative:`You rebranded mentally as 'premium' but made no physical changes. Premium shoppers go to actual delis — not a mart with stock in distributor packaging. Sales fell to PKR 150,000. You missed rent for the first time. The landlord called. Staff unpaid on time.`,
    situation:`Critical cash crisis. Rent arrears: PKR 250,000. Staff morale collapsing. ~6 weeks before the landlord takes action. You need cash NOW.`,
    choices:[
      {id:"a",label:"Emergency liquidation — everything 50% off",desc:"Survival mode. Sell everything at deep discount to stop the bleeding now.",impact:{cash:+2800000,inventory:-8000000,monthlySales:+300000,customerCount:+80,rentArrears:-250000,ownerStress:-20,staffMorale:+15},next:"end_emergency_survived"},
      {id:"b",label:"Approach landlord — defer rent 60 days",desc:"Negotiate a payment plan. Buy restructuring time.",impact:{cash:+400000,ownerStress:+15,staffMorale:-5},next:"end_landlord_path"},
    ],
  },
  below_market:{
    id:"below_market", month:3, title:"Footfall Up — Bleeding Cash",
    narrative:`Below-market pricing worked for footfall — the store is visibly busier. But you're selling below cost. Every transaction loses money at gross margin. Cash is draining fast — PKR 440,000 in sales but spending more than that in COGS and rent combined.`,
    situation:`Proved the location works. But below-cost pricing is unsustainable. Fix price point and inventory mix now or the cash runs out.`,
    choices:[
      {id:"a",label:"Normalize to market prices — keep the customer base",desc:"Gradually bring prices to competitive market rates while habit is built.",impact:{monthlySales:-60000,customerCount:-15,cash:+150000,inventory:-1000000,ownerStress:-10},next:"end_normalize_then_pareto"},
      {id:"b",label:"Apply Pareto — drop losers, focus on profitable SKUs",desc:"Drop 300 slow products. Keep 80–100 fast-moving ones at healthy margins.",impact:{cash:+2200000,inventory:-7000000,monthlySales:+80000,staffMorale:+12,ownerStress:-18},next:"end_recovered"},
    ],
  },

  /* ══ CLEARANCE PATH ═══════════════════════════════════════════ */
  clearance:{
    id:"clearance", month:2, title:"Cash Moving — Inventory Still Deep",
    narrative:`The clearance created real buzz. You converted PKR 3.2M inventory into PKR 650K cash — value recovery wasn't great but the cash is liquid now. Monthly sales jumped. But PKR 18.8M in slow stock remains and the underlying model isn't fixed yet.`,
    situation:`Good first move. Cash breathing room exists. Now — what do you do with the remaining inventory and the broken model?`,
    choices:[
      {id:"a",label:"Restock more variety — fill the gaps",desc:"You've freed shelf space. New products might be what customers actually wanted.",impact:{cash:-600000,inventory:+2500000,monthlySales:+30000,customerCount:+10,ownerStress:+10},next:"restock_mistake"},
      {id:"b",label:"Apply Pareto — restock only the 20 best sellers",desc:"Data shows which products moved fastest. Go deep on those. Stop the long tail.",impact:{cash:-350000,inventory:-6000000,monthlySales:+180000,customerCount:+28,staffMorale:+15,ownerStress:-20},next:"end_recovered"},
      {id:"c",label:"Install a POS system first — get real data",desc:"Prevent another fraud. Know exactly what sells. Cost: PKR 80,000.",impact:{cash:-80000,staffMorale:+8,ownerStress:-15},next:"pos_install"},
    ],
  },
  restock_mistake:{
    id:"restock_mistake", month:3, title:"Same Mistake, Second Time", isWarning:true,
    narrative:`You restocked variety. Three weeks later, most new products haven't moved either. You've recreated the original problem — capital trapped in slow inventory — but with less cash. The clearance bought time that you've spent digging the same hole.`,
    situation:`The inventory problem is structural. Variety isn't the answer — velocity is. Make the hard call now or face closure.`,
    choices:[
      {id:"a",label:"Apply Pareto — finally cut to fast movers only",desc:"Late but not too late. Liquidate everything, rebuild around velocity.",impact:{cash:+1800000,inventory:-7500000,monthlySales:+150000,customerCount:+15,ownerStress:-15},next:"end_recovered_late"},
      {id:"b",                                        // ← ADD THIS
      label:"Try a different variety — maybe the wrong products were chosen",
      desc:"You still believe the answer is finding the RIGHT products. Order a new range.",
      impact:{cash:-900000,inventory:+3000000,monthlySales:+20000,ownerStress:+25,staffMorale:-10},
      next:"end_closure",                            // ← new bad ending
      },
    ],
  },
  pos_install:{
    id:"pos_install", month:3, title:"Data Changes Everything",
    narrative:`POS went live. Within 2 weeks: your top 10 SKUs represent 67% of revenue. 380 products haven't sold a single unit in 3 weeks. The data makes the next decision obvious. Cash reconciliation is automatic — staff accountability built in.`,
    situation:`The data told you exactly what to do. Act on it.`,
    choices:[
      {id:"a",label:"Execute Pareto immediately — data-backed this time",desc:"Liquidate 320 dead-weight SKUs. Restock winners 3× deeper.",impact:{cash:+2600000,inventory:-8500000,monthlySales:+240000,customerCount:+30,ownerStress:-22,staffMorale:+14},next:"end_recovered"},
    ],
  },

  /* ══ LOAN PATH ════════════════════════════════════════════════ */
  loan:{
    id:"loan", month:2, title:"Cash in Hand — New Monster Created", isWarning:true,
    narrative:`Bank approved PKR 5M at 22% p.a. Monthly interest: ~PKR 91,000. Fixed obligations now PKR 491,000/month against PKR 280,000 in sales. The loan didn't fix inventory, sales, or controls. It added a ticking clock on top of an already burning house.`,
    situation:`Cash feels comfortable but you've added PKR 91K/month to a business that couldn't cover existing fixed costs. Make this capital work immediately or this loan becomes the final problem.`,
    choices:[
      {id:"a",label:"Use loan to aggressively market the store",desc:"Drive footfall with leaflets, social media, and deals.",impact:{cash:-200000,monthlySales:+120000,customerCount:+55,ownerStress:-5},next:"marketing_push"},
      {id:"b",label:"Use loan to restructure — liquidate and restock right",desc:"Treat it as restructuring capital. Fix the model, not just the cash gap.",impact:{cash:-400000,inventory:-8000000,monthlySales:+200000,customerCount:+30,staffMorale:+10,ownerStress:-10},next:"loan_restructure"},
      {id:"c",label:"Restock more variety with the loan",desc:"Wide variety was the original vision. More products, more customers.",impact:{cash:-3000000,inventory:+5000000,monthlySales:+40000,customerCount:+12,ownerStress:+12},next:"loan_disaster"},
    ],
  },
  loan_disaster:{
    id:"loan_disaster", month:3, title:"PKR 5M Loan + More Variety = Bigger Problem",
    narrative:`You now have PKR 27M in inventory across 500+ SKUs. Monthly obligations: PKR 491,000. Monthly sales: PKR 320,000. The gap grows each month. Interest compounds. A supplier calls about a delayed payment. Staff sense the panic.`,
    situation:`Classic entrepreneur trap: borrowing to scale a broken model. Each month adds more interest than the business earns above breakeven. There is no soft landing from here.`,
    isEnding:true, endingType:"bad", endingTitle:"The Debt Spiral",
    endingText:`By Month 5, FreshMart owes PKR 5M principal + PKR 455,000 accumulated interest. Monthly cash burn exceeds revenue by PKR 171,000. Forced liquidation at 40 paisa on the rupee.\n\nTotal loss beyond the original fraud: ~PKR 8.2 million.\n\nWhat went wrong: A loan is an amplifier — it makes good strategies better and bad strategies catastrophically worse. You needed to fix velocity before adding capital. Instead you added capital before finding velocity.`,
    keyInsights:["Never borrow to scale a broken model","Working capital velocity must come before debt capital","Variety does not create velocity — it destroys it","Sunk cost fallacy: doubling down costs more than admitting the mistake","The loan revealed the constraint — it didn't create it"],
  },
  loan_restructure:{
    id:"loan_restructure", month:3, title:"Loan Used Wisely — Model Shifts",
    narrative:`Using the loan for structured liquidation and restock was the right call. Cleared PKR 8M in slow inventory (recovered PKR 2.1M), then restocked 40 fastest-moving SKUs in depth. Sales jumped to PKR 480,000 — above breakeven for the first time. Interest cost is manageable at this sales level.`,
    situation:`You've crossed breakeven. The loan must now be paid down. What's the priority with the surplus?`,
    choices:[
      {id:"a",label:"Channel surplus directly to loan repayment",desc:"At 22% interest, early repayment has guaranteed ROI. Get out of debt fast.",impact:{cash:-300000,ownerStress:-20,staffMorale:+8},next:"end_optimal"},
      {id:"b",label:"Reinvest surplus into expanding the fast-moving category",desc:"You've found what works. Scale it — more depth on winning SKUs.",impact:{cash:-250000,monthlySales:+120000,inventory:+1500000,customerCount:+25},next:"end_recovered"},
    ],
  },
  marketing_push:{
    id:"marketing_push", month:3, title:"Footfall Up — Inventory Still the Barrier",
    narrative:`Marketing worked — daily customers jumped past 200. But they browse 400 products and leave with PKR 300 of essentials. The wide inventory looks impressive but doesn't convert. You're paying PKR 91K/month in interest and generated PKR 120K more in sales — still not enough. The inventory mix is the real barrier.`,
    situation:`Marketing proved the location works. Now fix what customers see when they arrive.`,
    choices:[
      {id:"a",label:"Restructure inventory around what customers actually bought",desc:"Sales data shows your top 30 items. Double down on those. Remove the rest.",impact:{cash:+1500000,inventory:-6000000,monthlySales:+200000,customerCount:+15,ownerStress:-15},next:"end_recovered"},
    ],
  },

  /* ══ WAIT PATH ════════════════════════════════════════════════ */
  wait:{
    id:"wait", month:2, title:"Waiting Cost You a Month You Couldn't Afford", isWarning:true,
    narrative:`Nothing changed except your cash worsened. Spent PKR 400K on rent, PKR 180K on utilities and salaries, generated PKR 260K in sales. Net burn: PKR 320,000. Inventory one month older. Staff morale dropped. A supplier called about payment terms.`,
    situation:`Cash now PKR 1.68M. At this burn rate: ~4 months before you cannot pay rent. Urgency is now critical. Every week of inaction is expensive.`,
    choices:[
      {id:"a",label:"Emergency clearance — 35% off, generate cash NOW",desc:"Reactive but better late than never. Create urgency with time-limited promotions.",impact:{cash:+480000,inventory:-2800000,monthlySales:+200000,customerCount:+40,staffMorale:+8,ownerStress:-10},next:"clearance"},
      {id:"b",
        label:"Cut costs AND keep waiting — sales will pick up",
        desc:"Reduce expenses and give it one more month. The location is too good to fail.",
        impact:{cash:-700000,monthlySales:-20000,customerCount:-12,staffMorale:-22,ownerStress:+28},
        next:"end_closure",                              // ← direct to closure now
      },
    ],
  },
  cost_cut:{
    id:"cost_cut", month:3, title:"Cutting Costs Without Fixing Revenue — Slow Death",
    isWarning:true,
    narrative:`You cut staff hours and electricity. Saved PKR 120K/month. But the dimmer, quieter store feels unwelcoming — sales fell to PKR 230,000. Net burn still PKR 270K/month. You extended the runway by a few weeks but addressed neither root cause.`,
    situation:`Cost cutting cannot fix a revenue problem. You've burned another month. Fundamental intervention or closure — those are the only two paths left.`,
    choices:[
      {
        id:"a",
        label:"Full Pareto restructure — liquidate everything and rebuild",
        desc:"Accept the inventory write-down. Rebuild lean, velocity-focused, with controls.",
        impact:{cash:+2100000,inventory:-8000000,monthlySales:+220000,customerCount:+35,ownerStress:-30,staffMorale:+18},
        next:"end_recovered_late",
      },
      {
        id:"b",
        label:"Keep cutting costs — wait for peak season to save the business",
        desc:"There's a wedding season coming. If sales spike naturally the business survives without a painful restructure.",
        impact:{cash:-800000,monthlySales:-30000,customerCount:-20,staffMorale:-25,ownerStress:+30},
        next:"end_closure",
      },
    ],
  },

  /* ══ ENDINGS — all branches terminate here ════════════════════ */

  end_optimal:{
    id:"end_optimal", month:4, title:"FreshMart: Diagnosed, Fixed, Debt-Free",
    narrative:`You channelled every surplus rupee into loan repayment — PKR 300K/month of principal on top of running the lean restocked model. The loan cleared in under 5 months. Interest cost disappeared. FreshMart now runs profitably, debt-free, with PKR 280,000/month in net profit and a 3-month cash reserve built up. The fraud is a painful memory but the POS controls mean it cannot happen again.`,
    isEnding:true, endingType:"perfect", endingTitle:"Optimal Recovery",
    endingText:`Final position: PKR 280K/month net profit · Zero debt · PKR 1.2M cash reserve.\n\nYou made the correct diagnosis (liquidity trap, not fraud), used capital correctly (restructure, not gap-fill), and maintained discipline (debt repayment). The fraud loss will be recovered organically in under 18 months.\n\nThis is the optimal path — found by understanding constraints, not symptoms.`,
    keyInsights:["Root cause: liquidity trap from slow inventory — not the fraud","Loan as restructuring capital: valid only when the model is fixed first","Pareto principle: 20% of SKUs drove 80% of revenue","Debt discipline: 22% interest means every month of debt costs more than most employees","Controls: a PKR 80K POS system is cheaper than a PKR 5M embezzlement"],
  },
  
  end_closure:{
   id:"end_closure", month:4, title:"FreshMart Closes",
   narrative:`Cash hit zero in the third week of month 4. The landlord padlocked
              the shutters on Tuesday morning. Staff received a WhatsApp message
              informing them not to come in. Suppliers are owed PKR 1.8M.
              The owner is now personally liable for the outstanding rent.`,
   isEnding:true, endingType:"bad", endingTitle:"Business Closure",
   endingText:`Total loss: PKR ~PKR 9M (fraud + inventory write-off + outstanding obligations).\n\nWhat went wrong:\nThe business had a fixable problem — a liquidity trap from slow inventory. It was not terminal. But every month of wrong decisions (waiting, cost-cutting, variety restocking) consumed the cash buffer that would have funded a restructure.\n\nThe business didn't die because of the fraud. It died because the owner kept solving the wrong problem.\n\nThe fraud lost PKR 5M. The wrong decisions lost the remaining PKR 4M and the business itself.`,
   keyInsights:[
     "A fixable problem becomes unfixable when you run out of time to fix it",
     "Cost-cutting extends the runway but does not change the destination",
     "Variety is not a strategy — velocity is",
     "Every month of wrong decisions consumes the capital needed for the right one",
     "The sunk cost of the fraud was recoverable. The cost of inaction was not.",
    ],
  },

  end_recovered:{
    id:"end_recovered", month:4, title:"FreshMart Stabilised and Growing",
    narrative:`The Pareto restructure worked. PKR 9M in slow inventory became PKR 3.8M in cash. Fast-moving SKUs restocked 3× deeper — customers find what they came for. Basket size increased. Sales crossed PKR 520,000. Monthly surplus: PKR 120,000. POS installed, controls running, FIR filed against the cashier. The business is structurally sound.`,
    isEnding:true, endingType:"good", endingTitle:"Business Recovered",
    endingText:`Monthly profit: ~PKR 120,000 and growing. Fraud loss recoverable in ~42 months organically.\n\nFive lessons from this case:\n① Liquidity > variety — cash velocity beats product range every time\n② Fixed costs demand velocity, not hope or patience\n③ Pareto applies to retail: 20% of SKUs drove 80% of revenue\n④ Controls prevent recurrence — a PKR 80K system vs a PKR 5M loss\n⑤ The fraud was a trigger, not the disease — the disease was the inventory model`,
    keyInsights:["Liquidity trap: capital frozen in slow inventory, not lost in fraud","Pareto inventory restructure: velocity over variety","Fixed cost urgency: PKR 400K/month rent demands breakeven discipline","Internal controls: dual-authorisation + POS as fraud prevention","Sunk cost clarity: the fraud was a past loss, not the current constraint"],
  },

  end_recovered_slow:{
    id:"end_recovered_slow", month:4, title:"Recovered — The Long Way Around",
    narrative:`Supplier negotiations recovered PKR 1.2M — less than a clearance sale but with better supplier relationships preserved. Combined with a Pareto restock of top-velocity items, sales crossed breakeven. The path took an extra 3 weeks and cost PKR 800K in excess rent burn, but FreshMart is now operationally sound.`,
    isEnding:true, endingType:"good", endingTitle:"Recovered via Negotiation",
    endingText:`Monthly profit: ~PKR 80,000. Fraud loss recoverable in ~63 months at this rate.\n\nThe supplier negotiation path preserved relationships and avoided the reputational hit of a clearance sale — a legitimate trade-off. The delay cost money but the outcome is the same destination.\n\nKey distinction: clearance sales recover cash faster but at a discount. Supplier returns recover value at cost but take longer. Both beat holding slow stock.`,
    keyInsights:["Supplier relationships have balance-sheet value beyond credit terms","Pareto principle: focus on velocity, not variety","Opportunity cost of delay: every week of inaction = PKR 100K+ in rent","Cash recovery speed vs. value recovery: a genuine strategic trade-off","Breakeven is not a destination — it is the minimum floor"],
  },

  end_recovered_late:{
    id:"end_recovered_late", month:4, title:"Recovered — But Two Months Too Late",
    narrative:`The Pareto restructure worked. Sales above breakeven. The business is structurally sound now. But you burned PKR 800K in extra rent during the delay — two months of inaction that cost real money. The right move applied late is still far better than the wrong move applied promptly. But the cost of hesitation is visible in the depleted cash balance.`,
    isEnding:true, endingType:"good", endingTitle:"Recovered — With a Lesson About Time",
    endingText:`Monthly profit: ~PKR 60,000. Fraud loss recoverable in ~84 months at this rate.\n\nThe delay in applying the correct solution cost PKR 800K in unnecessary fixed cost burn. Time is not neutral in a business with high fixed costs.\n\nLesson: every month of inaction in a high-fixed-cost business is an irreversible cash expenditure. The sooner you diagnose the constraint, the less it costs to fix it.`,
    keyInsights:["Time is not neutral when fixed costs are high","The correct solution applied late still beats the wrong solution applied early","Cash burn during delay is permanent — you cannot recover it","Diagnosis speed is itself a financial skill","Fixed cost structures punish hesitation more than variable-cost businesses"],
  },

  end_emergency_survived:{
    id:"end_emergency_survived", month:4, title:"Survived — At Great Cost",
    narrative:`The emergency 50% sale flooded the store. Recovered PKR 2.8M cash across 10 days. Rent arrears cleared, staff paid. But you sold PKR 8M worth of inventory for PKR 2.8M — a 65% loss on those goods. The delay from the premium pivot cost enormously. Rebuilt on a lean velocity model, FreshMart now generates a small monthly surplus.`,
    isEnding:true, endingType:"good", endingTitle:"Survived the Delayed Intervention",
    endingText:`Monthly profit: ~PKR 40,000. The premium pivot cost PKR 5.8M in additional inventory write-down losses on top of the original fraud.\n\nThe business survived — but barely, and expensively. The total financial damage from choosing the wrong strategy and waiting too long: ~PKR 11M in combined fraud and strategic losses.\n\nLesson: in a crisis, the longer you delay the correct intervention, the more the wrong strategy costs.`,
    keyInsights:["Opportunity cost of wrong strategy: PKR 5.8M in additional losses","Premium positioning requires physical infrastructure — not just a mental rebrand","Emergency liquidation is a survival tool, not a growth tool","The premium pivot failed because it solved the wrong problem","Speed of course-correction is itself a business skill"],
  },

  end_landlord_path:{
    id:"end_landlord_path", month:4, title:"The Landlord's 60-Day Clock",
    narrative:`The landlord deferred PKR 400K for 60 days after a difficult conversation — full disclosure required, including the fraud. He respects the honesty. But he is clear: if month 5 rent doesn't arrive in full (plus the deferred amount), eviction begins. You used the 60 days to execute a full Pareto restructure. Sales crossed PKR 700,000 in the final week of the window. Month 5 rent cleared — barely.`,
    isEnding:true, endingType:"good", endingTitle:"Saved by Transparency and Speed",
    endingText:`Monthly profit: ~PKR 50,000 after clearing the deferred rent. Business is operational and structurally sound.\n\nThe landlord negotiation worked because of two things: honest disclosure (trust) and a credible action plan (competence). Neither alone would have been enough.\n\nLesson: in a financial crisis, creditors often respond better to honest early communication than to silence followed by default.`,
    keyInsights:["Creditor communication: honesty + action plan > silence + default","Deferred rent is not free money — it doubles the next payment","The Pareto restructure was the actual fix — the deferral just bought time for it","Transparency with stakeholders is a strategic asset in a crisis","Speed under deadline: a 60-day constraint forced the decision that should have happened on Day 1"],
  },

  end_normalize_then_pareto:{
    id:"end_normalize_then_pareto", month:4, title:"Stabilised Through Two Corrections",
    narrative:`Normalising prices held the customer base that below-cost pricing had built. Sales settled at PKR 420,000 — above breakeven for the first time. Then applying Pareto to the inventory freed another PKR 1.8M in cash and pushed monthly sales to PKR 560,000. Two corrections instead of one, but both were necessary.`,
    isEnding:true, endingType:"good", endingTitle:"Recovered via Sequential Fixes",
    endingText:`Monthly profit: ~PKR 130,000. Fraud loss recoverable in ~38 months.\n\nSometimes the right path requires sequential corrections rather than a single insight. The below-cost pricing proved the location; price normalisation made it sustainable; Pareto made it profitable. Each step was necessary.\n\nLesson: recognising which problem to solve first is as important as knowing the solutions.`,
    keyInsights:["Location value was real — below-market pricing proved it","Price normalisation: customers stay when convenience + habit are established","Sequential problem-solving: not every fix is simultaneous","Pareto inventory: the same 20/80 rule applied at every stage","Velocity is the single most important metric for a small retail business"],
  },
};

/* ═══════════════════════════════════════════════════════════════════
   ── CASE STUDY DATA ──
═══════════════════════════════════════════════════════════════════ */
const CASE_GROCERY = {
  id:"GRC-SEED-01", type:"scenario", subtype:"branching", difficulty:"SEED",
  company:"FreshMart Grocery", sector:"Retail · SME", timeLimit:720,
  synopsis:`FreshMart is a newly opened grocery mart in a prime urban location. The owner invested PKR 30 million, signed a PKR 400,000/month lease, lost PKR 5 million to a cashier who embezzled and absconded. Sales cannot cover operating costs. Capital is locked in slow-moving inventory. You are a business advisor brought in to diagnose constraints and recommend a recovery path.`,
  context:[
    {label:"Initial Investment",value:"PKR 30M",delta:"Owner's equity"},
    {label:"Monthly Rent",value:"PKR 400K",delta:"Fixed cost — unavoidable"},
    {label:"Cash Embezzled",value:"PKR 5M",delta:"16.7% of total capital — gone"},
    {label:"Remaining Capital",value:"PKR 25M",delta:"Mostly locked in inventory"},
    {label:"Inventory Turnover",value:"Slow",delta:"Wide variety, low velocity"},
    {label:"Current Monthly Sales",value:"PKR 280K",delta:"Cannot cover rent + ops"},
  ],
  questions:[
    {id:1,text:"What is the PRIMARY financial constraint currently strangling FreshMart's operations?",options:[{id:"a",text:"High fixed rent of PKR 400K/month creating an unmanageable break-even threshold",score:60},{id:"b",text:"Illiquid capital — most of the remaining PKR 25M is locked in slow-moving inventory, creating a severe cash flow crisis",score:100},{id:"c",text:"The PKR 5M fraud loss which has permanently damaged the business's financial foundation",score:50},{id:"d",text:"Poor location choice despite the owner believing it is prime real estate",score:15}],insight:"The fraud is a sunk cost — painful but done. The real ongoing crisis is a liquidity trap: capital is physically sitting on shelves as slow-moving stock while fixed costs demand cash every month. The inventory IS the constraint.",wrongMoves:{a:"Rent is a symptom of the cash problem, not the root cause. Chess analogy: you attacked the pawn when the queen was the threat.",c:"The PKR 5M loss is a sunk cost — it's already gone. Don't play the board that existed 3 moves ago.",d:"The location is actually an asset. This move would cause you to abandon a valuable piece."}},
    {id:2,text:"The owner wants to immediately restock more variety to attract customers. What is the most critical flaw in this thinking?",options:[{id:"a",text:"More variety increases SKU management complexity and storage costs without addressing velocity",score:70},{id:"b",text:"The owner doesn't have cash liquidity to restock — capital is already tied up in existing slow inventory",score:100},{id:"c",text:"Customers in prime urban locations prefer quality over variety",score:30},{id:"d",text:"Restocking variety will work, but only after the cashier situation is legally resolved",score:10}],insight:"Classic entrepreneur trap — doubling down on the wrong variable. The solution is the opposite: ruthlessly reduce SKUs to fast-moving essentials to generate velocity and cash cycle.",wrongMoves:{a:"Partially correct — but the deeper answer is the cash constraint makes this physically impossible first. Stopped one level too shallow.",c:"Unsupported assumption that doesn't address why restocking is the wrong move.",d:"Legal resolution and restocking decisions are separate tracks. Linking them creates false dependency."}},
    {id:3,text:"Which inventory strategy is the most appropriate immediate intervention for FreshMart's slow-moving stock?",options:[{id:"a",text:"Run a clearance sale — price slow-moving stock below cost to convert inventory into cash immediately",score:85},{id:"b",text:"Adopt Pareto: identify top 20% of SKUs generating 80% of sales, liquidate the rest, concentrate restocking on high-velocity items",score:100},{id:"c",text:"Negotiate consignment terms with suppliers — return unsold inventory to free up cash without loss",score:80},{id:"d",text:"Wait for seasonal demand to naturally clear slow-moving inventory before making structural changes",score:5}],insight:"Option B (Pareto/80-20) is the structured, analytically superior answer combining clearance logic with strategic repositioning. Options A and C are good tactical moves worth combining with B. Option D is dangerous — the mart cannot afford to wait while paying PKR 400K/month rent.",wrongMoves:{d:"Waiting while fixed costs burn through remaining capital is leaving your king exposed while calculating a distant attack. Each month of inaction costs PKR 400K+ minimum."}},
    {id:4,text:"Regarding the PKR 5M embezzlement — what is the correct multi-track response?",options:[{id:"a",text:"File FIR immediately, pursue civil recovery, AND implement internal controls (dual authorisation, daily cash reconciliation, POS) — legal and operational tracks as parallel, not sequential",score:100},{id:"b",text:"Focus entirely on operational recovery first — the legal process will take years and distract management",score:35},{id:"c",text:"Write off the PKR 5M as a bad debt expense and move on operationally",score:45},{id:"d",text:"Hire a forensic accountant to investigate before taking any legal or operational action",score:50}],insight:"The fraud has TWO consequences: (1) cash loss — managed operationally; (2) control weakness — fixed immediately or it happens again. A POS system at PKR 15–20K/month is cheaper than another embezzlement.",wrongMoves:{b:"Delaying legal action reduces recovery odds exponentially — evidence degrades, perpetrator moves away. You can walk and chew gum simultaneously.",c:"Write-offs are accounting treatment, not risk management. Completely ignores the internal control failure."}},
    {id:5,text:"Given all constraints, what is the single most important 30-day priority to stabilise FreshMart?",options:[{id:"a",text:"Renegotiate the lease to reduce the PKR 400K/month fixed cost burden",score:55},{id:"b",text:"Convert slow inventory to cash via clearance, concentrate on 15–20 fast-moving SKUs, implement basic POS controls, and use recovered cash for weekly restocking cycle",score:100},{id:"c",text:"Seek a business loan of PKR 5–10M to bridge the liquidity gap while operations stabilise",score:40},{id:"d",text:"Hire a professional manager to take over daily operations while the owner focuses on the fraud case",score:20}],insight:"The 30-day goal is survival through cash velocity. Every other action is secondary to stopping the cash bleed and generating a sustainable operating cycle. The sequence is: liquidate → shrink SKUs → restock fast-movers → weekly cycle.",wrongMoves:{a:"Lease negotiation is worth attempting but is slow, uncertain, and doesn't generate cash. Attacking a far-future square while pieces are under immediate threat.",c:"Borrowing to fund a broken model is dangerous — adds fixed obligation without fixing the velocity problem.",d:"Good managers can't fix a business that's structurally illiquid."}},
  ],
};

const CASE_MCB = {
  id:"MCB-APEX-01", type:"scenario", difficulty:"APEX", company:"MCB Bank Limited", sector:"Banking · PSX Listed", timeLimit:900,
  synopsis:`MCB Bank is evaluating expanding its SME lending portfolio by PKR 15 billion in FY2025 amid rising NPL ratios industry-wide. The CFO flags concerns over KIBOR spread compression while the Board is bullish on fee income diversification. You are the Financial Advisor presenting to the Risk Committee.`,
  context:[
    {label:"Net Interest Margin",value:"4.2%",delta:"▼ 0.3pp YoY"},
    {label:"NPL Ratio",value:"7.8%",delta:"▲ 1.1pp YoY"},
    {label:"Capital Adequacy Ratio",value:"14.6%",delta:"Regulatory min: 8.5%"},
    {label:"SME Book (current)",value:"PKR 38B",delta:"12% of total advances"},
    {label:"KIBOR (3-month)",value:"22.4%",delta:"▼ 180bps in 6 months"},
    {label:"Return on Equity",value:"18.3%",delta:"▼ from 22.1%"},
  ],
  questions:[
    {id:1,text:"Given rising NPL ratio and compressed NIM, what is the PRIMARY risk of expanding the SME book by PKR 15B?",options:[{id:"a",text:"Liquidity risk from maturity mismatch between SME loans and short-term deposits",score:70},{id:"b",text:"Credit concentration risk compounding existing NPL pressure, threatening Tier 1 CAR adequacy",score:100},{id:"c",text:"Reputational risk from perceived regulatory non-compliance with supabaseP SME targets",score:40},{id:"d",text:"Market risk from KIBOR volatility affecting variable-rate SME loan pricing",score:55}],insight:"The CAR at 14.6% has buffer, but PKR 15B in incremental SME assets (~100% RWA) would consume PKR 1.5–1.8B of Tier 1 capital while the NPL trajectory signals provisioning pressure ahead.",wrongMoves:{a:"Liquidity risk is real but secondary — MCB has a strong deposit franchise. The NPL + capital adequacy interaction is the acute threat.",c:"Regulatory compliance is a consideration, not the primary risk here."}},
    {id:2,text:"The CFO proposes 50% expansion via SME syndications. Which accounting concern should you flag first?",options:[{id:"a",text:"IFRS 9 Stage classification of originated vs. participated portions requires separate ECL models with different PD/LGD inputs",score:100},{id:"b",text:"supabaseP Prudential Regulations limit syndication exposure to 25% of a single borrower",score:65},{id:"c",text:"Fair value measurement of syndicated participations under IFRS 13 adds P&L volatility",score:50},{id:"d",text:"Consolidation of syndicate SPV entities may inflate gross assets on MCB's balance sheet",score:35}],insight:"IFRS 9 ECL staging for originated vs. participated tranches often uses different PD/LGD inputs — the participated portion may lack internal performance data, requiring proxy models that auditors will scrutinise.",wrongMoves:{b:"The supabaseP limit is a compliance point but not the primary accounting concern the CFO needs to flag."}},
    {id:3,text:"As KIBOR declines, what strategic recommendation best balances fee income diversification with NIM protection?",options:[{id:"a",text:"Lock in fixed-rate SME term loans now before KIBOR falls further",score:60},{id:"b",text:"Pivot expansion toward transactional SME accounts (cash management, trade finance) generating fee income independent of spread",score:100},{id:"c",text:"Delay expansion 2 quarters until KIBOR stabilises",score:55},{id:"d",text:"Hedge interest rate exposure via Interest Rate Swaps with counterparty banks",score:70}],insight:"Fee income from trade finance and cash management is KIBOR-agnostic. With NIM under structural pressure from the rate cycle, diversifying toward non-funded income is the textbook CFO response.",wrongMoves:{a:"Locking in fixed rates in a falling KIBOR environment could lock in elevated rates for borrowers, increasing credit risk."}},
  ],
};

const CASE_FS_SEED = {
  id:"FS-SEED-01", type:"financial", difficulty:"SEED",
  company:"Raheel's Hardware Store", sector:"Retail · Sole Trader", timeLimit:600,
  synopsis:"Raheel runs a small hardware store. Review his annual income statement and answer questions about profitability, cost management, and contribution margin analysis.",
  financials:{
    pnl:{title:"Income Statement — Year Ended Dec 2024 (PKR)",headers:["","Amount (PKR)","Notes"],rows:[["Sales Revenue","1,800,000","",false],["Cost of Goods Sold","(1,080,000)","60% of revenue",false],["GROSS PROFIT","720,000","Gross Margin: 40%",false],["Salaries & Wages","(240,000)","2 employees",false],["Rent","(120,000)","PKR 10K/month",false],["Utilities","(36,000)","",false],["Miscellaneous","(48,000)","",false],["TOTAL OPERATING EXPENSES","(444,000)","",false],["NET PROFIT","276,000","Net Margin: 15.3%",false]]},
  },
  ratios:{
    title:"Ratio Analysis",
    items:[
      {label:"Gross Margin",formula:"Gross Profit / Revenue",value:"40.0%",benchmark:"Industry avg: 45%",flag:"Below benchmark — COGS elevated",severity:"warn"},
      {label:"Net Margin",formula:"Net Profit / Revenue",value:"15.3%",benchmark:"Good for small retail (>10%)",flag:"Acceptable",severity:"ok"},
      {label:"Operating Cost Ratio",formula:"Total Opex / Revenue",value:"24.7%",benchmark:"Watch if revenue declines",flag:"Manageable",severity:"ok"},
      {label:"Salary as % Revenue",formula:"Salaries / Revenue",value:"13.3%",benchmark:"Typical: 10–15% for retail",flag:"Within range",severity:"ok"},
    ],
  },
  cashflow:{
    title:"Cash Flow (Estimated)",
    note:"No formal cash flow statement provided. The following is reconstructed from P&L — assumes no capex and no working capital changes.",
    items:[
      {label:"Net Profit",value:"276,000",type:"operating"},
      {label:"Add: Depreciation (not charged — estimated)",value:"60,000",type:"adjust",flag:"Missing — assets being used without cost recognition"},
      {label:"True Operating Cash Flow (est.)",value:"~216,000",type:"total"},
      {label:"Capex (assumed nil)",value:"0",type:"investing"},
      {label:"Free Cash Flow (est.)",value:"~216,000",type:"total"},
    ],
  },
  flags:[
    {label:"COGS at 60% of revenue",severity:"medium",note:"Industry avg for hardware is 55% — slightly elevated"},
    {label:"No depreciation charged",severity:"high",note:"Profit overstated — assets not accounted for"},
    {label:"Net margin 15.3%",severity:"low",note:"Reasonable for small retail"},
  ],
  questions:[
    {id:1,text:"Raheel's gross margin is 40%. What is the maximum price reduction possible before gross profit turns negative?",options:[{id:"a",text:"He can reduce prices by up to 40% — his full gross margin",score:100},{id:"b",text:"He can reduce prices by up to 15.3% — his net margin — before loss-making",score:60},{id:"c",text:"He cannot reduce prices at all — costs are already too high",score:10},{id:"d",text:"He can reduce prices by up to 25%",score:40}],insight:"Gross profit turns zero when selling price = COGS. Since COGS is 60% of revenue, the maximum price reduction before zero gross profit is 40%. Practically, he needs gross margin above ~24.7% to cover ops — so the practical floor is ~15%.",wrongMoves:{b:"Net margin is the floor for overall profitability, not gross profit specifically."}},
    {id:2,text:"No depreciation has been charged. What is the effect of this omission?",options:[{id:"a",text:"Net profit is overstated; assets overstated; true economic cost understated",score:100},{id:"b",text:"No real impact — depreciation is non-cash and doesn't affect actual cash",score:35},{id:"c",text:"Only relevant for tax purposes — no impact on financial analysis",score:20},{id:"d",text:"Net profit is understated because depreciation would be a tax deduction",score:15}],insight:"Depreciation allocates the cost of an asset over its useful life — it IS a real economic cost even though non-cash. Omitting it overstates profit and means the owner is drawing more than the business truly earns.",wrongMoves:{b:"'Non-cash' doesn't mean 'not real'. A chess player who ignores a slowly advancing pawn because it isn't attacking yet loses to it later."}},
    {id:3,text:"If Raheel wants to hire one more employee at PKR 15,000/month, at what minimum additional revenue does this hire break even?",options:[{id:"a",text:"PKR 180,000 — equal to the new salary cost",score:30},{id:"b",text:"PKR 450,000 — new salary (PKR 180K) covered by gross profit contribution at 40% margin",score:100},{id:"c",text:"PKR 180,000 — since salary is PKR 180K/year and net margin covers it",score:45},{id:"d",text:"Any revenue increase covers the hire since fixed costs are already paid",score:10}],insight:"At 40% gross margin, PKR 1 of revenue contributes PKR 0.40 gross profit. To generate PKR 180,000 gross profit (to pay the new salary), you need PKR 180,000 ÷ 0.40 = PKR 450,000 additional revenue. This is the contribution margin break-even calculation.",wrongMoves:{a:"PKR 180K in revenue only generates PKR 72K gross profit at 40% margin — far less than the PKR 180K salary.",c:"Confuses net margin with gross margin — the calculation operates at gross margin level."}},
  ],
};

const CASE_FS_GROWTH = {
  id:"FS-GRW-01", type:"financial", difficulty:"GROWTH",
  company:"Crescent Textile Mills Ltd.", sector:"Textiles · PSX Listed", timeLimit:900,
  synopsis:"Crescent Textile Mills is a mid-size PSX-listed textile exporter. Analyse the FY2024 consolidated financials across P&L and Balance Sheet. Identify trends, flag concerns, compute ratios, and interpret working capital dynamics.",
  financials:{
    pnl:{title:"Income Statement FY2024 vs FY2023 (PKR Millions)",headers:["","FY2024","FY2023","Δ%"],rows:[["Revenue","4,820","4,210","+14.5%",false],["Cost of Sales","(3,614)","(3,072)","+17.6%",true],["GROSS PROFIT","1,206","1,138","+6.0%",false],["Gross Margin","25.0%","27.0%","▼2.0pp",true],["Distribution Costs","(182)","(148)","+23.0%",true],["Admin Expenses","(124)","(118)","+5.1%",false],["Finance Costs","(312)","(198)","+57.6%",true],["Other Income","48","32","+50.0%",false],["PROFIT BEFORE TAX","636","706","▼9.9%",true],["Tax","(191)","(212)","▼9.9%",false],["NET PROFIT","445","494","▼9.9%",true],["EPS (PKR)","4.45","4.94","▼9.9%",true]]},
    bs:{title:"Balance Sheet as at Dec 2024 (PKR Millions)",headers:["","FY2024","FY2023"],rows:[["Fixed Assets (Net)","2,840","2,420"],["Intangibles","120","120"],["Inventory","980","720"],["Trade Receivables","640","510"],["Cash & Equivalents","88","210"],["TOTAL ASSETS","4,668","3,980"],["","",""],["Share Capital & Reserves","1,640","1,470"],["Long-term Loans","1,420","980"],["Short-term Borrowings","820","640"],["Trade Payables","488","620"],["Other Liabilities","300","270"],["TOTAL EQUITY & LIABILITIES","4,668","3,980"]]},
  },
  ratios:{
    title:"Key Ratio Analysis",
    items:[
      {label:"Current Ratio",formula:"Current Assets / Current Liabilities",value:"1.08x",benchmark:"Comfort zone: >1.5x",flag:"Dangerously thin — minor shock tips below 1.0x",severity:"bad"},
      {label:"Gross Margin",formula:"Gross Profit / Revenue",value:"25.0%",benchmark:"FY2023: 27.0%",flag:"▼2.0pp — cost inflation not passed to customers",severity:"warn"},
      {label:"Interest Coverage",formula:"EBIT / Finance Costs",value:"2.1x",benchmark:"Safe zone: >3.0x",flag:"Below safe zone — debt burden elevated",severity:"warn"},
      {label:"Net Debt / Equity",formula:"Net Debt / Total Equity",value:"1.36x",benchmark:"Sector avg: ~0.8x",flag:"Significantly above peers",severity:"bad"},
      {label:"Debtor Days",formula:"Receivables / Revenue × 365",value:"48 days",benchmark:"Industry: 35–40 days",flag:"Collecting slower than peers",severity:"warn"},
      {label:"Creditor Days",formula:"Payables / COGS × 365",value:"49 days",benchmark:"FY2023: 74 days",flag:"Paying suppliers much faster — credit terms tightened",severity:"bad"},
    ],
  },
  cashflow:{
    title:"Estimated Cash Flow Analysis (PKR Millions)",
    note:"Derived from balance sheet movements — no formal cash flow statement provided.",
    items:[
      {label:"Net Profit",value:"445",type:"operating"},
      {label:"Add: Depreciation (est.)",value:"180",type:"adjust"},
      {label:"Working Capital: Inventory increase",value:"(260)",type:"wc",flag:"Capital tied up in stock"},
      {label:"Working Capital: Receivables increase",value:"(130)",type:"wc",flag:"Slower collections"},
      {label:"Working Capital: Payables decrease",value:"(132)",type:"wc",flag:"Paying suppliers faster — loss of credit"},
      {label:"Operating Cash Flow (est.)",value:"~103",type:"total"},
      {label:"Capex (Fixed Asset increase + Dep.)",value:"(600)",type:"investing"},
      {label:"Free Cash Flow (est.)",value:"(497)",type:"total",flag:"Negative FCF — entirely debt-funded"},
    ],
  },
  flags:[
    {label:"Finance costs +57.6%",severity:"high",note:"Debt load growing faster than revenue"},
    {label:"Cash fell PKR 210M→88M",severity:"high",note:"Liquidity pressure despite profit"},
    {label:"Inventory up 36%",severity:"medium",note:"Potential slow-moving stock or over-procurement"},
    {label:"Trade payables DOWN despite growth",severity:"medium",note:"Paying suppliers faster — credit terms deteriorated"},
    {label:"Gross margin eroded 2pp",severity:"medium",note:"Cost inflation not passed to customers"},
  ],
  questions:[
    {id:1,text:"Revenue grew 14.5% but Net Profit fell 9.9%. Which line item is the PRIMARY driver of this profit compression?",options:[{id:"a",text:"Gross margin erosion of 2pp — cost of sales grew faster than revenue",score:60},{id:"b",text:"Finance costs surging 57.6% — from PKR 198M to PKR 312M, consuming PKR 114M of incremental income",score:100},{id:"c",text:"Distribution cost growth of 23% outpacing revenue growth",score:40},{id:"d",text:"Tax expense — effective rate increased",score:10}],insight:"Finance cost increase = PKR 114M. Gross profit increase = PKR 68M. The debt financing cost OUTWEIGHS the gross profit growth — every additional rupee of revenue is being outrun by interest expense.",wrongMoves:{a:"Gross margin erosion contributed ~PKR 96M less in incremental margin. Real but secondary to the financing cost spike.",d:"Tax fell proportionally with PBT — effective rate is unchanged."}},
    {id:2,text:"Calculate Crescent's Current Ratio using FY2024 data. What does it indicate?",options:[{id:"a",text:"Current Ratio = 1.31x — adequate liquidity, no concern",score:40},{id:"b",text:"Current Ratio ≈ 1.08x — dangerously thin; cash at PKR 88M against PKR 820M short-term debt means a minor demand shock could cause default",score:100},{id:"c",text:"Current Ratio = 0.88x — technically insolvent on current basis",score:55},{id:"d",text:"Cannot be calculated — insufficient data",score:0}],insight:"Current Assets = Inventory (980) + Receivables (640) + Cash (88) = PKR 1,708M. Current Liabilities ≈ Short-term borrowings (820) + Trade Payables (488) + other = ~PKR 1,580M. Ratio ≈ 1.08x. Cash has dropped 58% YoY.",wrongMoves:{a:"1.31x overstates coverage — check your current liabilities figure.",c:"Just below 1.0x is close but doesn't support full insolvency status yet."}},
    {id:3,text:"Trade payables DECLINED from PKR 620M to PKR 488M despite revenue growing 14.5%. Most likely explanation?",options:[{id:"a",text:"The company is becoming more efficient at paying suppliers, improving relationships",score:25},{id:"b",text:"Suppliers have reduced credit terms — possibly due to Crescent's weakened creditworthiness — forcing earlier payment and worsening the already tight liquidity position",score:100},{id:"c",text:"Revenue mix shifted to cash sales, reducing need for supplier credit",score:20},{id:"d",text:"Normal working capital fluctuation with no significance",score:5}],insight:"When a growing company pays suppliers FASTER, it usually means suppliers tightened terms — a red flag on perceived creditworthiness. Combined with rising debt, cash falling 58%, and inventory building, this signals a classic working capital squeeze.",wrongMoves:{a:"Paying suppliers faster is only 'efficient' if by choice. In this context — rising debt, falling cash — it strongly suggests compulsion, not strategy."}},
  ],
};

const CASE_FS_APEX = {
  id:"FS-APEX-01", type:"financial", difficulty:"APEX",
  company:"Engro Corporation Ltd.", sector:"Conglomerate · PSX Listed", timeLimit:1080,
  synopsis:"Analyse Engro Corporation's FY2024 consolidated financials across all three statements. Identify structural concerns, IFRS accounting issues, and make a capital allocation recommendation. Board-level complexity.",
  financials:{
    pnl:{title:"Consolidated Income Statement FY2024 (PKR Millions)",headers:["","FY2024","FY2023","Δ%"],rows:[["Revenue","382,450","341,200","+12.1%",false],["Cost of Sales","(298,310)","(261,400)","+14.1%",true],["GROSS PROFIT","84,140","79,800","+5.4%",false],["Gross Margin","22.0%","23.4%","▼1.4pp",true],["Distribution & Admin","(20,600)","(17,700)","+16.4%",false],["EBIT","63,440","62,300","+1.8%",false],["Finance Costs","(18,200)","(12,400)","+46.8%",true],["Share of Profit — JVs","4,100","5,600","▼26.8%",true],["PROFIT BEFORE TAX","49,340","55,500","▼11.1%",true],["Tax Expense","(14,230)","(14,900)","▼4.5%",false],["PAT","35,110","40,600","▼13.5%",true],["Non-controlling Interests","(8,100)","(7,400)","+9.5%",false],["PAT — Parent","27,010","33,200","▼18.7%",true],["EPS (PKR)","27.01","33.20","▼18.7%",true]]},
    bs:{title:"Balance Sheet Highlights (PKR Millions)",headers:["","FY2024","FY2023"],rows:[["PP&E","310,400","268,200"],["Goodwill & Intangibles","42,100","38,400"],["Investment in JVs","88,200","90,100"],["Inventory","28,400","22,100"],["Trade Receivables","38,600","31,200"],["Cash & Bank","22,100","32,400"],["TOTAL ASSETS","620,400","541,200"],["","",""],["Share Capital & Reserves","136,200","131,400"],["Non-controlling Interests","48,000","48,000"],["TOTAL EQUITY","184,200","179,400"],["Long-term Debt","198,500","142,300"],["Short-term Borrowings","88,400","67,100"],["Trade & Other Payables","149,300","152,400"],["TOTAL EQUITY & LIABILITIES","620,400","541,200"]]},
    cf:{title:"Cash Flow Summary (PKR Millions)",headers:["","FY2024","FY2023"],rows:[["Cash from Operations","52,400","61,200"],["Capital Expenditure","(38,900)","(22,400)"],["FREE CASH FLOW","13,500","38,800"],["Dividends Paid","(18,000)","(18,000)"],["Net New Borrowings","44,200","12,100"],["Net Change in Cash","(10,300)","10,200"]]},
  },
  ratios:{
    title:"Key Ratio Analysis",
    items:[
      {label:"Net Debt / EBITDA",formula:"(LT Debt + ST Borrowings − Cash) / EBITDA",value:"3.6x",benchmark:"Comfortable: <2.5x; Sector avg: ~2.0x",flag:"Elevated — capex-driven leverage buildup",severity:"bad"},
      {label:"Interest Coverage",formula:"EBIT / Finance Costs",value:"3.5x",benchmark:"Safe zone: >3.0x",flag:"Just above safe zone — declining",severity:"warn"},
      {label:"FCF Coverage (Dividend)",formula:"FCF / Dividends Paid",value:"0.75x",benchmark:">1.0x required for sustainability",flag:"Dividend not covered by FCF — debt-financed",severity:"bad"},
      {label:"Return on Equity",formula:"PAT (Parent) / Avg Equity",value:"14.9%",benchmark:"FY2023: 19.0%",flag:"Material decline — earnings compression",severity:"warn"},
      {label:"Goodwill / Total Equity",formula:"Goodwill / Total Equity",value:"22.9%",benchmark:"Watch: IAS 36 annual impairment test",flag:"JV profit decline is an impairment indicator",severity:"warn"},
      {label:"Net Debt / Equity",formula:"Net Debt / Total Equity",value:"1.43x",benchmark:"Sector avg: ~0.9x",flag:"Significantly above peers — leverage risk",severity:"bad"},
    ],
  },
  cashflow:{
    title:"Cash Flow Deep Dive (PKR Millions)",
    note:"Full cash flow statement available. Key analytical points below.",
    items:[
      {label:"Operating Cash Flow",value:"52,400",type:"operating"},
      {label:"Less: Capex",value:"(38,900)",type:"investing",flag:"74% of operating CF consumed by capex"},
      {label:"Free Cash Flow",value:"13,500",type:"total"},
      {label:"Dividends Paid",value:"(18,000)",type:"financing",flag:"PKR 4.5B shortfall — funded by debt"},
      {label:"Net New Borrowings",value:"44,200",type:"financing"},
      {label:"Net Cash Change",value:"(10,300)",type:"total",flag:"Cash fell despite PKR 44B new borrowings"},
      {label:"FCF Coverage Ratio",value:"0.75x",type:"kpi",flag:"CRITICAL: Dividend is debt-financed"},
      {label:"Capex Intensity",value:"10.2% of revenue",type:"kpi",flag:"Elevated — double FY2023 level"},
    ],
  },
  flags:[
    {label:"Finance costs +46.8% (PKR 18.2B)",severity:"high",note:"Debt-funded capex squeezing PBT"},
    {label:"JV profit ▼26.8%",severity:"high",note:"Engro Fertilizers under pressure — key earnings driver weakening"},
    {label:"FCF PKR 13.5B vs dividend PKR 18B",severity:"high",note:"Dividend not covered by FCF — funded by new debt"},
    {label:"Net Debt/EBITDA: 3.6x",severity:"medium",note:"Elevated vs. sector peers (~2.0x)"},
    {label:"Goodwill PKR 42.1B",severity:"medium",note:"IFRS IAS 36 annual impairment test required"},
  ],
  questions:[
    {id:1,text:"PAT attributable to parent fell 18.7% despite revenue +12.1%. Rank drivers by materiality (most to least impactful):",options:[{id:"a",text:"(1) Finance costs +PKR 5.8B  (2) JV profit decline −PKR 1.5B  (3) Gross margin erosion  (4) NCI increase",score:100},{id:"b",text:"(1) Gross margin erosion  (2) Finance costs  (3) JV decline  (4) NCI increase",score:45},{id:"c",text:"(1) Revenue growth slowing  (2) Opex growth  (3) Finance costs  (4) Tax",score:20},{id:"d",text:"(1) JV profit decline  (2) Finance costs  (3) NCI  (4) Gross margin",score:60}],insight:"Finance cost delta = PKR +5.8B. JV contribution delta = −PKR 1.5B. Gross profit growth = +PKR 4.3B (partially offsetting). NCI increase = −PKR 0.7B. The single biggest destroyer is the financing cost spike from the aggressive capex programme.",wrongMoves:{b:"Gross margin erosion actually ADDED PKR 4.3B in gross profit. The margin % fell but absolute gross profit rose. Don't confuse percentage change with absolute impact."}},
    {id:2,text:"FCF is PKR 13.5B but dividends paid are PKR 18B. A board member says operating cash flow of PKR 52B easily covers our dividend. How do you respond?",options:[{id:"a",text:"The board member is correct — operating cash flow is the right metric for dividend sustainability",score:15},{id:"b",text:"Operating CF is pre-capex. Capex of PKR 38.9B is not discretionary during expansion — FCF is the correct sustainability measure. At 0.75x FCF coverage, the dividend is debt-financed",score:100},{id:"c",text:"Agree partially — suggest reducing capex to improve FCF and maintain dividend",score:65},{id:"d",text:"Recommend cutting dividend to 0 immediately to preserve cash",score:40}],insight:"FCF = Operating CF − Capex. During a capex cycle, capex is NOT optional — it is a committed programme. The correct framing: FCF coverage ratio = 13,500/18,000 = 0.75x. The PKR 4.5B shortfall is funded by PKR 44.2B net new borrowings.",wrongMoves:{c:"Reducing capex mid-cycle has strategic costs — delays capacity, increases per-unit costs, may breach debt covenants. Not wrong but incomplete.",d:"Zero dividend is extreme and sends a severe signal to PSX investors. A phased reduction is the more defensible board recommendation."}},
    {id:3,text:"Goodwill stands at PKR 42.1B (up from PKR 38.4B). Under IFRS IAS 36, what is the key obligation and what concern arises from JV profit decline?",options:[{id:"a",text:"Goodwill must be amortised over 10 years under IFRS — the lack of amortisation is a compliance error",score:0},{id:"b",text:"Goodwill must be tested annually for impairment under IAS 36 regardless of indicators. JV profit falling 26.8% directly threatens impairment headroom of related CGUs",score:100},{id:"c",text:"Goodwill is only tested when there are indicators of impairment — no action needed unless losses occur",score:25},{id:"d",text:"Goodwill increased so there is clearly no impairment concern",score:5}],insight:"Under IFRS 3 + IAS 36: goodwill is NOT amortised — it is tested for impairment at least annually. JV profit declining 26.8% IS a potential impairment indicator. The auditor will require a VIU calculation using discounted future cash flows.",wrongMoves:{a:"IFRS expressly prohibits amortisation of goodwill. This is a fundamental IFRS knowledge error.",c:"IAS 36 requires annual testing for goodwill REGARDLESS of indicators — the annual test is mandatory, not conditional."}},
  ],
};

const ALL_CASES = {
  "GRC-SEED-01":CASE_GROCERY,
  "MCB-APEX-01":CASE_MCB,
  "FS-SEED-01":CASE_FS_SEED,
  "FS-GRW-01":CASE_FS_GROWTH,
  "FS-APEX-01":CASE_FS_APEX,
};

/* CASE_LIST and leaderboard/feed are now fetched live from Supabase.
   Fallback statics used only when DB is unreachable.               */
const CASE_LIST_FALLBACK = [
  {id:"GRC-SEED-01",label:"FreshMart Grocery",sub:"Business Scenario + Live Simulation",type:"scenario",diff:"SEED",sector:"Retail SME",avgScore:"71%",hasSim:true},
  {id:"MCB-APEX-01",label:"MCB Bank — SME Expansion",sub:"Business Scenario · Banking Strategy",type:"scenario",diff:"APEX",sector:"Banking",avgScore:"64%"},
  {id:"FS-SEED-01",label:"Raheel's Hardware Store",sub:"P&L · Contribution Margin",type:"financial",diff:"SEED",sector:"Sole Trader",avgScore:"82%"},
  {id:"FS-GRW-01",label:"Crescent Textile Mills",sub:"P&L + Balance Sheet + Ratio Analysis",type:"financial",diff:"GROWTH",sector:"Textiles PSX",avgScore:"68%"},
  {id:"FS-APEX-01",label:"Engro Corporation",sub:"Full 3-Statement + IFRS",type:"financial",diff:"APEX",sector:"Conglomerate PSX",avgScore:"54%"},
];

/* ═══════════════════════════════════════════════════════════════════
   SHARED UI ATOMS
═══════════════════════════════════════════════════════════════════ */
function Tag({children,color=T.gold,small,filled}){
  return <span style={{fontFamily:T.mono,fontSize:small?8:9,letterSpacing:2,color:filled?"#000":color,background:filled?color:"transparent",border:`1px solid ${color}44`,padding:small?"2px 6px":"3px 10px",display:"inline-block",flexShrink:0,lineHeight:1.4}}>{children}</span>;
}
function TopBar({label,sub,onBack,right}){
  return(
    <div style={{height:52,background:T.bg,borderBottom:`2px solid ${T.border}`,display:"flex",alignItems:"center",padding:"0 28px",gap:16,position:"sticky",top:0,zIndex:100,flexShrink:0}}>
      {onBack&&<button onClick={onBack} style={{background:"none",border:"none",color:T.dim,cursor:"pointer",fontFamily:T.mono,fontSize:11,letterSpacing:2,padding:0,transition:"color .15s"}} onMouseEnter={e=>e.currentTarget.style.color=T.gold} onMouseLeave={e=>e.currentTarget.style.color=T.dim}>← BACK</button>}
      {onBack&&<span style={{color:T.muted}}>|</span>}
      <span style={{fontFamily:T.mono,fontSize:10,color:T.gold,letterSpacing:3}}>{label}</span>
      {sub&&<span style={{fontFamily:T.mono,fontSize:9,color:T.dim,letterSpacing:1}}>{sub}</span>}
      <div style={{flex:1}}/>
      {right}
    </div>
  );
}
function HexBg(){
  return <svg style={{position:"absolute",inset:0,opacity:.05,pointerEvents:"none",width:"100%",height:"100%"}}><defs><pattern id="hx" x="0" y="0" width="60" height="52" patternUnits="userSpaceOnUse"><polygon points="30,2 58,17 58,47 30,62 2,47 2,17" fill="none" stroke="#F4C430" strokeWidth="0.8"/></pattern></defs><rect width="100%" height="100%" fill="url(#hx)"/></svg>;
}
function TickerBar({user}){
  const items=[
    "▸ CASES LIVE: 2,847",
    "▸ ACTIVE BOARDS: 34",
    user ? `▸ YOUR XP: ${user.xp.toLocaleString()}` : "▸ JOIN TO EARN XP",
    user ? `▸ RANK: ${user.rank}` : "▸ SIGN UP FREE",
    "▸ NEW CASE: Engro APEX",
    "▸ BOARDROOM LIVE: Lucky Cement",
  ];
  return <div style={{background:T.gold,padding:"5px 0",overflow:"hidden",borderBottom:"2px solid #000",flexShrink:0}}><div style={{display:"flex",gap:60,animation:"ticker 22s linear infinite",whiteSpace:"nowrap",paddingLeft:"100%",fontFamily:T.mono,fontSize:10,fontWeight:700,color:"#111",letterSpacing:1}}>{[...items,...items].map((t,i)=><span key={i}>{t}</span>)}</div></div>;
}

function LeaderboardPanel({leaderboard,currentUserId}){
  if(!leaderboard||!leaderboard.length){
    return(
      <div style={{background:T.surf,border:`2px solid ${T.border}`,padding:"20px 18px"}}>
        <div style={{fontFamily:T.mono,fontSize:8,color:T.dim,letterSpacing:3,marginBottom:14}}>GLOBAL RANK</div>
        <div style={{fontFamily:T.mono,fontSize:10,color:T.dim,textAlign:"center",padding:"20px 0"}}>Loading…</div>
      </div>
    );
  }
  return(
    <div style={{background:T.surf,border:`2px solid ${T.border}`,padding:"20px 18px"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
        <span style={{fontFamily:T.mono,fontSize:8,color:T.dim,letterSpacing:3}}>GLOBAL RANK</span>
        <Tag small color="#888">LIVE</Tag>
      </div>
      {leaderboard.map((p,i)=>{
        const isMe = p.id===currentUserId;
        return(
          <div key={p.id} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderBottom:i<leaderboard.length-1?`1px solid ${T.muted}`:"none",background:isMe?`${T.gold}06`:"transparent"}}>
            <span style={{fontFamily:T.mono,fontSize:11,color:i<3?T.gold:T.muted,fontWeight:800,width:18,textAlign:"right",flexShrink:0}}>{i+1}</span>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontFamily:T.sans,fontSize:12,color:isMe?T.gold:"#ccc",fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.username}{isMe?" ◀":""}</div>
              <div style={{fontFamily:T.mono,fontSize:7,color:T.dim,letterSpacing:1}}>{p.cases_completed} cases · <span style={{color:DC[p.rank]||T.dim}}>{p.rank}</span></div>
            </div>
            <div style={{textAlign:"right",flexShrink:0}}>
              <div style={{fontFamily:T.mono,fontSize:10,color:"#777",fontWeight:700}}>{p.xp.toLocaleString()}</div>
              <div style={{fontFamily:T.mono,fontSize:8,color:T.green}}>+{p.xp_gained_today||0}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function FeedPanel({feed}){
  const items = feed||[];
  return(
    <div style={{background:T.surf,border:`2px solid ${T.border}`,padding:"20px 18px"}}>
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14}}>
        <div style={{width:6,height:6,borderRadius:"50%",background:T.blue,animation:"pulse 1.3s infinite"}}/>
        <span style={{fontFamily:T.mono,fontSize:8,color:T.dim,letterSpacing:3}}>LIVE ACTIVITY</span>
      </div>
      {!items.length&&<div style={{fontFamily:T.mono,fontSize:10,color:T.muted,textAlign:"center",padding:"12px 0"}}>No activity yet</div>}
      {items.map((f,i)=>(
        <div key={i} style={{borderLeft:`2px solid ${f.type==="sim"?T.blue:f.type==="share"?T.green:T.muted}`,paddingLeft:10,marginBottom:12,paddingBottom:12,borderBottom:i<items.length-1?`1px solid ${T.muted}`:"none"}}>
          <div style={{fontFamily:T.sans,fontSize:11.5,color:"#666",lineHeight:1.5}}><span style={{color:T.gold,fontWeight:700}}>{f.username}</span>{" "}{f.action_text}</div>
          <div style={{fontFamily:T.mono,fontSize:8,color:T.muted,marginTop:2,letterSpacing:1}}>{f.time_ago}</div>
        </div>
      ))}
    </div>
  );
}

function XPBar({user}){
  if(!user) return(
    <div style={{background:T.surf,border:`2px solid ${T.border}`,padding:"14px 20px",display:"flex",alignItems:"center",gap:16}}>
      <div style={{fontFamily:T.mono,fontSize:10,color:T.dim}}>Sign in to track your XP and rank</div>
    </div>
  );
  const nextRankXp = user.rank==="SEED"?5000:user.rank==="GROWTH"?10000:99999;
  const prevRankXp = user.rank==="SEED"?0:user.rank==="GROWTH"?5000:10000;
  const pct = Math.min(100,Math.round(((user.xp-prevRankXp)/(nextRankXp-prevRankXp))*100));
  const nextRank = user.rank==="SEED"?"GROWTH":user.rank==="GROWTH"?"APEX":"MAX";
  return(
    <div style={{background:T.surf,border:`2px solid ${T.border}`,padding:"14px 20px",display:"flex",alignItems:"center",gap:20}}>
      <div style={{flex:1}}>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
          <span style={{fontFamily:T.mono,fontSize:8,color:T.dim,letterSpacing:2}}>{user.rank} → {nextRank}</span>
          <span style={{fontFamily:T.mono,fontSize:8,color:T.gold}}>{user.xp.toLocaleString()} / {nextRankXp.toLocaleString()} XP</span>
        </div>
        <div style={{height:4,background:T.muted}}>
          <div style={{height:"100%",width:`${pct}%`,background:`linear-gradient(90deg,${T.gold},${T.goldM})`,transition:"width .8s"}}/>
        </div>
        <div style={{fontFamily:T.mono,fontSize:8,color:T.dim,marginTop:3,letterSpacing:1}}>{(nextRankXp-user.xp).toLocaleString()} XP to {nextRank}</div>
      </div>
      <div style={{textAlign:"right"}}><div style={{fontFamily:T.serif,fontSize:18,color:T.gold,fontWeight:700,lineHeight:1}}>{user.rank}</div><div style={{fontFamily:T.mono,fontSize:7,color:T.dim,letterSpacing:1}}>RANK</div></div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   FRESHMART BRANCHING SIMULATION
═══════════════════════════════════════════════════════════════════ */
function AnimStat({value,prevValue,statKey}){
  const [disp,setDisp]=useState(prevValue??value);
  const [flash,setFlash]=useState(null);
  const raf=useRef(null);
  useEffect(()=>{
    if(prevValue===undefined||prevValue===value)return;
    const delta=value-prevValue,dur=800,from=prevValue;
    setFlash(delta>0?"up":"down");
    const start=performance.now();
    function step(now){
      const p=Math.min((now-start)/dur,1),e=1-Math.pow(1-p,3);
      setDisp(from+delta*e);
      if(p<1)raf.current=requestAnimationFrame(step);
      else{setDisp(value);setTimeout(()=>setFlash(null),500);}
    }
    raf.current=requestAnimationFrame(step);
    return()=>cancelAnimationFrame(raf.current);
  },[value]);
  const m=FM_STAT_META[statKey];
  const raw=typeof disp==="number"?disp:value;
  const formatted=m.fmt==="money"?`PKR ${fmtMoney(raw)}`:`${Math.round(raw)}`;
  const hc=HC[statHealth(statKey,value)];
  return <span style={{color:flash==="up"?T.green:flash==="down"?T.red:hc,transition:"color .3s",fontFamily:T.mono,fontWeight:700,fontSize:13}}>{formatted}</span>;
}

function FreshMartSim({onBack,onComplete}){
  const [nodeId,setNodeId]=useState("start");
  const [stats,setStats]=useState({...FM_INITIAL});
  const [prevStats,setPrevStats]=useState(null);
  const [phase,setPhase]=useState("decision");
  const [hov,setHov]=useState(null);
  const [chosen,setChosen]=useState(null);
  const [log,setLog]=useState([]);
  const topRef=useRef(null);

  const node=Nodes[nodeId];
  const isEnding=node?.isEnding;
  console.log("NODE ID:", nodeId);
  console.log("NODE OBJECT:", Nodes[nodeId]);
  console.log("CHOICES:", Nodes[nodeId]?.choices);
  
  useEffect(() => {
   if (phase === "consequence" && chosen) {
     const timer = setTimeout(() => {
      setNodeId(chosen.next);
      setPhase("decision");
    }, 800);

    return () => clearTimeout(timer);
    }
  }, [phase, chosen]);

  function applyImpact(base,imp){
    const n={...base};
    Object.entries(imp||{}).forEach(([k,v])=>{if(k in n)n[k]=Math.max(0,n[k]+v);});
    return n;
  }
  function handleSelect(choice){
    setChosen(choice);
    const ns=applyImpact(stats,choice.impact);
    setPrevStats({...stats});
    setStats(ns);
    setLog(l=>[...l,{label:choice.label,month:node.month}]);
    setPhase("consequence");
    setTimeout(()=>topRef.current?.scrollIntoView({behavior:"smooth"}),100);
  }
  function handleContinue(){
    if(isEnding){
      onComplete&&onComplete({log,stats,endingType:node.endingType,endingTitle:node.endingTitle,keyInsights:node.keyInsights,caseCompany:"FreshMart Grocery",caseDiff:"SEED",caseType:"scenario"});
      return;
    }
    // Navigate immediately — no timeout
    setNodeId(chosen.next);
    setChosen(null);
    setPhase("decision");
    setHov(null);
    topRef.current?.scrollIntoView({behavior:"smooth"});
  }

  /* ── When we land on an ending node in "decision" phase,
       immediately show it as a conclusion — no extra click needed ── */
  const showEndingDirect = phase==="decision" && isEnding;
  const endColor = node?.endingType==="perfect" ? T.green
                 : node?.endingType==="good"    ? T.green
                 : node?.endingType==="warn"    ? T.gold
                 :                                T.red;
  const endLabel = node?.endingType==="perfect" ? "★ OPTIMAL PATH"
                 : node?.endingType==="good"    ? "✓ RECOVERED"
                 : node?.endingType==="warn"    ? "⚠ SURVIVED — BARELY"
                 :                                "✗ BUSINESS FAILED";
  const previewImp = phase==="decision" && hov ? hov.impact : null;

  return(
    <div style={{minHeight:"100vh",background:T.bg,display:"flex",flexDirection:"column"}}>
      <TopBar label="FRESHMART " sub="BRANCHING CASE" onBack={onBack} right={
        <div style={{display:"flex",gap:10,alignItems:"center"}}>
          <Tag color={DC.SEED}>SEED</Tag>
          <button onClick={()=>{setNodeId("start");setStats({...FM_INITIAL});setPrevStats(null);setPhase("decision");setChosen(null);setHov(null);setLog([]);}} style={{background:"none",border:`1px solid ${T.border}`,color:T.dim,fontFamily:T.mono,fontSize:9,padding:"4px 12px",cursor:"pointer",letterSpacing:2,transition:"all .15s"}} onMouseEnter={e=>{e.currentTarget.style.borderColor=T.red;e.currentTarget.style.color=T.red;}} onMouseLeave={e=>{e.currentTarget.style.borderColor=T.border;e.currentTarget.style.color=T.dim;}}>↺ RESTART</button>
        </div>
      }/>
      <div style={{height:3,background:T.muted,flexShrink:0}}><div style={{height:"100%",width:`${Math.min(100,(node.month/5)*100)}%`,background:T.gold,transition:"width .6s ease"}}/></div>
      <div style={{background:T.surf2,borderBottom:`1px solid ${T.border}`,padding:"5px 28px",display:"flex",gap:16,alignItems:"center",flexShrink:0}}>
        {[1,2,3,4,5].map(m=>(
          <div key={m} style={{display:"flex",alignItems:"center",gap:4}}>
            <div style={{width:7,height:7,borderRadius:"50%",background:m<=node.month?T.gold:T.muted,opacity:m===node.month?1:m<node.month?.5:.2,boxShadow:m===node.month?`0 0 8px ${T.gold}88`:"none",transition:"all .3s"}}/>
            <span style={{fontFamily:T.mono,fontSize:7,color:m<=node.month?T.gold:T.muted,letterSpacing:1}}>M{m}</span>
          </div>
        ))}
        <span style={{fontFamily:T.mono,fontSize:9,color:T.dim,marginLeft:"auto"}}>MONTH {node.month}</span>
      </div>

      <div ref={topRef} style={{flex:1,display:"flex",overflow:"hidden",minHeight:0}}>
        <div style={{flex:1,overflowY:"auto",padding:"28px 28px"}}>

          {/* ── WARNING BADGE ── */}
          {node.isWarning&&<div style={{background:T.redD,border:`1px solid ${T.red}44`,padding:"7px 14px",marginBottom:14,display:"flex",gap:8,alignItems:"center"}}><span style={{color:T.red}}>⚠</span><span style={{fontFamily:T.mono,fontSize:8,color:T.red,letterSpacing:2}}>CRITICAL SITUATION — BUSINESS AT RISK</span></div>}

          {/* ── NODE TITLE + SITUATION/NARRATIVE ── */}
          <div style={{marginBottom:20}}>
            <div style={{fontFamily:T.mono,fontSize:8,color:isEnding?endColor:T.gold,letterSpacing:3,marginBottom:8}}>
              {isEnding ? `CONCLUSION · ${node.title.toUpperCase()}` : `MONTH ${node.month} · ${node.title.toUpperCase()}`}
            </div>
            <div style={{background:T.surf,border:`1px solid ${isEnding?endColor+"33":T.border}`,padding:"18px 20px"}}>
              <p style={{fontFamily:T.sans,fontSize:14,color:"#bbb",lineHeight:1.85}}>
                {node.situation || node.narrative}
              </p>
            </div>
          </div>

          {/* ══════════════════════════════════════════════════════
              ENDING REACHED DIRECTLY (navigated here via continue)
          ══════════════════════════════════════════════════════ */}
          {showEndingDirect&&(
            <div style={{animation:"fadeUp .4s both"}}>
              {node.narrative&&node.situation&&(
                <div style={{background:T.surf2,border:`1px solid ${T.border}`,padding:"18px 20px",marginBottom:16}}>
                  <div style={{fontFamily:T.mono,fontSize:8,color:T.gold,letterSpacing:2,marginBottom:8}}>▸ WHAT HAPPENED</div>
                  <p style={{fontFamily:T.sans,fontSize:14,color:"#bbb",lineHeight:1.8}}>{node.narrative}</p>
                </div>
              )}
              <div style={{background:`${endColor}0a`,border:`2px solid ${endColor}44`,padding:"22px 22px",marginBottom:18}}>
                <div style={{fontFamily:T.mono,fontSize:8,color:endColor,letterSpacing:3,marginBottom:8}}>
                  {endLabel}
                </div>
                <div style={{fontFamily:T.serif,fontSize:22,color:endColor,fontWeight:700,marginBottom:12}}>{node.endingTitle}</div>
                <pre style={{fontFamily:T.sans,fontSize:13,color:"#999",lineHeight:1.8,whiteSpace:"pre-wrap"}}>{node.endingText}</pre>
              </div>
              <button onClick={handleContinue} style={{width:"100%",background:endColor,border:"none",color:"#000",fontFamily:T.mono,fontSize:11,fontWeight:800,padding:"13px",cursor:"pointer",letterSpacing:2}}>VIEW FULL RESULTS & SHARE →</button>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════
              CONSEQUENCE PHASE (just made a choice, showing outcome)
          ══════════════════════════════════════════════════════ */}
          {phase==="consequence"&&chosen&&(
            <div style={{marginBottom:20}}>
              <div style={{background:T.goldD,border:`2px solid ${T.goldM}`,padding:"12px 16px",marginBottom:16}}>
                <div style={{fontFamily:T.mono,fontSize:8,color:T.gold,letterSpacing:2,marginBottom:4}}>▸ YOU CHOSE</div>
                <div style={{fontFamily:T.sans,fontSize:13,color:T.gold,fontWeight:600}}>{chosen.label}</div>
              </div>
              {node.narrative&&(
                <div style={{background:T.surf2,border:`1px solid ${T.border}`,padding:"18px 20px",marginBottom:14,animation:"fadeUp .35s both"}}>
                  <div style={{fontFamily:T.mono,fontSize:8,color:T.gold,letterSpacing:2,marginBottom:8}}>▸ WHAT HAPPENED</div>
                  <p style={{fontFamily:T.sans,fontSize:14,color:"#bbb",lineHeight:1.8}}>{node.narrative}</p>
                </div>
              )}
              {/* Ending panel — shown in consequence if the CURRENT node is an ending */}
              {isEnding&&(
                <div style={{animation:"fadeUp .4s .2s both"}}>
                  <div style={{background:`${endColor}0a`,border:`2px solid ${endColor}44`,padding:"22px 22px",marginBottom:18}}>
                    <div style={{fontFamily:T.mono,fontSize:8,color:endColor,letterSpacing:3,marginBottom:8}}>
                      {endLabel}
                    </div>
                    <div style={{fontFamily:T.serif,fontSize:22,color:endColor,fontWeight:700,marginBottom:12}}>{node.endingTitle}</div>
                    <pre style={{fontFamily:T.sans,fontSize:13,color:"#999",lineHeight:1.8,whiteSpace:"pre-wrap"}}>{node.endingText}</pre>
                  </div>
                  <button onClick={handleContinue} style={{width:"100%",background:endColor,border:"none",color:"#000",fontFamily:T.mono,fontSize:11,fontWeight:800,padding:"13px",cursor:"pointer",letterSpacing:2}}>VIEW FULL RESULTS & SHARE →</button>
                </div>
              )}
              {!isEnding&&(
                <button onClick={handleContinue} style={{width:"100%",background:T.gold,border:"none",color:"#000",fontFamily:T.mono,fontSize:11,fontWeight:800,padding:"12px",cursor:"pointer",letterSpacing:2,animation:"fadeIn .3s both"}}>CONTINUE →</button>
              )}
            </div>
          )}

          {/* ══════════════════════════════════════════════════════
              DECISION PHASE — show choices
          ══════════════════════════════════════════════════════ */}
          {phase==="decision"&&!isEnding&&(
            <div style={{animation:"fadeUp .3s both"}}>
              <div style={{fontFamily:T.mono,fontSize:8,color:T.dim,letterSpacing:3,marginBottom:10}}>▸ YOUR MOVE</div>
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                {(() => {
                 console.log("CHOICES LENGTH:", node?.choices?.length);
                 console.log("CHOICES:", node?.choices);
                 return null;
                })()}
                {node.choices?.map(c=>(
                  <div key={c.id} onMouseEnter={()=>setHov(c)} onMouseLeave={()=>setHov(null)} onClick={()=>handleSelect(c)} style={{border:`2px solid ${hov?.id===c.id?T.gold:T.border}`,background:hov?.id===c.id?T.goldD:T.surf,padding:"14px 16px",cursor:"pointer",transition:"all .15s",display:"flex",gap:12,alignItems:"flex-start"}}>
                    <div style={{width:20,height:20,border:`2px solid ${hov?.id===c.id?T.gold:T.mid}`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,marginTop:1,transition:"border-color .15s"}}>
                      <span style={{fontFamily:T.mono,fontSize:10,fontWeight:800,color:hov?.id===c.id?T.gold:T.dim}}>{c.id.toUpperCase()}</span>
                    </div>
                    <div style={{flex:1}}>
                      <div style={{fontFamily:T.sans,fontSize:13.5,color:hov?.id===c.id?T.txt:"#ccc",fontWeight:600,marginBottom:3}}>{c.label}</div>
                      <div style={{fontFamily:T.sans,fontSize:12,color:T.dim,lineHeight:1.55}}>{c.desc}</div>
                    </div>
                    <span style={{fontFamily:T.mono,fontSize:10,color:T.gold,opacity:hov?.id===c.id?1:0,transition:"opacity .15s",flexShrink:0,marginTop:2}}>→</span>
                  </div>
                ))}
              </div>
              {hov&&(
                <div style={{marginTop:12,background:T.surf2,border:`1px solid ${T.goldM}`,padding:"10px 14px",animation:"fadeIn .15s both"}}>
                  <div style={{fontFamily:T.mono,fontSize:7,color:T.gold,letterSpacing:2,marginBottom:6}}>▸ PROJECTED IMPACT</div>
                  <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                    {Object.entries(hov.impact||{}).filter(([k])=>FM_STAT_META[k]).map(([k,v])=>{
                      const m=FM_STAT_META[k];
                      const good=(m.good==="high"&&v>0)||(m.good==="low"&&v<0);
                      const color=good?T.green:T.red;
                      return <span key={k} style={{fontFamily:T.mono,fontSize:8,color,background:`${color}12`,padding:"2px 9px",border:`1px solid ${color}33`,letterSpacing:1}}>{m.icon} {m.label}: {v>0?"+":""}{m.fmt==="money"?`PKR ${fmtMoney(v)}`:v}</span>;
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Decision log */}
          {log.length>0&&<div style={{marginTop:24,borderTop:`1px solid ${T.border}`,paddingTop:20}}>
            <div style={{fontFamily:T.mono,fontSize:8,color:T.muted,letterSpacing:3,marginBottom:10}}>YOUR DECISIONS</div>
            {log.map((e,i)=>(
              <div key={i} style={{display:"flex",gap:8,alignItems:"center",marginBottom:6}}>
                <div style={{width:16,height:16,background:T.muted,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><span style={{fontFamily:T.mono,fontSize:7,color:T.dim}}>{i+1}</span></div>
                <div><div style={{fontFamily:T.sans,fontSize:11,color:"#666"}}>{e.label}</div><div style={{fontFamily:T.mono,fontSize:7,color:T.muted}}>Month {e.month}</div></div>
              </div>
            ))}
          </div>}

        </div>

        {/* Stats sidebar */}
        <div style={{width:268,borderLeft:`2px solid ${T.border}`,overflowY:"auto",padding:"20px 16px",flexShrink:0}}>
          <div style={{fontFamily:T.mono,fontSize:8,color:T.muted,letterSpacing:3,marginBottom:10}}>BUSINESS DASHBOARD</div>
          {FM_STAT_KEYS.map(k=>{
            const m=FM_STAT_META[k];
            const v=stats[k],pv=prevStats?.[k];
            const hc=HC[statHealth(k,v)];
            const delta=pv!==undefined?v-pv:0;
            const showBar=m.fmt==="pct";
            const previewV=previewImp?.[k];
            return(
              <div key={k} style={{background:T.surf2,border:`1px solid ${previewImp&&previewV?`${previewV>0?T.green:T.red}44`:T.border}`,padding:"9px 12px",marginBottom:6,transition:"border-color .2s"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:showBar?5:0}}>
                  <span style={{fontFamily:T.mono,fontSize:8,color:T.dim,letterSpacing:1}}>{m.icon} {m.label}</span>
                  <div style={{display:"flex",alignItems:"center",gap:4}}>
                    <AnimStat value={v} prevValue={pv} statKey={k}/>
                    {delta!==0&&<span style={{fontFamily:T.mono,fontSize:8,color:delta>0?((m.good==="high")?T.green:T.red):((m.good==="low")?T.green:T.red),background:delta>0?`${T.green}18`:`${T.red}18`,padding:"0 5px"}}>{delta>0?"+":""}{m.fmt==="money"?`PKR ${fmtMoney(delta)}`:delta}</span>}
                  </div>
                </div>
                {showBar&&<div style={{height:3,background:T.muted}}><div style={{height:"100%",width:`${Math.min(100,v)}%`,background:hc,transition:"width .8s"}}/></div>}
                {previewImp&&previewV&&<div style={{fontFamily:T.mono,fontSize:7,color:previewV>0?T.green:T.red,marginTop:3,letterSpacing:1}}>→ {previewV>0?"+":""}{m.fmt==="money"?`PKR ${fmtMoney(previewV)}`:previewV} if chosen</div>}
              </div>
            );
          })}
          <div style={{background:T.surf2,border:`1px solid ${stats.monthlySales>=RENT?"#3DEB8A33":"#FF525233"}`,padding:"10px 12px",marginTop:4}}>
            <div style={{display:"flex",justifyContent:"space-between"}}>
              <span style={{fontFamily:T.mono,fontSize:8,color:T.dim}}>BREAKEVEN</span>
              <span style={{fontFamily:T.mono,fontSize:9,fontWeight:700,color:stats.monthlySales>=RENT?T.green:T.red}}>{stats.monthlySales>=RENT?"✓ ABOVE":"✗ BELOW"}</span>
            </div>
            <div style={{fontFamily:T.mono,fontSize:8,color:T.dim,marginTop:2}}>Gap vs rent: <span style={{color:stats.monthlySales>=RENT?T.green:T.red}}>{stats.monthlySales>=RENT?"+":"-"}PKR {fmtMoney(Math.abs(stats.monthlySales-RENT))}</span></div>
          </div>
          <div style={{marginTop:10,fontFamily:T.mono,fontSize:7,color:T.muted,lineHeight:1.6,padding:"8px 10px",border:`1px dashed ${T.muted}`}}>💡 Hover a choice to preview stat impact before committing.</div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   LOBBY
═══════════════════════════════════════════════════════════════════ */
function Lobby({onNav,user,leaderboard,feed,caseList}){
  const [hov,setHov]=useState(null);
  const list = caseList||CASE_LIST_FALLBACK;
  const modes=[
    {id:"cases",icon:"⬡",code:"01",color:T.gold,title:"Case Simulation",sub:"Dissect. Decide. Score.",desc:"Timed case rooms anchored to real company data. Choose Business Scenario or Financial Statement. Earn XP, rank globally, share results.",badge:"MOST PLAYED",active:list.length||5},
    {id:"boardroom",icon:"◈",code:"02",color:T.blue,title:"The Boardroom",sub:"Defend your numbers. Live.",desc:"Present your financial analysis to a live audience. Gallery watches, reacts, and votes on every decision in real time.",badge:"LIVE NOW",active:218},
  ];
  return(
    <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
      <TickerBar user={user}/>
      <div style={{position:"relative",padding:"48px 32px 32px",overflow:"hidden",borderBottom:`2px solid ${T.border}`,flexShrink:0}}>
        <HexBg/>
        <div style={{position:"relative",animation:"fadeUp .5s both"}}>
          <div style={{fontFamily:T.mono,fontSize:9,color:T.gold,letterSpacing:4,marginBottom:12}}>▸ COGNITIVE SPORTS ARENA FOR CA STUDENTS</div>
          <h1 style={{fontFamily:T.serif,fontSize:"clamp(28px,4vw,50px)",fontWeight:900,lineHeight:1.05,color:T.txt,marginBottom:12}}>Where Financial<br/><span style={{color:T.gold}}>Intelligence</span> Competes.</h1>
          <p style={{fontFamily:T.sans,fontSize:13.5,color:T.dim,lineHeight:1.8,maxWidth:460}}>Real companies. Real decisions. Real scoring. Pick your mode, dissect the business, earn your rank.</p>
        </div>
      </div>
      <div style={{flex:1,display:"flex",gap:0,overflow:"hidden"}}>
        <div style={{flex:1,overflowY:"auto",padding:"24px 28px",display:"flex",flexDirection:"column",gap:20}}>
          <XPBar user={user}/>
          <div>
            <div style={{fontFamily:T.mono,fontSize:8,color:T.muted,letterSpacing:3,marginBottom:12}}>GAME MODES</div>
            <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
              {modes.map(m=>(
                <div key={m.id} onMouseEnter={()=>setHov(m.id)} onMouseLeave={()=>setHov(null)} onClick={()=>onNav(m.id)} style={{flex:1,minWidth:230,background:hov===m.id?"#0e0e12":T.surf,border:`2px solid ${hov===m.id?m.color:T.border}`,padding:"24px 22px",cursor:"pointer",transition:"all .2s",position:"relative",boxShadow:hov===m.id?`0 0 40px ${m.color}12`:"none"}}>
                  <div style={{position:"absolute",top:12,right:12,background:m.color,color:"#000",fontFamily:T.mono,fontSize:8,fontWeight:800,padding:"2px 8px",letterSpacing:2}}>{m.badge}</div>
                  <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}><span style={{fontSize:24,color:m.color}}>{m.icon}</span><span style={{fontFamily:T.mono,fontSize:9,color:m.color,letterSpacing:3}}>{m.code}</span></div>
                  <h3 style={{fontFamily:T.serif,fontSize:20,color:T.txt,marginBottom:4,fontWeight:700}}>{m.title}</h3>
                  <div style={{fontFamily:T.mono,fontSize:9,color:m.color,letterSpacing:2,marginBottom:10,textTransform:"uppercase"}}>{m.sub}</div>
                  <p style={{fontFamily:T.sans,fontSize:12.5,color:"#666",lineHeight:1.65,marginBottom:16}}>{m.desc}</p>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <span style={{fontFamily:T.mono,fontSize:10,color:T.muted}}><span style={{color:m.color}}>{typeof m.active==="number"?m.active.toLocaleString():m.active}</span> active</span>
                    <span style={{fontFamily:T.mono,fontSize:10,color:m.color,letterSpacing:2}}>ENTER →</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <div style={{fontFamily:T.mono,fontSize:8,color:T.muted,letterSpacing:3,marginBottom:12}}>FEATURED CASES</div>
            <div style={{display:"flex",flexDirection:"column",gap:7}}>
              {list.map(c=>(
                <div key={c.id} onClick={()=>onNav(`case-${c.id}`)} style={{background:T.surf,border:`1px solid ${T.border}`,padding:"13px 16px",cursor:"pointer",display:"flex",alignItems:"center",gap:14,transition:"all .15s"}} onMouseEnter={e=>{e.currentTarget.style.borderColor=DC[c.diff]+"55";e.currentTarget.style.background="#0e0e12";}} onMouseLeave={e=>{e.currentTarget.style.borderColor=T.border;e.currentTarget.style.background=T.surf;}}>
                  <div style={{width:3,height:38,background:DC[c.diff],flexShrink:0}}/>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontFamily:T.sans,fontSize:13,color:"#ddd",fontWeight:600,marginBottom:2}}>{c.label}{c.hasSim&&<span style={{marginLeft:8,fontFamily:T.mono,fontSize:7,color:T.blue,border:`1px solid ${T.blue}44`,padding:"1px 6px",letterSpacing:1}}>SIM</span>}</div>
                    <div style={{fontFamily:T.mono,fontSize:8,color:T.dim,letterSpacing:1}}>{c.sub}</div>
                  </div>
                  <div style={{display:"flex",gap:6,alignItems:"center",flexShrink:0}}>
                    <Tag color={DC[c.diff]} small>{c.diff}</Tag>
                    <Tag color={c.type==="financial"?T.blue:T.gold} small filled>{c.type==="financial"?"FS":"CASE"}</Tag>
                    <span style={{fontFamily:T.mono,fontSize:9,color:T.dim}}>avg {c.avgScore||"—"}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div style={{width:276,borderLeft:`2px solid ${T.border}`,overflowY:"auto",padding:18,display:"flex",flexDirection:"column",gap:14,flexShrink:0}}>
          <LeaderboardPanel leaderboard={leaderboard} currentUserId={user?.id}/>
          <FeedPanel feed={feed}/>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   CASE BROWSER
═══════════════════════════════════════════════════════════════════ */
function CaseBrowser({onNav,onBack,caseList,user,leaderboard,feed}){
  const [filter,setFilter]=useState("all");
  const [hov,setHov]=useState(null);
  const list = caseList||CASE_LIST_FALLBACK;
  const filtered=list.filter(c=>filter==="all"||c.type===filter);
  return(
    <div style={{minHeight:"100vh",background:T.bg,display:"flex",flexDirection:"column"}}>
      <TopBar label="CASE SIMULATION" sub="SELECT CASE" onBack={onBack}/>
      <div style={{flex:1,display:"flex",overflow:"hidden"}}>
        <div style={{flex:1,overflowY:"auto",padding:"32px 28px"}}>
          <div style={{fontFamily:T.mono,fontSize:8,color:T.muted,letterSpacing:3,marginBottom:14}}>CHOOSE FORMAT</div>
          <div style={{display:"flex",gap:12,marginBottom:32,flexWrap:"wrap"}}>
            {[{id:"scenario",icon:"◉",color:T.gold,title:"Business Scenario",sub:"Strategic Judgement · Advisory",desc:"Narrative brief with key data. Analyse the situation, make recommendations, defend logic. Some cases include live branching simulations."},{id:"financial",icon:"▦",color:T.blue,title:"Financial Statement",sub:"Technical Precision · IFRS",desc:"Actual financials — P&L, Balance Sheet, Cash Flow, Ratio Analysis. Calculate ratios, identify anomalies, recommend capital actions."}].map(m=>(
              <div key={m.id} onClick={()=>setFilter(m.id)} onMouseEnter={()=>setHov(m.id)} onMouseLeave={()=>setHov(null)} style={{flex:1,minWidth:220,background:filter===m.id?`${m.color}0a`:T.surf,border:`2px solid ${filter===m.id||hov===m.id?m.color:T.border}`,padding:"20px 18px",cursor:"pointer",transition:"all .2s"}}>
                <div style={{fontSize:22,color:m.color,marginBottom:10}}>{m.icon}</div>
                <div style={{fontFamily:T.serif,fontSize:17,color:T.txt,marginBottom:4,fontWeight:700}}>{m.title}</div>
                <div style={{fontFamily:T.mono,fontSize:8,color:m.color,letterSpacing:2,marginBottom:8}}>{m.sub}</div>
                <p style={{fontFamily:T.sans,fontSize:12,color:"#666",lineHeight:1.65}}>{m.desc}</p>
              </div>
            ))}
          </div>
          <div style={{fontFamily:T.mono,fontSize:8,color:T.muted,letterSpacing:3,marginBottom:12}}>
            {filter==="all"?"ALL CASES":filter==="scenario"?"BUSINESS SCENARIOS":"FINANCIAL STATEMENTS"}
            <span style={{color:T.dim,marginLeft:8}}>({filtered.length} available)</span>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {filtered.map(c=>(
              <div key={c.id} onClick={()=>onNav(`play-${c.id}`)} style={{background:T.surf,border:`1px solid ${T.border}`,padding:"16px 18px",cursor:"pointer",display:"flex",gap:16,alignItems:"flex-start",transition:"all .15s"}} onMouseEnter={e=>{e.currentTarget.style.borderColor=DC[c.diff]+"55";e.currentTarget.style.background="#0e0e12";}} onMouseLeave={e=>{e.currentTarget.style.borderColor=T.border;e.currentTarget.style.background=T.surf;}}>
                <div style={{width:4,alignSelf:"stretch",background:DC[c.diff],flexShrink:0,minHeight:46}}/>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:"flex",gap:7,alignItems:"center",marginBottom:5,flexWrap:"wrap"}}>
                    <span style={{fontFamily:T.sans,fontSize:13.5,color:"#e0e0e0",fontWeight:700}}>{c.label}</span>
                    <Tag color={DC[c.diff]} small>{c.diff}</Tag>
                    <Tag color={c.type==="financial"?T.blue:T.gold} small filled>{c.type==="financial"?"FINANCIAL":"SCENARIO"}</Tag>
                    {c.hasSim&&<Tag color={T.blue} small>LIVE SIM</Tag>}
                  </div>
                  <div style={{fontFamily:T.mono,fontSize:8,color:T.dim,letterSpacing:1,marginBottom:3}}>{c.sector}</div>
                  <div style={{fontFamily:T.sans,fontSize:12,color:"#555"}}>{c.sub}</div>
                </div>
                <div style={{textAlign:"right",flexShrink:0}}>
                  <div style={{fontFamily:T.mono,fontSize:9,color:T.dim}}>avg score</div>
                  <div style={{fontFamily:T.mono,fontSize:15,color:T.gold,fontWeight:700}}>{c.avgScore}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div style={{width:272,borderLeft:`2px solid ${T.border}`,overflowY:"auto",padding:16,display:"flex",flexDirection:"column",gap:12,flexShrink:0}}>
          <LeaderboardPanel leaderboard={leaderboard} currentUserId={user?.id}/>
          <FeedPanel feed={feed}/>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   SIM ROOM (MCQ cases with ratio / cashflow analysis tabs)
═══════════════════════════════════════════════════════════════════ */
function SimRoom({caseData,onBack,onComplete}){
  const [phase,setPhase]=useState("brief");
  const [qIdx,setQIdx]=useState(0);
  const [answers,setAnswers]=useState({});
  const [selected,setSelected]=useState(null);
  const [revealed,setRevealed]=useState(false);
  const [timeLeft,setTimeLeft]=useState(caseData.timeLimit);
  const [activeTab,setActiveTab]=useState("pnl");
  const [showWrong,setShowWrong]=useState(false);

  useEffect(()=>{
    if(phase!=="question"||timeLeft<=0)return;
    const t=setTimeout(()=>setTimeLeft(v=>v-1),1000);
    return()=>clearTimeout(t);
  },[timeLeft,phase]);

  const fmt=s=>`${Math.floor(s/60)}:${String(s%60).padStart(2,"0")}`;
  const urgency=timeLeft<120?T.red:timeLeft<300?T.gold:T.green;
  const currentQ=caseData.questions[qIdx];
  const totalScore=Object.entries(answers).reduce((sum,[qId,optId])=>{
    const q=caseData.questions.find(q=>q.id===parseInt(qId));
    return sum+(q?.options.find(o=>o.id===optId)?.score||0);
  },0);
  const maxScore=caseData.questions.length*100;
  const selectedOpt=revealed&&currentQ.options.find(o=>o.id===selected);
  const isCorrect=selectedOpt?.score===100;

  function handleReveal(){if(!selected)return;setAnswers(p=>({...p,[currentQ.id]:selected}));setRevealed(true);setShowWrong(false);}
  function handleNext(){
    if(qIdx<caseData.questions.length-1){
      setQIdx(v=>v+1);setSelected(null);setRevealed(false);setShowWrong(false);
    } else {
      // totalScore already includes the current answer (set during handleReveal)
      setPhase("complete");
      onComplete&&onComplete(caseData, totalScore, maxScore);
    }
  }

  // Build tabs for financial cases
  const financialTabs=[];
  if(caseData.type==="financial"){
    if(caseData.financials?.pnl) financialTabs.push({id:"pnl",label:"P&L"});
    if(caseData.financials?.bs) financialTabs.push({id:"bs",label:"Balance Sheet"});
    if(caseData.financials?.cf) financialTabs.push({id:"cf",label:"Cash Flow"});
    if(caseData.cashflow) financialTabs.push({id:"cashflow",label:"CF Analysis"});
    if(caseData.ratios) financialTabs.push({id:"ratios",label:"Ratio Analysis"});
    if(caseData.flags) financialTabs.push({id:"flags",label:"🚩 Flags"});
  }

  function renderFinancialTab(){
    if(activeTab==="flags"){
      return(
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {caseData.flags.map((f,i)=>(
            <div key={i} style={{display:"flex",alignItems:"center",gap:12,background:T.surf,border:`1px solid ${f.severity==="high"?T.red+"44":f.severity==="medium"?T.gold+"33":T.border}`,padding:"12px 14px"}}>
              <div style={{width:7,height:7,borderRadius:"50%",background:f.severity==="high"?T.red:f.severity==="medium"?T.gold:T.blue,flexShrink:0}}/>
              <div style={{flex:1}}>
                <div style={{fontFamily:T.mono,fontSize:11,color:f.severity==="high"?T.red:f.severity==="medium"?T.gold:T.blue,marginBottom:2}}>{f.label}</div>
                <div style={{fontFamily:T.sans,fontSize:12,color:T.dim}}>{f.note}</div>
              </div>
              <Tag color={f.severity==="high"?T.red:f.severity==="medium"?T.gold:T.blue} small>{f.severity.toUpperCase()}</Tag>
            </div>
          ))}
        </div>
      );
    }
    if(activeTab==="ratios"&&caseData.ratios){
      const sev={ok:T.green,warn:T.gold,bad:T.red};
      return(
        <div>
          <div style={{fontFamily:T.mono,fontSize:8,color:T.dim,letterSpacing:2,marginBottom:14}}>{caseData.ratios.title.toUpperCase()}</div>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {caseData.ratios.items.map((r,i)=>(
              <div key={i} style={{background:T.surf,border:`1px solid ${sev[r.severity]||T.border}22`,padding:"13px 16px",display:"flex",gap:16,alignItems:"flex-start"}}>
                <div style={{flex:1}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
                    <span style={{fontFamily:T.mono,fontSize:12,color:T.txt,fontWeight:700}}>{r.label}</span>
                    <span style={{fontFamily:T.mono,fontSize:18,fontWeight:900,color:sev[r.severity]||T.blue,marginLeft:8}}>{r.value}</span>
                  </div>
                  <div style={{fontFamily:T.mono,fontSize:8,color:T.dim,letterSpacing:1,marginBottom:4}}>{r.formula}</div>
                  <div style={{fontFamily:T.sans,fontSize:11,color:"#777"}}>{r.benchmark}</div>
                </div>
                <div style={{textAlign:"right",minWidth:140}}>
                  <div style={{fontFamily:T.sans,fontSize:11,color:sev[r.severity]||T.blue,lineHeight:1.4}}>{r.flag}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }
    if(activeTab==="cashflow"&&caseData.cashflow){
      return(
        <div>
          <div style={{fontFamily:T.mono,fontSize:8,color:T.dim,letterSpacing:2,marginBottom:6}}>{caseData.cashflow.title.toUpperCase()}</div>
          {caseData.cashflow.note&&<div style={{fontFamily:T.sans,fontSize:11,color:T.dim,marginBottom:14,fontStyle:"italic",lineHeight:1.6}}>{caseData.cashflow.note}</div>}
          <div style={{display:"flex",flexDirection:"column",gap:4}}>
            {caseData.cashflow.items.map((item,i)=>{
              const typeColor={operating:T.green,investing:T.orange,financing:T.blue,wc:T.gold,adjust:T.dim,total:T.txt,kpi:T.gold}[item.type]||T.txt;
              const isTotal=item.type==="total"||item.type==="kpi";
              return(
                <div key={i} style={{background:isTotal?`${typeColor}0a`:T.surf,border:`1px solid ${item.flag?T.red+"33":T.border}`,padding:"10px 14px",borderLeft:`3px solid ${typeColor}`}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <span style={{fontFamily:T.mono,fontSize:isTotal?11:10,color:isTotal?T.txt:"#aaa",fontWeight:isTotal?700:400}}>{item.label}</span>
                    <span style={{fontFamily:T.mono,fontSize:isTotal?13:12,color:typeColor,fontWeight:700}}>{item.value}</span>
                  </div>
                  {item.flag&&<div style={{fontFamily:T.sans,fontSize:10,color:T.red,marginTop:3}}>{item.flag}</div>}
                </div>
              );
            })}
          </div>
        </div>
      );
    }
    // Default: financial table
    const tbl=caseData.financials?.[activeTab];
    if(!tbl) return null;
    return(
      <div style={{overflowX:"auto"}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontFamily:T.mono,fontSize:12}}>
          <thead><tr>{tbl.headers.map((h,i)=><th key={i} style={{textAlign:i===0?"left":"right",padding:"7px 10px",color:T.dim,letterSpacing:1.5,fontSize:8,fontWeight:700,borderBottom:`2px solid ${T.border}`}}>{h}</th>)}</tr></thead>
          <tbody>{tbl.rows.map((row,ri)=>{
            const flagged=row[row.length-1]===true;
            return(
              <tr key={ri} style={{background:flagged?"#FF525208":ri%2===0?"transparent":"#ffffff02"}}>
                {row.map((cell,ci)=>{
                  if(typeof cell==="boolean") return null;
                  const isNeg=typeof cell==="string"&&cell.startsWith("(");
                  const isDeltaDown=typeof cell==="string"&&cell.includes("▼");
                  const isDeltaUp=typeof cell==="string"&&cell.includes("▲");
                  const isupabaseold=typeof cell==="string"&&cell===cell.toUpperCase()&&cell.length>3&&ci===0;
                  return <td key={ci} style={{padding:"8px 10px",textAlign:ci===0?"left":"right",color:isDeltaDown?T.red:isDeltaUp?T.green:isNeg?"#FF8C8C":ci===0?"#ccc":"#fff",fontWeight:isupabaseold?700:ci===0?400:500,fontSize:isupabaseold?11:12,borderBottom:`1px solid ${T.border}`,borderLeft:ci===0&&flagged?`3px solid ${T.red}`:ci===0?"3px solid transparent":"none"}}>{cell}</td>;
                })}
              </tr>
            );
          })}</tbody>
        </table>
      </div>
    );
  }

  if(phase==="brief") return(
    <div style={{minHeight:"100vh",background:T.bg,display:"flex",flexDirection:"column"}}>
      <TopBar label={caseData.company.toUpperCase()} sub="CASE BRIEF" onBack={onBack} right={
        <div style={{display:"flex",gap:8}}><Tag color={DC[caseData.difficulty]}>{caseData.difficulty}</Tag><Tag color={caseData.type==="financial"?T.blue:T.gold}>{caseData.type==="financial"?"FINANCIAL STMT":"SCENARIO"}</Tag></div>
      }/>
      <div style={{flex:1,overflowY:"auto",padding:"36px 28px",maxWidth:1040,width:"100%",margin:"0 auto"}}>
        <h1 style={{fontFamily:T.serif,fontSize:"clamp(24px,3.5vw,40px)",color:T.txt,marginBottom:14,fontWeight:900,animation:"fadeUp .4s both"}}>{caseData.company}</h1>
        <p style={{fontFamily:T.sans,fontSize:14,color:"#888",lineHeight:1.85,maxWidth:720,marginBottom:32}}>{caseData.synopsis}</p>
        {caseData.type==="scenario"&&(
          <div style={{marginBottom:32}}>
            <div style={{fontFamily:T.mono,fontSize:8,color:T.muted,letterSpacing:3,marginBottom:12}}>KEY DATA POINTS</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(190px,1fr))",gap:9}}>
              {caseData.context.map(c=>(
                <div key={c.label} style={{background:T.surf,border:`1px solid ${T.border}`,padding:"13px 15px"}}>
                  <div style={{fontFamily:T.mono,fontSize:8,color:T.muted,letterSpacing:1.5,marginBottom:4}}>{c.label}</div>
                  <div style={{fontFamily:T.mono,fontSize:16,color:T.txt,fontWeight:700,marginBottom:2}}>{c.value}</div>
                  <div style={{fontFamily:T.mono,fontSize:9,color:T.dim}}>{c.delta}</div>
                </div>
              ))}
            </div>
          </div>
        )}
        {caseData.type==="financial"&&(
          <div style={{marginBottom:32}}>
            <div style={{display:"flex",gap:0,borderBottom:`2px solid ${T.border}`,marginBottom:18}}>
              {financialTabs.map(tab=>(
                <button key={tab.id} onClick={()=>setActiveTab(tab.id)} style={{background:"none",border:"none",borderBottom:activeTab===tab.id?`2px solid ${tab.id==="flags"?T.red:tab.id==="ratios"?T.green:tab.id==="cashflow"?T.orange:T.gold}`:"2px solid transparent",padding:"9px 18px",cursor:"pointer",fontFamily:T.mono,fontSize:10,color:activeTab===tab.id?(tab.id==="flags"?T.red:tab.id==="ratios"?T.green:tab.id==="cashflow"?T.orange:T.gold):T.dim,letterSpacing:1.5,marginBottom:-2,transition:"all .15s"}}>{tab.label}</button>
              ))}
            </div>
            {renderFinancialTab()}
          </div>
        )}
        <div style={{borderTop:`2px solid ${T.border}`,paddingTop:22,display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:14}}>
          <div style={{fontFamily:T.mono,fontSize:10,color:T.dim}}>{caseData.questions.length} questions · {Math.floor(caseData.timeLimit/60)} min · scored per answer</div>
          <button onClick={()=>setPhase("question")} style={{background:T.gold,border:"none",color:"#000",fontFamily:T.mono,fontSize:12,fontWeight:800,padding:"12px 30px",cursor:"pointer",letterSpacing:2,transition:"opacity .15s"}} onMouseEnter={e=>e.currentTarget.style.opacity=".85"} onMouseLeave={e=>e.currentTarget.style.opacity="1"}>START SIMULATION →</button>
        </div>
      </div>
    </div>
  );

  if(phase==="question"){
    const isFinancial = caseData.type==="financial";
    return(
      <div style={{height:"100vh",background:T.bg,display:"flex",flexDirection:"column"}}>
        <TopBar label={caseData.company.toUpperCase()} sub={`Q${qIdx+1}/${caseData.questions.length}`} onBack={onBack} right={<div style={{fontFamily:T.mono,fontSize:20,fontWeight:700,color:urgency,animation:timeLeft<30?"pulse .7s infinite":"none"}}>{fmt(timeLeft)}</div>}/>
        <div style={{height:3,background:T.muted,flexShrink:0}}><div style={{height:"100%",width:`${(qIdx/caseData.questions.length)*100}%`,background:T.gold,transition:"width .4s"}}/></div>
        <div style={{flex:1,display:"flex",overflow:"hidden",minHeight:0}}>

          {/* ── LEFT: Financial reference panel (financial cases only) ── */}
          {isFinancial&&(
            <div style={{width:380,borderRight:`2px solid ${T.border}`,display:"flex",flexDirection:"column",flexShrink:0,overflow:"hidden"}}>
              {/* tab strip */}
              <div style={{display:"flex",overflowX:"auto",borderBottom:`1px solid ${T.border}`,flexShrink:0,background:T.surf2}}>
                {financialTabs.map(tab=>(
                  <button key={tab.id} onClick={()=>setActiveTab(tab.id)} style={{background:"none",border:"none",borderBottom:activeTab===tab.id?`2px solid ${tab.id==="flags"?T.red:tab.id==="ratios"?T.green:tab.id==="cashflow"?T.orange:T.gold}`:"2px solid transparent",padding:"8px 14px",cursor:"pointer",fontFamily:T.mono,fontSize:9,color:activeTab===tab.id?(tab.id==="flags"?T.red:tab.id==="ratios"?T.green:tab.id==="cashflow"?T.orange:T.gold):T.dim,letterSpacing:1,marginBottom:-1,whiteSpace:"nowrap",flexShrink:0,transition:"all .15s"}}>{tab.label}</button>
                ))}
              </div>
              {/* reference content */}
              <div style={{flex:1,overflowY:"auto",padding:"14px 16px"}}>
                <div style={{fontFamily:T.mono,fontSize:7,color:T.muted,letterSpacing:2,marginBottom:10}}>REFERENCE — STAYS VISIBLE WHILE YOU ANSWER</div>
                {renderFinancialTab()}
              </div>
            </div>
          )}

          {/* ── RIGHT: Question panel ── */}
          <div style={{flex:1,overflowY:"auto",padding:"28px 28px"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,flexWrap:"wrap",gap:8}}>
              <Tag color={DC[caseData.difficulty]}>{caseData.difficulty}</Tag>
              <span style={{fontFamily:T.mono,fontSize:10,color:T.dim}}>Score: <span style={{color:T.gold,fontWeight:700}}>{totalScore}</span> / {qIdx*100} pts</span>
            </div>
            <div style={{fontFamily:T.mono,fontSize:8,color:T.gold,letterSpacing:3,marginBottom:12}}>QUESTION {qIdx+1} OF {caseData.questions.length}</div>
            <p style={{fontFamily:T.sans,fontSize:16,color:T.txt,lineHeight:1.75,marginBottom:24,fontWeight:600}}>{currentQ.text}</p>
            <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:20}}>
              {currentQ.options.map(opt=>{
                const isSel=selected===opt.id;
                const isOpt100=revealed&&opt.score===100;
                const isWrong=revealed&&isSel&&opt.score!==100;
                const bc=isOpt100?T.green:isWrong?T.red:isSel?T.gold:T.border;
                const bg=isOpt100?`${T.green}09`:isWrong?`${T.red}09`:isSel?T.goldD:T.surf;
                return(
                  <div key={opt.id} onClick={()=>{if(!revealed)setSelected(opt.id);}} style={{padding:"13px 15px",border:`2px solid ${bc}`,background:bg,cursor:revealed?"default":"pointer",display:"flex",alignItems:"flex-start",gap:11,transition:"all .15s"}} onMouseEnter={e=>{if(!revealed&&!isSel)e.currentTarget.style.borderColor=T.goldM;}} onMouseLeave={e=>{if(!revealed&&!isSel)e.currentTarget.style.borderColor=T.border;}}>
                    <span style={{fontFamily:T.mono,fontSize:11,fontWeight:800,color:bc,minWidth:18,flexShrink:0,marginTop:1}}>{opt.id.toUpperCase()}</span>
                    <span style={{fontFamily:T.sans,fontSize:13,color:revealed?(isOpt100?T.green:isWrong?T.red:"#666"):"#ccc",lineHeight:1.6,flex:1}}>{opt.text}</span>
                    {revealed&&<span style={{fontFamily:T.mono,fontSize:10,fontWeight:700,color:opt.score===100?T.green:opt.score>=60?T.gold:T.dim,flexShrink:0}}>{opt.score}pts</span>}
                  </div>
                );
              })}
            </div>
            {revealed&&(
              <div style={{animation:"fadeUp .3s both"}}>
                <div style={{background:isCorrect?`${T.green}0a`:`${T.gold}0a`,border:`1px solid ${isCorrect?T.green+"44":T.gold+"44"}`,padding:"14px 16px",marginBottom:10}}>
                  <div style={{fontFamily:T.mono,fontSize:8,color:isCorrect?T.green:T.gold,letterSpacing:2,marginBottom:6}}>▸ {isCorrect?"CORRECT":"EXPERT INSIGHT"}</div>
                  <p style={{fontFamily:T.sans,fontSize:13,color:"#ccc",lineHeight:1.75}}>{currentQ.insight}</p>
                </div>
                {!isCorrect&&currentQ.wrongMoves?.[selected]&&(
                  <div style={{marginBottom:10}}>
                    <button onClick={()=>setShowWrong(v=>!v)} style={{background:"none",border:`1px solid ${T.red}44`,color:T.red,fontFamily:T.mono,fontSize:8,padding:"5px 12px",cursor:"pointer",letterSpacing:2,marginBottom:showWrong?8:0}}>
                      {showWrong?"▲ HIDE":"▼ WHY WAS THIS WRONG?"}
                    </button>
                    {showWrong&&<div style={{background:`${T.red}08`,border:`1px solid ${T.red}33`,padding:"13px 15px",animation:"fadeUp .2s both"}}>
                      <div style={{fontFamily:T.mono,fontSize:8,color:T.red,letterSpacing:2,marginBottom:5}}>▸ WRONG MOVE — OPTION {selected?.toUpperCase()}</div>
                      <p style={{fontFamily:T.sans,fontSize:12.5,color:"#aaa",lineHeight:1.75}}>{currentQ.wrongMoves[selected]}</p>
                    </div>}
                  </div>
                )}
              </div>
            )}
            <div style={{display:"flex",justifyContent:"flex-end",marginTop:18}}>
              {!revealed
                ?<button onClick={handleReveal} disabled={!selected} style={{background:selected?T.gold:T.mid,border:"none",color:selected?"#000":T.dim,fontFamily:T.mono,fontSize:11,fontWeight:800,padding:"11px 26px",cursor:selected?"pointer":"not-allowed",letterSpacing:2,transition:"all .15s"}}>REVEAL ANSWER</button>
                :<button onClick={handleNext} style={{background:T.gold,border:"none",color:"#000",fontFamily:T.mono,fontSize:11,fontWeight:800,padding:"11px 26px",cursor:"pointer",letterSpacing:2}}>{qIdx<caseData.questions.length-1?"NEXT QUESTION →":"VIEW RESULTS →"}</button>
              }
            </div>
          </div>

        </div>
      </div>
    );
  }

  if(phase==="complete") return <ResultsCard caseData={caseData} score={totalScore} maxScore={maxScore} answers={answers} onBack={onBack}/>;
}

/* ═══════════════════════════════════════════════════════════════════
   RESULTS + RICH LINKEDIN CARD
═══════════════════════════════════════════════════════════════════ */

/* Case synopsis lookup — one line describing what the case was actually about */
const CASE_SYNOPSIS_SHORT = {
  "GRC-SEED-01": "A newly opened grocery mart loses PKR 5M to fraud, locks remaining capital in slow-moving inventory, and faces imminent cash insolvency. Advisor role: diagnose constraints and build a recovery path.",
  "MCB-APEX-01": "MCB Bank evaluates a PKR 15B SME lending expansion amid rising NPLs and compressed NIMs. Advisor role: Risk Committee presentation on credit, IFRS 9 ECL staging, and fee income strategy.",
  "FS-SEED-01":  "Raheel's Hardware Store — sole trader P&L analysis. Focus: gross margin floors, contribution margin break-even, and the impact of missing depreciation on reported profit.",
  "FS-GRW-01":   "Crescent Textile Mills — PSX-listed exporter with revenue +14.5% but profit −9.9%. Focus: identify the primary profit driver, compute current ratio, and interpret deteriorating working capital signals.",
  "FS-APEX-01":  "Engro Corporation — full 3-statement conglomerate analysis. Focus: finance cost surge, FCF vs dividend sustainability, JV earnings pressure, and IAS 36 goodwill impairment obligations.",
};

const CASE_CONCEPTS = {
  "GRC-SEED-01": ["Liquidity trap vs. sunk cost","Pareto inventory (80/20)","Break-even and velocity","Fraud response (IAS + legal)","Working capital management"],
  "MCB-APEX-01": ["IFRS 9 ECL staging","CAR and credit risk","KIBOR spread compression","Non-funded income strategy","Syndicated lending accounting"],
  "FS-SEED-01":  ["Gross margin analysis","Contribution margin","Depreciation & true profit","Break-even revenue calculation","Small business profitability"],
  "FS-GRW-01":   ["Current ratio & liquidity","Finance cost impact analysis","Working capital squeeze","Creditor days deterioration","Debt-funded growth warning"],
  "FS-APEX-01":  ["Net Debt / EBITDA leverage","FCF coverage of dividend","IAS 36 impairment testing","IFRS 3 goodwill treatment","Conglomerate PAT attribution"],
};

function LinkedInCardPreview({company,diff,ctype,displayPct,displayGrade,displayGC,isSimResult,
  simResult,caseData,score,maxScore,topAnswers,keyInsightLines,synopsis,concepts}){

  const optimalCount = topAnswers.filter(a=>a.pts===100).length;
  const totalQ = topAnswers.length;
  const perfPct = totalQ>0 ? Math.round((optimalCount/totalQ)*100) : null;

  /* per-question rows — already computed and passed in as topAnswers */

  /* sim path nodes */
  const simPath = isSimResult&&simResult?.log ? simResult.log : [];

  return(
    <div style={{background:"#fff",borderRadius:10,overflow:"hidden",boxShadow:"0 12px 60px #00000055",fontFamily:"'IBM Plex Sans',sans-serif"}}>

      {/* ── HEADER BAND ── */}
      <div style={{background:"#0a0a0a",padding:"14px 22px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div style={{display:"flex",alignItems:"baseline",gap:8}}>
          <span style={{fontFamily:"'Playfair Display',serif",fontSize:20,fontWeight:900,color:T.gold}}>CA</span>
          <span style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:11,fontWeight:700,letterSpacing:4,color:"#fff"}}>ARENA</span>
          <span style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:8,color:"#444",letterSpacing:2,marginLeft:4}}>CASE REPORT</span>
        </div>
        <div style={{display:"flex",gap:6,alignItems:"center"}}>
          <span style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:8,color:DC[diff]||T.gold,border:`1px solid ${DC[diff]||T.gold}55`,padding:"2px 9px",letterSpacing:2}}>{diff}</span>
          <span style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:8,color:ctype==="financial"?T.blue:T.gold,border:`1px solid ${ctype==="financial"?T.blue+"55":T.gold+"55"}`,padding:"2px 9px",letterSpacing:2}}>{ctype==="financial"?"FINANCIAL STMT":"SCENARIO"}{isSimResult?" · SIM":""}</span>
        </div>
      </div>

      {/* ── HERO: Company + Score ── */}
      <div style={{background:"linear-gradient(135deg,#f9f8f5 0%,#f2f1ec 100%)",padding:"22px 24px",borderBottom:"1px solid #e4e3dc"}}>
        <div style={{display:"flex",gap:24,alignItems:"flex-start"}}>
          {/* Score block */}
          <div style={{background:"#fff",border:`2px solid ${displayGC}33`,padding:"16px 20px",textAlign:"center",minWidth:96,flexShrink:0,borderRadius:4}}>
            {!isSimResult&&<>
              <div style={{fontFamily:"'Playfair Display',serif",fontSize:46,color:displayGC,fontWeight:900,lineHeight:1}}>{displayPct}%</div>
              <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:8,color:"#aaa",letterSpacing:2,marginTop:2}}>SCORE</div>
              <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:10,color:displayGC,fontWeight:800,marginTop:4,letterSpacing:1}}>{displayGrade}</div>
            </>}
            {isSimResult&&<>
              <div style={{fontFamily:"'Playfair Display',serif",fontSize:18,color:displayGC,fontWeight:900,lineHeight:1.2,marginBottom:4}}>{displayGrade}</div>
              <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:8,color:"#aaa",letterSpacing:2}}>OUTCOME</div>
              <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:9,color:"#888",marginTop:4}}>{simPath.length} moves</div>
            </>}
          </div>
          {/* Company info */}
          <div style={{flex:1}}>
            <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:8,color:"#bbb",letterSpacing:2,marginBottom:4}}>{isSimResult?"BRANCHING SIMULATION":"CASE STUDY"}</div>
            <div style={{fontFamily:"'Playfair Display',serif",fontSize:19,color:"#111",fontWeight:700,lineHeight:1.2,marginBottom:8}}>{company}</div>
            <p style={{fontFamily:"'IBM Plex Sans',sans-serif",fontSize:11,color:"#666",lineHeight:1.65,margin:"0 0 12px"}}>{synopsis}</p>
            {/* Stats row */}
            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
              {!isSimResult&&[
                {l:"Questions",v:totalQ},
                {l:"Optimal",v:`${optimalCount}/${totalQ}`},
                {l:"Points",v:`${score}/${maxScore}`},
                {l:"Optimal Rate",v:perfPct!=null?`${perfPct}%`:"—"},
              ].map(({l,v})=>(
                <div key={l} style={{background:"#eeede8",padding:"4px 10px",borderRadius:2}}>
                  <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:7,color:"#aaa",letterSpacing:1}}>{l.toUpperCase()}</div>
                  <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:12,color:"#222",fontWeight:700}}>{v}</div>
                </div>
              ))}
              {isSimResult&&[
                {l:"Decisions",v:simPath.length},
                {l:"Months",v:simPath[simPath.length-1]?.month||"—"},
                {l:"Path",v:displayGrade},
              ].map(({l,v})=>(
                <div key={l} style={{background:"#eeede8",padding:"4px 10px",borderRadius:2}}>
                  <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:7,color:"#aaa",letterSpacing:1}}>{l.toUpperCase()}</div>
                  <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:12,color:"#222",fontWeight:700}}>{v}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── CA CONCEPTS COVERED ── */}
      {concepts?.length>0&&(
        <div style={{padding:"14px 24px",background:"#f4f3ee",borderBottom:"1px solid #e4e3dc"}}>
          <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:7,color:"#bbb",letterSpacing:2,marginBottom:8}}>CA CONCEPTS EXAMINED</div>
          <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
            {concepts.map((c,i)=>(
              <span key={i} style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:8,color:"#555",background:"#fff",border:"1px solid #ddd",padding:"3px 10px",borderRadius:2}}>{c}</span>
            ))}
          </div>
        </div>
      )}

      {/* ── KEY INSIGHTS ── */}
      <div style={{padding:"16px 24px",background:"#fff",borderBottom:"1px solid #eeeee8"}}>
        <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:7,color:"#bbb",letterSpacing:2,marginBottom:12}}>KEY ANALYTICAL INSIGHTS</div>
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {keyInsightLines.slice(0,isSimResult?5:4).map((ins,i)=>{
            const text = typeof ins==="string" ? ins : String(ins);
            return(
              <div key={i} style={{display:"flex",gap:12,alignItems:"flex-start"}}>
                <div style={{width:20,height:20,background:displayGC,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,borderRadius:2,marginTop:1}}>
                  <span style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:8,fontWeight:700,color:"#000"}}>{i+1}</span>
                </div>
                <p style={{fontFamily:"'IBM Plex Sans',sans-serif",fontSize:11.5,color:"#444",lineHeight:1.65,margin:0,flex:1}}>{text.replace(/…$/,"")}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── PER-QUESTION BREAKDOWN (MCQ) ── */}
      {!isSimResult&&topAnswers.length>0&&(
        <div style={{padding:"14px 24px",background:"#f9f8f5",borderBottom:"1px solid #eeeee8"}}>
          <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:7,color:"#bbb",letterSpacing:2,marginBottom:10}}>DECISION ANALYSIS — QUESTION BY QUESTION</div>
          <div style={{display:"flex",flexDirection:"column",gap:7}}>
            {topAnswers.map((a,i)=>{
              const barColor=a.pts===100?"#16a34a":a.pts>=70?"#b45309":a.pts>=50?"#2563eb":"#dc2626";
              const bgColor=a.pts===100?"#f0fdf4":a.pts>=70?"#fffbeb":a.pts>=50?"#eff6ff":"#fef2f2";
              const verdict=a.pts===100?"Optimal decision":a.pts>=70?"Strong reasoning":a.pts>=50?"Partial credit":"Missed";
              return(
                <div key={i} style={{background:bgColor,border:`1px solid ${barColor}22`,padding:"10px 12px",borderLeft:`3px solid ${barColor}`,borderRadius:"0 3px 3px 0"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                    <span style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:9,color:"#888",letterSpacing:1}}>Q{i+1}</span>
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      <span style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:8,color:barColor,fontWeight:700}}>{verdict}</span>
                      <span style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:10,color:barColor,fontWeight:800}}>{a.pts}/100</span>
                    </div>
                  </div>
                  <p style={{fontFamily:"'IBM Plex Sans',sans-serif",fontSize:11,color:"#555",lineHeight:1.5,margin:"0 0 5px"}}>{a.q}</p>
                  <div style={{height:2,background:"#e5e5e0",borderRadius:1}}>
                    <div style={{height:"100%",width:`${a.pts}%`,background:barColor,borderRadius:1}}/>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── SIMULATION PATH (Branching) ── */}
      {isSimResult&&simPath.length>0&&(
        <div style={{padding:"14px 24px",background:"#f9f8f5",borderBottom:"1px solid #eeeee8"}}>
          <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:7,color:"#bbb",letterSpacing:2,marginBottom:10}}>DECISION PATH TAKEN</div>
          <div style={{display:"flex",flexDirection:"column",gap:0}}>
            {simPath.map((e,i)=>(
              <div key={i} style={{display:"flex",gap:0,alignItems:"stretch"}}>
                <div style={{display:"flex",flexDirection:"column",alignItems:"center",width:28,flexShrink:0}}>
                  <div style={{width:18,height:18,background:displayGC,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                    <span style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:7,fontWeight:700,color:"#000"}}>{i+1}</span>
                  </div>
                  {i<simPath.length-1&&<div style={{width:2,flex:1,background:"#ddd",minHeight:10}}/>}
                </div>
                <div style={{paddingLeft:10,paddingBottom:i<simPath.length-1?10:0,flex:1}}>
                  <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:8,color:"#bbb",letterSpacing:1,marginBottom:1}}>Month {e.month}</div>
                  <div style={{fontFamily:"'IBM Plex Sans',sans-serif",fontSize:11.5,color:"#333",lineHeight:1.5}}>{e.label}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── FOOTER ── */}
      <div style={{background:"#0a0a0a",padding:"10px 24px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <span style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:8,color:"#444",letterSpacing:1}}>ca-arena.pk · Cognitive Sports for CA Students</span>
        <span style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:8,color:"#333",letterSpacing:1}}>{new Date().toLocaleDateString("en-GB",{month:"short",year:"numeric"})}</span>
      </div>

    </div>
  );
}

function ResultsCard({caseData,score,maxScore,answers,onBack,simResult}){
  const pct   = Math.round((score/maxScore)*100);
  const grade = pct>=90?"DISTINCTION":pct>=70?"MERIT":pct>=50?"PASS":"DEVELOPING";
  const gc    = pct>=90?T.green:pct>=70?T.gold:pct>=50?T.blue:T.red;

  const [tab,setTab]       = useState("results");
  const [copied,setCopied] = useState(false);

  const isSimResult  = !!simResult;
  const company      = simResult?.caseCompany || caseData?.company || "";
  const diff         = simResult?.caseDiff    || caseData?.difficulty || "SEED";
  const ctype        = simResult?.caseType    || caseData?.type || "scenario";
  const caseId       = caseData?.id || "";

  const displayPct   = isSimResult ? null  : pct;
  const displayScore = isSimResult ? null  : score;
  const displayGrade = isSimResult
    ? (simResult.endingType==="perfect"?"OPTIMAL":simResult.endingType==="good"?"RECOVERED":"FAILED")
    : grade;
  const displayGC    = isSimResult
    ? (simResult.endingType==="bad"?T.red:T.green)
    : gc;

  /* per-question data */
  const topAnswers = caseData?.questions?.map(q=>{
    const ans = answers?.[q.id];
    const opt = q.options?.find(o=>o.id===ans);
    const pts = opt?.score||0;
    return{q:q.text.slice(0,80)+"…", verdict:pts===100?"✓ Optimal":pts>=70?"◎ Strong":pts>=50?"△ Partial":"✗ Missed", pts, insight:q.insight||""};
  })||[];

  /* insights list */
  const keyInsightLines = isSimResult
    ? (simResult.keyInsights||[])
    : (caseData?.questions?.map(q=>q.insight)||[]);

  const synopsis  = CASE_SYNOPSIS_SHORT[caseId] || caseData?.synopsis?.slice(0,200)+"…" || "";
  const concepts  = CASE_CONCEPTS[caseId] || [];

  /* ── LinkedIn caption (rich, structured) ── */
  const optimalCount = topAnswers.filter(a=>a.pts===100).length;
  const captionParts = [
    `📋 CA Arena — Case Study Report`,
    ``,
    `Company: ${company}`,
    `Format: ${ctype==="financial"?"Financial Statement Analysis":"Business Scenario"}${isSimResult?" (Branching Simulation)":""}`,
    `Difficulty: ${diff}`,
    ``,
    `📌 What this case covered:`,
    synopsis,
    ``,
    isSimResult
      ? `🔀 Simulation outcome: ${displayGrade} — ${simResult.log?.length||0} decisions across ${simResult.log?.[simResult.log.length-1]?.month||"?"} months`
      : `📊 Result: ${displayPct}% · ${displayGrade} · ${optimalCount}/${topAnswers.length} optimal decisions`,
    ``,
    `🧠 CA concepts examined:`,
    concepts.slice(0,5).map((c,i)=>`   ${i+1}. ${c}`).join("\n"),
    ``,
    `💡 Key analytical takeaways:`,
    keyInsightLines.slice(0,isSimResult?4:3).map((ins,i)=>`   ${i+1}. ${String(ins).replace(/…$/,"")}`).join("\n"),
    ``,
    !isSimResult&&topAnswers.length>0
      ? [`📝 Decision breakdown:`,
         ...topAnswers.map((a,i)=>`   Q${i+1}: ${a.verdict} (${a.pts}/100)`),
        ].join("\n")
      : isSimResult&&simResult?.log
      ? [`🔀 Path taken:`,
         ...(simResult.log.slice(0,5).map((e,i)=>`   ${i+1}. [M${e.month}] ${e.label}`)),
        ].join("\n")
      : "",
    ``,
    `This is what CA education should be — real companies, real constraints, real financial decisions.`,
    ``,
    `#CharteredAccountancy #CAArenaPK #FinancialAnalysis #CAStudents #ICAP #BusinessAnalysis #FinancialModeling`,
  ].filter(x=>x!==false).join("\n");

  return(
    <div style={{minHeight:"100vh",background:T.bg,display:"flex",flexDirection:"column"}}>
      <TopBar label="RESULTS" onBack={onBack}/>
      <div style={{flex:1,overflowY:"auto",padding:"32px 24px",maxWidth:900,width:"100%",margin:"0 auto"}}>

        {/* Tab bar */}
        <div style={{display:"flex",borderBottom:`2px solid ${T.border}`,marginBottom:28}}>
          {[["results","Results"],["breakdown","Breakdown"],["linkedin","LinkedIn Card"]].map(([id,label])=>(
            <button key={id} onClick={()=>setTab(id)} style={{background:"none",border:"none",borderBottom:tab===id?`2px solid ${T.gold}`:"2px solid transparent",padding:"10px 22px",cursor:"pointer",fontFamily:T.mono,fontSize:10,color:tab===id?T.gold:T.dim,letterSpacing:2,marginBottom:-2,transition:"all .15s"}}>{label.toUpperCase()}</button>
          ))}
        </div>

        {/* ── RESULTS TAB ── */}
        {tab==="results"&&(
          <div style={{animation:"fadeUp .3s both"}}>
            <div style={{background:T.surf,border:`2px solid ${displayGC}33`,padding:"30px 26px",marginBottom:18,position:"relative",overflow:"hidden"}}>
              <div style={{position:"absolute",top:0,right:0,width:200,height:200,background:`radial-gradient(circle at top right,${displayGC}10,transparent 70%)`,pointerEvents:"none"}}/>
              <div style={{display:"flex",alignItems:"center",gap:32,flexWrap:"wrap"}}>
                <div>
                  <div style={{fontFamily:T.mono,fontSize:8,color:T.dim,letterSpacing:3,marginBottom:6}}>{isSimResult?"SIMULATION OUTCOME":"FINAL SCORE"}</div>
                  {!isSimResult&&<div style={{fontFamily:T.serif,fontSize:60,color:displayGC,fontWeight:900,lineHeight:1}}>{displayPct}<span style={{fontSize:22,color:T.dim}}>%</span></div>}
                  {isSimResult&&<div style={{fontFamily:T.serif,fontSize:38,color:displayGC,fontWeight:900,lineHeight:1}}>{displayGrade}</div>}
                  {!isSimResult&&<div style={{fontFamily:T.mono,fontSize:11,color:T.muted,marginTop:3}}>{displayScore} / {maxScore} pts</div>}
                </div>
                <div style={{flex:1,minWidth:160}}>
                  {!isSimResult&&<div style={{fontFamily:T.serif,fontSize:26,color:displayGC,fontWeight:700,marginBottom:8}}>{grade}</div>}
                  <div style={{display:"flex",gap:7,flexWrap:"wrap",marginBottom:10}}>
                    <Tag color={DC[diff]}>{diff}</Tag>
                    <Tag color={ctype==="financial"?T.blue:T.gold}>{ctype==="financial"?"FINANCIAL STMT":"SCENARIO"}</Tag>
                    {isSimResult&&<Tag color={T.blue}>LIVE SIM</Tag>}
                  </div>
                  <div style={{fontFamily:T.sans,fontSize:12,color:T.dim,lineHeight:1.7}}>{company}</div>
                </div>
              </div>
            </div>

            {/* Case synopsis */}
            {synopsis&&(
              <div style={{background:T.surf,border:`1px solid ${T.border}`,padding:"16px 18px",marginBottom:14}}>
                <div style={{fontFamily:T.mono,fontSize:8,color:T.muted,letterSpacing:3,marginBottom:6}}>CASE OVERVIEW</div>
                <p style={{fontFamily:T.sans,fontSize:13,color:"#888",lineHeight:1.75,margin:0}}>{synopsis}</p>
              </div>
            )}

            {/* Sim decision log */}
            {isSimResult&&simResult.log&&(
              <div style={{background:T.surf,border:`1px solid ${T.border}`,padding:"18px 20px",marginBottom:14}}>
                <div style={{fontFamily:T.mono,fontSize:8,color:T.muted,letterSpacing:3,marginBottom:12}}>DECISIONS LOG</div>
                {simResult.log.map((e,i)=>(
                  <div key={i} style={{display:"flex",gap:10,alignItems:"center",padding:"7px 0",borderBottom:i<simResult.log.length-1?`1px solid ${T.muted}`:"none"}}>
                    <div style={{width:18,height:18,background:T.muted,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><span style={{fontFamily:T.mono,fontSize:8,color:T.dim}}>{i+1}</span></div>
                    <div style={{flex:1}}><div style={{fontFamily:T.sans,fontSize:12,color:"#bbb"}}>{e.label}</div><div style={{fontFamily:T.mono,fontSize:8,color:T.muted}}>Month {e.month}</div></div>
                  </div>
                ))}
              </div>
            )}

            <button onClick={()=>setTab("linkedin")} style={{width:"100%",background:T.gold,border:"none",color:"#000",fontFamily:T.mono,fontSize:11,fontWeight:800,padding:"12px",cursor:"pointer",letterSpacing:2}}>GENERATE LINKEDIN CARD →</button>
          </div>
        )}

        {/* ── BREAKDOWN TAB ── */}
        {tab==="breakdown"&&!isSimResult&&(
          <div style={{animation:"fadeUp .3s both"}}>
            <div style={{fontFamily:T.mono,fontSize:8,color:T.muted,letterSpacing:3,marginBottom:14}}>QUESTION BREAKDOWN</div>
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              {caseData.questions.map((q,i)=>{
                const ans=answers[q.id];
                const opt=q.options.find(o=>o.id===ans);
                const pts=opt?.score||0;
                const correct=pts===100;
                return(
                  <div key={q.id} style={{background:T.surf,border:`1px solid ${T.border}`,padding:"15px 16px"}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:7,gap:10}}>
                      <div style={{flex:1}}>
                        <span style={{fontFamily:T.mono,fontSize:8,color:T.dim,letterSpacing:2,marginRight:8}}>Q{i+1}</span>
                        <span style={{fontFamily:T.sans,fontSize:12,color:"#999"}}>{q.text.slice(0,90)}…</span>
                      </div>
                      <span style={{fontFamily:T.mono,fontSize:12,fontWeight:700,color:correct?T.green:pts>=60?T.gold:T.red,flexShrink:0}}>{pts}/100</span>
                    </div>
                    <div style={{height:3,background:T.muted,marginBottom:8}}>
                      <div style={{height:"100%",width:`${pts}%`,background:correct?T.green:pts>=60?T.gold:T.red,transition:"width .5s"}}/>
                    </div>
                    <div style={{fontFamily:T.sans,fontSize:11.5,color:"#666",lineHeight:1.65,marginBottom:correct?0:6}}>{q.insight}</div>
                    {!correct&&q.wrongMoves?.[ans]&&(
                      <div style={{fontFamily:T.sans,fontSize:11,color:T.red+"bb",borderLeft:`2px solid ${T.red}44`,paddingLeft:9,lineHeight:1.6}}>{q.wrongMoves[ans]}</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {tab==="breakdown"&&isSimResult&&(
          <div style={{animation:"fadeUp .3s both",fontFamily:T.sans,fontSize:13,color:T.dim,padding:"16px 0",lineHeight:1.7}}>
            The decision breakdown for simulation cases is visible in the Results tab and embedded in the LinkedIn card. Each decision and its consequence are recorded in the path.
          </div>
        )}

        {/* ── LINKEDIN TAB ── */}
        {tab==="linkedin"&&(
          <div style={{animation:"fadeUp .3s both"}}>
            <div style={{fontFamily:T.mono,fontSize:8,color:T.muted,letterSpacing:3,marginBottom:14}}>SHARE CARD PREVIEW</div>

            <LinkedInCardPreview
              company={company} diff={diff} ctype={ctype}
              displayPct={displayPct} displayGrade={displayGrade} displayGC={displayGC}
              isSimResult={isSimResult} simResult={simResult}
              caseData={caseData} score={score} maxScore={maxScore}
              topAnswers={topAnswers} keyInsightLines={keyInsightLines}
              synopsis={synopsis} concepts={concepts}
            />

            {/* Caption block */}
            <div style={{marginTop:22}}>
              <div style={{fontFamily:T.mono,fontSize:8,color:T.muted,letterSpacing:3,marginBottom:10}}>POST CAPTION — COPY & PASTE TO LINKEDIN</div>
              <div style={{background:T.surf,border:`1px solid ${T.border}`,padding:"14px 16px",marginBottom:14,maxHeight:320,overflowY:"auto"}}>
                <pre style={{fontFamily:T.sans,fontSize:12.5,color:"#777",lineHeight:1.8,margin:0,whiteSpace:"pre-wrap"}}>{captionParts}</pre>
              </div>
              <div style={{display:"flex",gap:10}}>
                <button onClick={()=>{
                  try{navigator.clipboard.writeText(captionParts);}catch(e){}
                  setCopied(true);setTimeout(()=>setCopied(false),2400);
                }} style={{flex:1,background:copied?T.green:T.surf,border:`2px solid ${copied?T.green:T.border}`,color:copied?"#000":T.txt,fontFamily:T.mono,fontSize:11,fontWeight:700,padding:"12px",cursor:"pointer",letterSpacing:2,transition:"all .25s"}}>{copied?"✓ COPIED TO CLIPBOARD":"COPY CAPTION"}</button>
                <button style={{flex:1,background:"#0077b5",border:"none",color:"#fff",fontFamily:T.mono,fontSize:11,fontWeight:800,padding:"12px",cursor:"pointer",letterSpacing:2}}>SHARE ON LINKEDIN →</button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   BOARDROOM
═══════════════════════════════════════════════════════════════════ */
const SLIDES=[
  {title:"Lucky Cement Ltd. — Capex Decision FY2025",sub:"Board Presentation · Strategic Finance",type:"cover"},
  {title:"Financial Position",sub:"FY2024 vs FY2023",type:"bullets",points:["Revenue: PKR 92B (+8.2% YoY)","EBITDA Margin: 31.4% (▼2.1pp)","Net Debt: PKR 28B (ND/EBITDA: 0.9x)","Proposed Capex: PKR 18B — new production kiln"]},
  {title:"Strategic Rationale",sub:"Why expand now?",type:"bullets",points:["Cement demand CAGR +6% through FY2028 (PSDP-driven)","Current utilisation: 94% — at capacity ceiling","New kiln adds 1.8M tons/year","Payback period: 6–7 years at current prices"]},
  {title:"Risk Matrix",sub:"Key concerns",type:"bullets",points:["Post-capex ND/EBITDA rises to 2.1x","Coal price volatility: energy = 38% of COGS","PKRUSD depreciation on imported equipment","Demand concentration: 3 projects = 40% of revenue"]},
  {title:"Recommendation",sub:"Capital allocation decision",type:"rec",text:"Proceed with PKR 18B kiln capex, funded 60/40 debt/internal cash. Defer dividend increase 24 months. Hedge USD exposure on equipment import via forward contracts. Re-evaluate in Q2 FY2026 against utilisation data."},
];
function Boardroom({onBack}){
  const [msgs,setMsgs]=useState([
    {id:1,user:"Z.Khan",role:"AUDIENCE",text:"The capex justification is weak — no IRR or NPV disclosed. How does the presenter respond to that gap?",time:"1m",vote:14,type:"challenge"},
    {id:2,user:"H.Raza",role:"AUDIENCE",text:"KIBOR hedging wasn't addressed. At 22% KIBOR, the debt service cost on PKR 10.8B borrowed should be quantified explicitly.",time:"2m",vote:9,type:"challenge"},
    {id:3,user:"S.Mirza",role:"AUDIENCE",text:"The demand CAGR analysis was solid — properly cited PSDP infrastructure data. NIM slide was strong.",time:"3m",vote:17,type:"praise"},
  ]);
  const [newMsg,setNewMsg]=useState("");
  const [msgType,setMsgType]=useState("comment");
  const [votes,setVotes]=useState({clarity:72,depth:58,defence:44});
  const [slideIdx,setSlideIdx]=useState(0);
  const [presMode,setPresMode]=useState(false);
  const feedRef=useRef(null);
  function sendMsg(){if(!newMsg.trim())return;setMsgs(p=>[...p,{id:Date.now(),user:"You",role:"AUDIENCE",text:newMsg,time:"now",vote:0,type:msgType}]);setNewMsg("");setTimeout(()=>feedRef.current?.scrollTo({top:99999,behavior:"smooth"}),60);}
  const vc=v=>v>=70?T.green:v>=50?T.gold:T.red;
  return(
    <div style={{height:"100vh",background:T.bg,display:"flex",flexDirection:"column",overflow:"hidden"}}>
      <TopBar label="THE BOARDROOM" sub="LIVE" onBack={onBack} right={
        <div style={{display:"flex",gap:10,alignItems:"center"}}>
          <div style={{display:"flex",alignItems:"center",gap:6}}><div style={{width:7,height:7,borderRadius:"50%",background:T.blue,animation:"pulse 1.2s infinite"}}/><span style={{fontFamily:T.mono,fontSize:9,color:T.blue,letterSpacing:2}}>LIVE</span></div>
          <span style={{fontFamily:T.mono,fontSize:9,color:T.dim}}>218 watching</span>
          <button onClick={()=>setPresMode(v=>!v)} style={{background:presMode?T.blue:"transparent",border:`1px solid ${T.blue}`,color:presMode?"#000":T.blue,fontFamily:T.mono,fontSize:9,padding:"4px 12px",cursor:"pointer",letterSpacing:2}}>{presMode?"AUDIENCE":"PRESENTER"}</button>
        </div>
      }/>
      <div style={{background:T.surf2,borderBottom:`1px solid ${T.border}`,padding:"5px 28px",fontFamily:T.mono,fontSize:9,color:T.dim,letterSpacing:1,flexShrink:0}}>Lucky Cement Ltd. — Capex Decision FY2025 · Presenter: A.Farooq</div>
      <div style={{flex:1,display:"flex",overflow:"hidden",minHeight:0}}>
        <div style={{flex:1,display:"flex",flexDirection:"column",borderRight:`2px solid ${T.border}`,overflow:"hidden"}}>
          <div style={{flex:1,display:"flex",flexDirection:"column",justifyContent:"center",padding:"44px 50px",position:"relative",overflow:"hidden"}}>
            <svg style={{position:"absolute",inset:0,opacity:.04,pointerEvents:"none",width:"100%",height:"100%"}}><defs><pattern id="dots" x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse"><circle cx="12" cy="12" r="1.2" fill={T.blue}/></pattern></defs><rect width="100%" height="100%" fill="url(#dots)"/></svg>
            <div style={{position:"relative",animation:"fadeIn .3s both"}}>
              {SLIDES[slideIdx].type==="cover"&&<><Tag color={T.blue} small>{`SLIDE ${slideIdx+1} / ${SLIDES.length}`}</Tag><div style={{height:24}}/><h1 style={{fontFamily:T.serif,fontSize:"clamp(20px,3vw,36px)",color:T.txt,marginBottom:10,fontWeight:900,lineHeight:1.05}}>{SLIDES[slideIdx].title}</h1><p style={{fontFamily:T.mono,fontSize:11,color:T.blue,letterSpacing:2}}>{SLIDES[slideIdx].sub}</p></>}
              {SLIDES[slideIdx].type==="bullets"&&<><Tag color={T.blue} small>{`SLIDE ${slideIdx+1} / ${SLIDES.length}`}</Tag><div style={{height:16}}/><h2 style={{fontFamily:T.serif,fontSize:26,color:T.txt,marginBottom:4,fontWeight:700}}>{SLIDES[slideIdx].title}</h2><p style={{fontFamily:T.mono,fontSize:9,color:T.blue,letterSpacing:2,marginBottom:22}}>{SLIDES[slideIdx].sub}</p><div style={{display:"flex",flexDirection:"column",gap:10}}>{SLIDES[slideIdx].points.map((p,i)=><div key={i} style={{display:"flex",alignItems:"flex-start",gap:10}}><div style={{width:5,height:5,background:T.gold,flexShrink:0,marginTop:7}}/><span style={{fontFamily:T.sans,fontSize:14.5,color:"#ccc",lineHeight:1.6}}>{p}</span></div>)}</div></>}
              {SLIDES[slideIdx].type==="rec"&&<><Tag color={T.gold} small>{`SLIDE ${slideIdx+1} / ${SLIDES.length}`}</Tag><div style={{height:16}}/><h2 style={{fontFamily:T.serif,fontSize:26,color:T.txt,marginBottom:4,fontWeight:700}}>{SLIDES[slideIdx].title}</h2><p style={{fontFamily:T.mono,fontSize:9,color:T.gold,letterSpacing:2,marginBottom:18}}>{SLIDES[slideIdx].sub}</p><div style={{background:T.goldD,border:`1px solid ${T.goldM}`,padding:"18px 20px"}}><p style={{fontFamily:T.sans,fontSize:14.5,color:T.txt,lineHeight:1.8}}>{SLIDES[slideIdx].text}</p></div></>}
            </div>
          </div>
          <div style={{borderTop:`2px solid ${T.border}`,padding:"12px 22px",display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0}}>
            <button disabled={slideIdx===0} onClick={()=>setSlideIdx(v=>v-1)} style={{background:"none",border:`1px solid ${slideIdx===0?T.muted:T.dim}`,color:slideIdx===0?T.muted:T.dim,fontFamily:T.mono,fontSize:9,padding:"5px 14px",cursor:slideIdx===0?"not-allowed":"pointer",letterSpacing:2}}>← PREV</button>
            <div style={{display:"flex",gap:5}}>{SLIDES.map((_,i)=><div key={i} onClick={()=>setSlideIdx(i)} style={{width:i===slideIdx?16:5,height:5,background:i===slideIdx?T.blue:T.mid,transition:"width .2s",cursor:"pointer"}}/>)}</div>
            <button disabled={slideIdx===SLIDES.length-1} onClick={()=>setSlideIdx(v=>v+1)} style={{background:"none",border:`1px solid ${slideIdx===SLIDES.length-1?T.muted:T.blue}`,color:slideIdx===SLIDES.length-1?T.muted:T.blue,fontFamily:T.mono,fontSize:9,padding:"5px 14px",cursor:slideIdx===SLIDES.length-1?"not-allowed":"pointer",letterSpacing:2}}>NEXT →</button>
          </div>
          <div style={{borderTop:`2px solid ${T.border}`,padding:"12px 22px",display:"flex",gap:22,alignItems:"center",flexShrink:0}}>
            {[["Clarity","clarity"],["Depth","depth"],["Defence","defence"]].map(([l,k])=>(
              <div key={k} style={{flex:1}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span style={{fontFamily:T.mono,fontSize:8,color:T.dim,letterSpacing:1.5}}>{l.toUpperCase()}</span><span style={{fontFamily:T.mono,fontSize:9,color:vc(votes[k]),fontWeight:700}}>{votes[k]}%</span></div>
                <div style={{height:4,background:T.muted}}><div style={{height:"100%",width:`${votes[k]}%`,background:vc(votes[k]),transition:"width .5s"}}/></div>
              </div>
            ))}
            {presMode&&<div style={{display:"flex",gap:5,flexShrink:0}}>{[["C","clarity",8],["D","depth",8],["X","defence",-10]].map(([l,k,d])=><button key={k} onClick={()=>setVotes(v=>({...v,[k]:Math.min(100,Math.max(0,v[k]+d))}))} style={{background:T.goldD,border:`1px solid ${T.goldM}`,color:T.gold,fontFamily:T.mono,fontSize:8,padding:"3px 7px",cursor:"pointer"}}>{l}{d>0?"+":""}{d}</button>)}</div>}
          </div>
        </div>
        <div style={{width:310,display:"flex",flexDirection:"column",overflow:"hidden",flexShrink:0}}>
          <div style={{padding:"11px 16px",borderBottom:`1px solid ${T.border}`,fontFamily:T.mono,fontSize:8,color:T.dim,letterSpacing:2,flexShrink:0}}>AUDIENCE FEED · {msgs.length}</div>
          <div ref={feedRef} style={{flex:1,overflowY:"auto",padding:"12px 14px",display:"flex",flexDirection:"column",gap:9}}>
            {msgs.map((m,i)=>(
              <div key={m.id} style={{borderLeft:`3px solid ${m.type==="challenge"?T.red:m.type==="praise"?T.green:T.mid}`,paddingLeft:9,paddingBottom:10,borderBottom:i<msgs.length-1?`1px solid ${T.muted}`:"none"}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:3,gap:4,flexWrap:"wrap"}}>
                  <span style={{fontFamily:T.mono,fontSize:10,color:m.user==="You"?T.gold:"#ccc",fontWeight:700}}>{m.user}</span>
                  <div style={{display:"flex",gap:5,alignItems:"center"}}><Tag color={m.type==="challenge"?T.red:m.type==="praise"?T.green:T.muted} small>{m.type.toUpperCase()}</Tag><span style={{fontFamily:T.mono,fontSize:7,color:T.muted}}>{m.time}</span></div>
                </div>
                <p style={{fontFamily:T.sans,fontSize:12,color:"#777",lineHeight:1.6,margin:0}}>{m.text}</p>
                <button onClick={()=>setMsgs(p=>p.map(x=>x.id===m.id?{...x,vote:x.vote+1}:x))} style={{marginTop:5,background:"none",border:`1px solid ${T.border}`,color:T.dim,fontFamily:T.mono,fontSize:7,padding:"2px 7px",cursor:"pointer",letterSpacing:1}}>▲ {m.vote}</button>
              </div>
            ))}
          </div>
          <div style={{padding:"10px 14px",borderTop:`2px solid ${T.border}`,flexShrink:0}}>
            <div style={{display:"flex",gap:3,marginBottom:7}}>
              {["comment","challenge","praise"].map(t=><button key={t} onClick={()=>setMsgType(t)} style={{flex:1,background:msgType===t?(t==="challenge"?T.red:t==="praise"?T.green:T.gold):"transparent",border:`1px solid ${t==="challenge"?T.red:t==="praise"?T.green:T.gold}`,color:msgType===t?"#000":(t==="challenge"?T.red:t==="praise"?T.green:T.gold),fontFamily:T.mono,fontSize:7,padding:"4px 0",cursor:"pointer",letterSpacing:1}}>{t.toUpperCase()}</button>)}
            </div>
            <div style={{display:"flex",gap:7}}>
              <input value={newMsg} onChange={e=>setNewMsg(e.target.value)} onKeyDown={e=>e.key==="Enter"&&sendMsg()} placeholder="Add your comment..." style={{flex:1,background:T.surf,border:`1px solid ${T.border}`,color:T.txt,fontFamily:T.sans,fontSize:12,padding:"7px 10px"}}/>
              <button onClick={sendMsg} style={{background:T.blue,border:"none",color:"#000",fontFamily:T.mono,fontSize:10,fontWeight:800,padding:"0 12px",cursor:"pointer"}}>→</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   AUTH MODAL
═══════════════════════════════════════════════════════════════════ */
function AuthModal({onClose, onAuth}){
  const [mode,setMode]   = useState("signin"); // "signin" | "signup"
  const [email,setEmail] = useState("");
  const [password,setPassword]   = useState("");
  const [username,setUsername] = useState("");
  const [err,setErr]     = useState("");
  const [loading,setLoading] = useState(false);

  async function handleSubmit() {
   setErr("");
   setLoading(true);

   try {
    if (mode === "signup") {
      if (!username.trim()) {
        setErr("Username is required");
        return;
      }

      const { data: signUpData, error: signUpError } =
        await supabase.auth.signUp({ email, password });

      if (signUpError) {
        setErr(signUpError.message);
        return;
      }

      const user = signUpData?.user;
      const session = signUpData?.session;

      const userId = user?.id;
      const {data: { session: currentsession }} = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!userId || !session) {
        setErr("Auth session not ready");
      return;
      }
      if (userId) {
        await supabase.from("profiles").upsert({
          id: userId,
          username: username.trim(),
          xp: 0,
          rank: "SEED",
          cases_completed: 0,
          xp_gained_today: 0,
        });
      }

      onAuth({
        token,
        user: {
          id: userId,
          username: username.trim(),
          xp: 0,
          rank: "SEED",
          cases_completed: 0,
          xp_gained_today: 0,
        },
      });

    } else {
      const { data: signInData, error: signInError } =
        await supabase.auth.signInWithPassword({ email, password });

      if (signInError) {
        setErr(signInError.message);
        return;
      }

      const session = signInData?.session;
      const user = signInData?.user;

      // Fetch profile
      const { data: profiles, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id);

      if (profileError) console.log(profileError);

      const profile =
        profiles?.[0] || {
          id: user.id,
          username: email.split("@")[0],
          xp: 0,
          rank: "SEED",
          cases_completed: 0,
          xp_gained_today: 0,
        };

      localStorage.setItem("ca_token", session?.access_token);
      localStorage.setItem("ca_user", JSON.stringify(profile));

      onAuth({
        token: session?.access_token,
        user: profile,
      });
    }

   } catch (e) {
    setErr(e.message || "Network error");
   } finally {
    setLoading(false);
   }
  }

  const inp = {
    background:T.surf, border:`1px solid ${T.border}`, color:T.txt,
    fontFamily:T.sans, fontSize:13, padding:"10px 14px", width:"100%",
    marginBottom:10, outline:"none", borderRadius:2,
  };

  return(
    <div style={{position:"fixed",inset:0,background:"#000000cc",display:"flex",alignItems:"center",justifyContent:"center",zIndex:999,animation:"fadeIn .2s both"}}
      onClick={onClose}>
      <div style={{background:T.surf,border:`2px solid ${T.gold}`,padding:"40px 36px",width:380,animation:"fadeUp .25s both"}}
        onClick={e=>e.stopPropagation()}>
        {/* Tab */}
        <div style={{display:"flex",gap:0,borderBottom:`2px solid ${T.border}`,marginBottom:28}}>
          {[["signin","Sign In"],["signup","Sign Up"]].map(([id,label])=>(
            <button key={id} onClick={()=>{setMode(id);setErr("");}} style={{flex:1,background:"none",border:"none",borderBottom:mode===id?`2px solid ${T.gold}`:"2px solid transparent",padding:"9px 0",cursor:"pointer",fontFamily:T.mono,fontSize:10,color:mode===id?T.gold:T.dim,letterSpacing:2,marginBottom:-2}}>{label.toUpperCase()}</button>
          ))}
        </div>
        {mode==="signup"&&(
          <input value={username} onChange={e=>setUsername(e.target.value)} placeholder="Username (shown on leaderboard)" style={inp}/>
        )}
        <input value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email" type="email" style={inp}/>
        <input value={password} onChange={e=>setPassword(e.target.value)} placeholder="Password" type="password" style={{...inp,marginBottom:0}}
          onKeyDown={e=>e.key==="Enter"&&handleSubmit()}/>
        {err&&<div style={{fontFamily:T.mono,fontSize:10,color:T.red,marginTop:10,letterSpacing:1}}>{err}</div>}
        <button onClick={handleSubmit} disabled={loading} style={{width:"100%",marginTop:20,background:loading?T.mid:T.gold,border:"none",color:"#000",fontFamily:T.mono,fontSize:11,fontWeight:800,padding:"12px",cursor:loading?"not-allowed":"pointer",letterSpacing:2,transition:"background .15s"}}>
          {loading?"LOADING…":mode==="signin"?"SIGN IN →":"CREATE ACCOUNT →"}
        </button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   XP TOAST — shown after completing a case
═══════════════════════════════════════════════════════════════════ */
function XPToast({xp, rank, prevRank, onDone}){
  useEffect(()=>{ const t=setTimeout(onDone, 4000); return()=>clearTimeout(t); },[]);
  const promoted = rank!==prevRank;
  return(
    <div style={{position:"fixed",bottom:28,right:28,background:T.surf,border:`2px solid ${T.gold}`,padding:"18px 22px",zIndex:500,animation:"fadeUp .3s both",minWidth:240}}>
      <div style={{fontFamily:T.mono,fontSize:8,color:T.gold,letterSpacing:3,marginBottom:6}}>▸ XP EARNED</div>
      <div style={{fontFamily:T.serif,fontSize:28,color:T.gold,fontWeight:900,lineHeight:1}}>+{xp} XP</div>
      {promoted&&<div style={{fontFamily:T.mono,fontSize:10,color:T.green,marginTop:6,letterSpacing:2}}>★ RANK UP → {rank}</div>}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   ROOT APP — Supabase connected
═══════════════════════════════════════════════════════════════════ */
export default function App(){
  /* ── state ── */
  const [screen,setScreen]       = useState("lobby");
  const [activeCaseId,setActiveCaseId] = useState(null);
  const [simResult,setSimResult] = useState(null);

  /* Auth */
  const [token,setToken]   = useState(()=>localStorage.getItem("ca_token")||null);
  const [user,setUser]     = useState(()=>{
    try{ return JSON.parse(localStorage.getItem("ca_user")||"null"); }catch{ return null; }
  });
  const [showAuth,setShowAuth]   = useState(false);

  /* Live data from Supabase */
  const [leaderboard,setLeaderboard] = useState([]);
  const [feed,setFeed]               = useState([]);
  const [caseList,setCaseList]       = useState(CASE_LIST_FALLBACK);

  /* XP toast */
  const [xpToast,setXpToast] = useState(null); // {xp, rank, prevRank}

  /* ── Restore session on mount + fetch live data ── */
  useEffect(()=>{
    // Validate stored token
    if(token){
      supabase.auth.getUser(token)
        .then(u=>{ if(u.error){ clearSession(); } })
        .catch(()=>clearSession());
    }
    fetchLiveData();
    // Refresh leaderboard every 60s
    const iv = setInterval(fetchLeaderboard, 60000);
    return ()=>clearInterval(iv);
  },[]);

  async function fetchLiveData(){
    await Promise.all([fetchLeaderboard(), fetchFeed(), fetchCaseList()]);
  }

  async function fetchLeaderboard(){
    try{
      const data = await supabase.from("profiles",{
        select:"id,username,xp,rank,cases_completed,xp_gained_today",
        order:"xp.desc",
        limit:10,
      }, token||undefined);
      if(Array.isArray(data)) setLeaderboard(data);
    }catch(e){ console.warn("Leaderboard fetch failed:", e.message); }
  }

  async function fetchFeed(){
    try{
      const data = await supabase.from("activity_feed",{
        select:"username,action_text,type,time_ago",
        order:"created_at.desc",
        limit:6,
      });
      if(Array.isArray(data)) setFeed(data);
    }catch(e){ /* feed is optional — silently fail */ }
  }

  async function fetchCaseList(){
    try{
      const data = await supabase.from("cases",{
        select:"id,label,sub,type,diff,sector,avg_score,has_sim,active",
        eq:{ active:"true" },
        order:"sort_order.asc",
      });
      if(Array.isArray(data)&&data.length>0){
        const mapped = data.map(c=>({
          id:      c.id,
          label:   c.label,
          sub:     c.sub,
          type:    c.type,
          diff:    c.diff,
          sector:  c.sector,
          avgScore:c.avg_score||"—",
          hasSim:  c.has_sim,
        }));
        setCaseList(mapped);
      }
    }catch(e){ console.warn("Case list fetch failed — using fallback:", e.message); }
  }

  /* ── Auth handlers ── */
  function handleAuth({token:t, user:u}){
    setToken(t); setUser(u);
    localStorage.setItem("ca_token", t);
    localStorage.setItem("ca_user", JSON.stringify(u));
    setShowAuth(false);
    fetchLeaderboard();
  }

  async function handleSignOut(){
    if(token) await supabase.auth.signOut(token).catch(()=>{});
    clearSession();
  }

  function clearSession(){
    setToken(null); setUser(null);
    localStorage.removeItem("ca_token");
    localStorage.removeItem("ca_user");
  }

  /* ── XP award — called after any case completion ── */
  async function awardXP(diff, caseId, scoreData){
    if(!user||!token) return;
    const gained = XP_REWARD[diff]||80;
    const newXp  = (user.xp||0) + gained;
    const prevRank = user.rank;
    const newRank  = xpToRank(newXp);
    const updated  = { ...user, xp:newXp, rank:newRank, cases_completed:(user.cases_completed||0)+1, xp_gained_today:(user.xp_gained_today||0)+gained };

    // Optimistic update
    setUser(updated);
    localStorage.setItem("ca_user", JSON.stringify(updated));
    setXpToast({ xp:gained, rank:newRank, prevRank });

    try{
      // Update profile in Supabase
      await supabase.patch("profiles",
        { xp:newXp, rank:newRank, cases_completed:updated.cases_completed, xp_gained_today:updated.xp_gained_today },
        { id:user.id }, token
      );
      // Log attempt
      await supabase.insert("user_attempts",{
        user_id: user.id,
        case_id: caseId,
        score:   scoreData?.score||0,
        max_score: scoreData?.maxScore||100,
        ending_type: scoreData?.endingType||null,
        completed_at: new Date().toISOString(),
      }, token);
      // Post to activity feed
      await supabase.insert("activity_feed",{
        username: user.username,
        action_text: `completed ${caseId} — ${newRank}`,
        type: "score",
        created_at: new Date().toISOString(),
        time_ago: "just now",
      }, token).catch(()=>{});
      // Refresh leaderboard
      fetchLeaderboard();
    }catch(e){ console.warn("XP save failed:", e.message); }
  }

  /* ── Navigation ── */
  function nav(s){
    if(s.startsWith("play-")||s.startsWith("case-")){
      const id = s.replace("play-","").replace("case-","");
      setActiveCaseId(id);
      setScreen(id==="GRC-SEED-01" ? "freshmart-sim" : "sim");
    } else {
      setScreen(s);
    }
  }

  function handleSimComplete(result){
    setSimResult(result);
    awardXP(result.caseDiff||"SEED","GRC-SEED-01",{ endingType:result.endingType });
    setScreen("sim-results");
  }

  function handleMCQComplete(caseData, score, maxScore){
    awardXP(caseData.difficulty, caseData.id, { score, maxScore });
  }

  /* ── Shared nav bar ── */
  function NavBar(){
    return(
      <div style={{height:56,borderBottom:`2px solid ${T.border}`,display:"flex",alignItems:"center",padding:"0 32px",justifyContent:"space-between",flexShrink:0}}>
        <div style={{display:"flex",alignItems:"baseline",gap:8,cursor:"pointer"}} onClick={()=>setScreen("lobby")}>
          <span style={{fontFamily:T.serif,fontSize:22,fontWeight:900,color:T.gold}}>CA</span>
          <span style={{fontFamily:T.mono,fontSize:13,fontWeight:700,letterSpacing:4,color:T.txt}}>ARENA</span>
          <span style={{fontFamily:T.mono,fontSize:8,color:T.muted,letterSpacing:2,marginLeft:4}}>BETA</span>
        </div>
        <div style={{display:"flex",gap:20,alignItems:"center"}}>
          {["Rankings","Progress","Boardroom"].map(x=>(
            <span key={x} style={{fontFamily:T.mono,fontSize:10,color:T.dim,cursor:"pointer",letterSpacing:1.5,transition:"color .15s"}}
              onMouseEnter={e=>e.currentTarget.style.color=T.gold}
              onMouseLeave={e=>e.currentTarget.style.color=T.dim}
              onClick={()=>x==="Boardroom"&&setScreen("boardroom")}>
              {x.toUpperCase()}
            </span>
          ))}
          {user ? (
            <div style={{display:"flex",gap:8,alignItems:"center"}}>
              <div style={{border:`1px solid ${T.goldM}`,padding:"5px 14px",fontFamily:T.mono,fontSize:10,color:T.gold,letterSpacing:1.5}}>
                {user.username} · {user.xp.toLocaleString()} XP
              </div>
              <button onClick={handleSignOut} style={{background:"none",border:`1px solid ${T.border}`,color:T.dim,fontFamily:T.mono,fontSize:9,padding:"5px 10px",cursor:"pointer",letterSpacing:1.5,transition:"all .15s"}}
                onMouseEnter={e=>{e.currentTarget.style.borderColor=T.red;e.currentTarget.style.color=T.red;}}
                onMouseLeave={e=>{e.currentTarget.style.borderColor=T.border;e.currentTarget.style.color=T.dim;}}>
                SIGN OUT
              </button>
            </div>
          ) : (
            <button onClick={()=>setShowAuth(true)} style={{border:`1px solid ${T.goldM}`,background:"transparent",padding:"5px 14px",fontFamily:T.mono,fontSize:10,color:T.gold,letterSpacing:1.5,cursor:"pointer"}}>
              SIGN IN / SIGN UP
            </button>
          )}
        </div>
      </div>
    );
  }

  /* Shared props passed to screens that show sidebar panels */
  const sidebarProps = { user, leaderboard, feed };

  return(
    <UserCtx.Provider value={{user,token,awardXP}}>
      <div style={{fontFamily:T.sans,background:T.bg,minHeight:"100vh"}}>
        <style>{css}</style>

        {/* ── LOBBY ── */}
        {screen==="lobby"&&(
          <div style={{minHeight:"100vh",background:T.bg,display:"flex",flexDirection:"column"}}>
            <NavBar/>
            <Lobby onNav={nav} caseList={caseList} {...sidebarProps}/>
          </div>
        )}
        {screen==="cases"&&(
          <CaseBrowser onNav={nav} onBack={()=>setScreen("lobby")} caseList={caseList} {...sidebarProps}/>
        )}
        {screen==="freshmart-sim"&&(
          <FreshMartSim onBack={()=>setScreen("cases")} onComplete={handleSimComplete}/>
        )}
        {screen==="sim"&&activeCaseId&&ALL_CASES[activeCaseId]&&(
          <SimRoom
            caseData={ALL_CASES[activeCaseId]}
            onBack={()=>setScreen("cases")}
            onComplete={handleMCQComplete}
          />
        )}
        {screen==="sim-results"&&simResult&&(
          <ResultsCard simResult={simResult} onBack={()=>setScreen("lobby")}/>
        )}
        {screen==="boardroom"&&<Boardroom onBack={()=>setScreen("lobby")}/>}

        {/* Auth modal */}
        {showAuth&&<AuthModal onClose={()=>setShowAuth(false)} onAuth={handleAuth}/>}

        {/* XP toast */}
        {xpToast&&<XPToast {...xpToast} onDone={()=>setXpToast(null)}/>}
      </div>
    </UserCtx.Provider>
  );
}
