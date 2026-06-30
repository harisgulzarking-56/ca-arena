import { useState, useEffect } from "react";

// ── SUPABASE CONFIG ───────────────────────────────────────────
const SB_URL = "https://gkcafcpkopuwdvbvvmuv.supabase.co";
const SB_KEY = "sb_publishable_6UWdUr_YymKM9KMhU0RjdQ_yygA4FUk";

async function sb(method, path, body, token) {
  const headers = {
    "Content-Type":  "application/json",
    "apikey":        SB_KEY,
    "Authorization": "Bearer " + (token || SB_KEY),
  };
  if (method === "POST" || method === "PATCH" || method === "PUT") {
    headers["Prefer"] = "return=representation";
  }
  const res = await fetch(SB_URL + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok && res.status !== 200 && res.status !== 201) {
    const txt = await res.text();
    throw new Error(txt || res.statusText);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

async function sbAuth(endpoint, payload) {
  const res = await fetch(SB_URL + endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", "apikey": SB_KEY },
    body: JSON.stringify(payload),
  });
  const d = await res.json();
  if (d.error || d.error_description) throw new Error(d.error_description || d.error?.message || "Auth failed");
  return d;
}

async function loadProfile(userId, token) {
  try {
    const rows = await sb("GET", "/rest/v1/profiles?id=eq." + userId + "&select=*", null, token);
    return rows && rows.length > 0 ? rows[0] : null;
  } catch { return null; }
}

async function upsertProfile(data, token) {
  try {
    await sb("POST", "/rest/v1/profiles", data, token);
  } catch {
    try { await sb("PATCH", "/rest/v1/profiles?id=eq." + data.id, data, token); } catch {}
  }
}

async function loadScenarios(token) {
  try {
    const rows = await sb("GET", "/rest/v1/scenarios?select=*&order=created_at.desc", null, token);
    return rows || [];
  } catch { return []; }
}

async function saveScenario(scenario, token) {
  try {
    await sb("POST", "/rest/v1/scenarios", scenario, token);
  } catch {}
}

async function loadMessages(token) {
  try {
    const rows = await sb("GET", "/rest/v1/boardroom_messages?select=*&order=created_at.asc&limit=100", null, token);
    return rows || [];
  } catch { return []; }
}

async function postMessage(msg, token) {
  try {
    await sb("POST", "/rest/v1/boardroom_messages", msg, token);
  } catch {}
}


const G = `
  @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&family=Crimson+Pro:ital,wght@0,300;0,400;0,600;1,400&display=swap');
  *{box-sizing:border-box;margin:0;padding:0;}
  body{background:#080810;color:#E2D9C8;font-family:'Crimson Pro',Georgia,serif;}
  ::-webkit-scrollbar{width:4px;} ::-webkit-scrollbar-thumb{background:#C8A96E30;}
  @keyframes fadeUp{from{opacity:0;transform:translateY(16px);}to{opacity:1;transform:translateY(0);}}
  @keyframes spinR{from{transform:rotate(0deg);}to{transform:rotate(360deg);}}
  @keyframes flicker{0%,100%{opacity:.7;}50%{opacity:.4;}}
  .fu{animation:fadeUp .45s ease both;}
`;

const GUILDS = [
  {id:"audit",   name:"Audit House",    sigil:"⚖", col:"#C8A96E", desc:"Masters of scrutiny. They find the lie in every ledger.",      bonus:"+15% XP on audit missions"},
  {id:"tax",     name:"Tax Syndicate",  sigil:"◈", col:"#7EC8A9", desc:"They bend the law without breaking it. Every rupee matters.",   bonus:"+20% Commission on tax missions"},
  {id:"advisory",name:"Advisory Corps", sigil:"◉", col:"#A98FD4", desc:"Strategy flows through them. Numbers are just their language.", bonus:"+10% on all decisions"},
  {id:"forensic",name:"Forensic Order", sigil:"✦", col:"#D4706A", desc:"They follow the money until it confesses.",                     bonus:"External Call costs 50% less"},
];

const MISSIONS = [
  {
    id:"m1", code:"M-001", title:"The Dying Firm",        concept:"Going Concern & Depreciation",
    client:"Karachi Textile Mills Ltd.", diff:"Initiate",   xp:120, comm:15000, locked:false,
  },
  {
    id:"m2", code:"M-002", title:"The Hidden Subsidiary", concept:"Consolidation & Group Accounts",
    client:"Lahore Holdings Pvt Ltd.",   diff:"Journeyman", xp:180, comm:22000, locked:true,
  },
  {
    id:"m3", code:"M-003", title:"The Bonus Scheme",      concept:"Financial Instruments & IFRS 9",
    client:"Faisal Bank Limited",        diff:"Journeyman", xp:200, comm:28000, locked:true,
  },
  {
    id:"m4", code:"M-004", title:"The Tax Shelter",       concept:"Deferred Tax & IAS 12",
    client:"ENGRO Corp — Tax Division",  diff:"Adept",      xp:250, comm:35000, locked:true,
  },
  {
    id:"m5", code:"M-005", title:"The Hostile Bid",       concept:"Business Combinations & IFRS 3",
    client:"Lucky Cement Limited",       diff:"Adept",      xp:300, comm:45000, locked:true,
  },
];

const PRELIMS = {
  m1:[
    {q:"Under IAS 16, which method allocates higher depreciation in early years?",      opts:["Straight-line","Reducing balance","Units of production","Sum-of-years"],                                    ans:1},
    {q:"Going concern assumption means the entity will continue for at least:",          opts:["6 months","1 year","5 years","Indefinitely"],                                                               ans:1},
    {q:"Substantial doubt about going concern requires the auditor to issue a:",         opts:["Clean opinion","Qualified opinion","Emphasis of Matter paragraph","Disclaimer of opinion"],                 ans:2},
    {q:"Residual value is best defined as:",                                             opts:["Book value at purchase","Estimated proceeds at end of useful life","Tax written-down value","NBV at year-end"],ans:1},
    {q:"PKR 50M machinery, 10-yr life, zero residual, straight-line. Annual charge:",   opts:["PKR 4M","PKR 5M","PKR 6M","PKR 10M"],                                                                       ans:1},
  ],
  m2:[
    {q:"Under IFRS 10, control exists when the investor has:",                           opts:["Majority shareholding only","Power + exposure to returns + ability to use power","Board representation","Veto rights"],ans:1},
    {q:"A subsidiary is excluded from consolidation when:",                              opts:["It operates in a different industry","It is held for sale under IFRS 5","Its year-end differs","The parent is foreign"],ans:1},
    {q:"Goodwill on consolidation arises when:",                                         opts:["Fair value of net assets > cost","Cost of investment > fair value of net assets","Book value exceeds market","Revenue exceeds cost"],ans:1},
    {q:"Non-controlling interest (NCI) is measured at:",                                 opts:["Cost","Fair value or proportionate share of net assets","Par value","Historical cost only"],                ans:1},
    {q:"Intra-group transactions on consolidation must be:",                             opts:["Disclosed separately","Eliminated in full","Partially eliminated","Adjusted for tax"],                       ans:1},
  ],
  m3:[
    {q:"Under IFRS 9, financial assets are classified based on:",                        opts:["Management intent only","Business model and cash flow characteristics","Maturity period","Issuer credit rating"],ans:1},
    {q:"The amortised cost category applies when cash flows are:",                       opts:["Variable and equity-linked","Solely payments of principal and interest","Linked to an index","Discretionary"],ans:1},
    {q:"A financial instrument classified as equity by the issuer means:",               opts:["It carries a fixed coupon","There is no contractual obligation to deliver cash","It matures within 1 year","It is convertible"],ans:1},
    {q:"Expected Credit Loss (ECL) under IFRS 9 is recognised:",                        opts:["Only on default","From initial recognition","After 90 days past due","On write-off"],                       ans:1},
    {q:"Fair value through OCI classification is used for:",                             opts:["Trading securities","Strategic equity investments (irrevocable election)","All derivatives","Held-to-maturity bonds"],ans:1},
  ],
  m4:[
    {q:"A deferred tax liability arises when:",                                          opts:["Accounting profit < taxable profit","Carrying amount > tax base of an asset","Tax paid > tax expense","A loss is carried forward"],ans:1},
    {q:"Temporary differences that give rise to deferred tax assets include:",           opts:["Accelerated tax depreciation","Warranty provisions not yet deductible","Revaluation gains","Prepaid expenses"],ans:1},
    {q:"The tax base of an asset is:",                                                   opts:["Its carrying amount","Amount deductible against future taxable profit","Its original cost","Fair value"],    ans:1},
    {q:"A deferred tax asset is recognised only when:",                                  opts:["The entity has paid taxes","Future taxable profit is probable","A tax audit is complete","Approved by SECP"], ans:1},
    {q:"Under IAS 12, deferred tax is measured using:",                                  opts:["Discounted future rates","Enacted or substantively enacted tax rates","Average historical rates","Management estimate"],ans:1},
  ],
  m5:[
    {q:"Under IFRS 3, goodwill is calculated as:",                                       opts:["Purchase price only","Consideration + NCI + previously held interest − fair value of net assets","Book value of target","Market cap of acquirer"],ans:1},
    {q:"The acquisition method requires fair value measurement of the acquiree's:",      opts:["Assets only","Identifiable assets and liabilities","Equity only","Goodwill only"],                          ans:1},
    {q:"Contingent consideration in a business combination is:",                         opts:["Ignored until probable","Recognised at fair value on acquisition date","Expensed immediately","Added to goodwill later"],ans:1},
    {q:"Bargain purchase (negative goodwill) is recognised as:",                         opts:["A liability","Directly in equity","A gain in profit or loss on acquisition date","Deferred income"],         ans:1},
    {q:"Transaction costs in a business combination under IFRS 3 are:",                  opts:["Added to goodwill","Capitalised as intangibles","Expensed as incurred","Deducted from NCI"],               ans:1},
  ],
};

const SIMS = {
  m1:{
    brief:"You arrive at KTM Ltd.'s head office in SITE Area. The CFO, Mr. Tariq, slides a file across the desk. 'The machinery is fully depreciated on paper,' he says quietly, 'but it still runs. The bank just needs the numbers to look right.' He pauses. 'We're counting on you.'",
    nodes:{
      start:{scene:"You review the fixed asset register. Machinery shows PKR 0 net book value — fully depreciated — but physical inspection confirms it's still operational. The bank loan application lists these assets as collateral at PKR 0.",choices:[
        {text:"Revalue assets upward under IAS 16 revaluation model — give the bank real numbers",next:"revalue",xp:20, comm:3000, note:"Technically sound. The bank gets transparency."},
        {text:"Flag going concern risk formally and disclose the asset situation to management",   next:"flag",   xp:30, comm:-2000,note:"Professional integrity. The CFO looks unhappy."},
        {text:"Accept the file as-is — the machinery still runs, perhaps it's acceptable",        next:"accept", xp:-20,comm:5000, note:"Short-term gain. Long-term exposure."},
      ]},
      revalue:{scene:"A valuation expert revalues machinery at PKR 28M. The bank is satisfied. But Mr. Tariq now reveals the machines need full replacement in 18 months — and the firm has no reserves for this.",choices:[
        {text:"Add an Emphasis of Matter paragraph disclosing the replacement risk", next:"eg",xp:40, comm:2000, note:"Full disclosure. Your reputation solidifies."},
        {text:"Stay quiet — the revaluation is done correctly, that's your scope",   next:"es",xp:10, comm:4000, note:"Technically complete. Professionally incomplete."},
      ]},
      flag:{scene:"You issue a report citing going concern doubt. The bank declines. KTM's board is furious. Three months later, a rival firm that ignored the same issue faces regulatory action.",choices:[
        {text:"Stand by your report and document every decision",               next:"eg2",xp:60, comm:-5000,note:"You lose the client. You gain something more valuable."},
        {text:"Offer to revise with softer language to save the relationship",  next:"eb", xp:-30,comm:8000, note:"You compromise your professional position."},
      ]},
      accept:{scene:"The loan is approved. Six months later the machinery fails. KTM defaults. The bank's lawyers contact you — your sign-off is on record.",choices:[
        {text:"Cooperate fully with investigators and document your reasoning", next:"es2",xp:-10,comm:-10000,note:"Painful, but the only defensible path."},
        {text:"Claim you were misled by management without evidence",           next:"ef", xp:-50,comm:-15000,note:"This compounds the problem."},
      ]},
      eg: {ending:true,type:"gold",  title:"Clean Hands, Clear Record", body:"You revalued correctly and disclosed the replacement risk. The bank made an informed decision. Your report became a case study in professional judgment."},
      eg2:{ending:true,type:"gold",  title:"The Principled Advisor",    body:"You lost the client and gained a reputation. Three firms now send referrals because of how you handled this. Integrity compounds."},
      es: {ending:true,type:"silver",title:"Job Done",                  body:"The revaluation was correct but incomplete. You did the minimum scope — not the full professional standard."},
      es2:{ending:true,type:"silver",title:"Costly Lesson",             body:"You made the wrong call early but cooperated honestly when it mattered. The investigation cleared you with a warning."},
      eb: {ending:true,type:"bronze",title:"The Soft Report",           body:"The loan went through with softened language. The risk was not disclosed. You will remember this file for a long time."},
      ef: {ending:true,type:"fail",  title:"Compounding Errors",        body:"Blaming management without evidence destroyed your credibility. This mission cost you heavily in XP, commission, and professional standing."},
    },
  },
  m2:{
    brief:"Lahore Holdings Pvt Ltd. has three subsidiaries — but one is buried inside a joint venture structure the parent insists falls outside IFRS 10 control. Your engagement partner flags it as a potential off-balance-sheet manoeuvre. The CFO says it's just 'creative structuring.'",
    nodes:{
      start:{scene:"You review the ownership structure. LH holds 48% of SubCo via a JV agreement, but the JV contract gives LH unilateral decision-making rights over SubCo's key activities and exposes it to 95% of variable returns.",choices:[
        {text:"Assert control exists under IFRS 10 — SubCo must be consolidated",               next:"assert",xp:30, comm:-3000,note:"Technically correct. The CFO is not pleased."},
        {text:"Treat it as an associate under IAS 28 — 48% suggests significant influence only", next:"assoc", xp:-10,comm:6000, note:"Takes the easy way out. But is it defensible?"},
        {text:"Request a legal opinion before making a determination",                           next:"legal", xp:20, comm:0,    note:"Cautious and professional."},
      ]},
      assert:{scene:"You consolidate SubCo. The group balance sheet now carries an additional PKR 340M in liabilities. The parent's debt-to-equity ratio breaches a bank covenant. The CFO demands you revisit.",choices:[
        {text:"Hold your position — the accounting is correct, covenant breach is management's problem",next:"eg", xp:50,comm:-2000,note:"You are right. Stand firm."},
        {text:"Adjust the consolidation method to equity accounting under pressure",                    next:"eb", xp:-40,comm:9000, note:"You cave to pressure."},
      ]},
      assoc:{scene:"You treat SubCo as an associate. Six months later, SubCo's undisclosed PKR 200M loss surfaces. Regulators investigate. The group's auditors note your prior work.",choices:[
        {text:"Immediately restate and consolidate — disclose the error",       next:"es", xp:10, comm:-8000,note:"Painful restatement, but the honest path."},
        {text:"Maintain the position — it was a judgement call at the time",    next:"ef", xp:-30,comm:0,    note:"This does not hold under scrutiny."},
      ]},
      legal:{scene:"The legal opinion confirms that LH's contractual rights constitute control under IFRS 10. You now have written backing. The CFO reviews the opinion and goes quiet.",choices:[
        {text:"Consolidate SubCo with the legal opinion on file",               next:"eg", xp:40,comm:1000, note:"Thorough and defensible. Excellent judgment."},
        {text:"Use the legal ambiguity to negotiate a disclosure-only approach", next:"eb", xp:-20,comm:7000, note:"You chose comfort over clarity."},
      ]},
      eg:{ending:true,type:"gold",  title:"The Group is Consolidated",   body:"You identified control correctly under IFRS 10 and held your position. The restatement was painful for the client but your work was cited as the standard approach in subsequent ICAP guidance."},
      es:{ending:true,type:"silver",title:"Late Correction",             body:"The restatement was messy and expensive, but you corrected it. Your reputation survived, though the engagement did not."},
      eb:{ending:true,type:"bronze",title:"Pressure Point",              body:"You adjusted under client pressure. The accounting was defensible on a technicality, but you know the substance was wrong."},
      ef:{ending:true,type:"fail",  title:"The Undisclosed Loss",        body:"Maintaining an indefensible position when evidence emerged cost you the engagement and your firm's credibility with the regulator."},
    },
  },
  m3:{
    brief:"Faisal Bank's structured product team has designed an instrument that pays a fixed coupon and is redeemable at par — but their legal team has classified it as equity to keep PKR 1.2B off the liabilities side of the balance sheet. You've been called in to review the classification.",
    nodes:{
      start:{scene:"You examine the instrument terms: fixed coupon of 12%, mandatory redemption in 5 years, no discretion on payment. The legal team insists the 'equity-like' name in the product documentation justifies equity classification.",choices:[
        {text:"Classify as a financial liability — substance over form, mandatory payments = liability", next:"liability",xp:35, comm:-4000,note:"Technically correct. IFRS 9 is clear on this."},
        {text:"Accept equity classification — the legal team has signed off",                           next:"equity",  xp:-20,comm:8000, note:"You defer to legal. Is that your role?"},
        {text:"Propose a hybrid split — portion as equity, portion as liability",                       next:"hybrid",  xp:15, comm:2000, note:"Creative, but is it supportable?"},
      ]},
      liability:{scene:"You reclassify to financial liability. PKR 1.2B moves onto the balance sheet. The CAR ratio drops below the SBP minimum. The CFO escalates to the CEO.",choices:[
        {text:"Stand firm — regulatory capital adequacy is for management to resolve, not to fudge",next:"eg", xp:45,comm:-3000,note:"Correct. You're not here to engineer capital ratios."},
        {text:"Agree to delay reclassification by one quarter to give management time to recapitalise",next:"eb",xp:-20,comm:5000, note:"Dangerous precedent."},
      ]},
      equity:{scene:"Six months later the SBP inspection team reviews the instrument and flags it as a misclassified liability. The bank is fined. Your prior-period work is in the inspection report.",choices:[
        {text:"Accept responsibility and restate immediately",         next:"es", xp:0,  comm:-9000,note:"The professional response to an error."},
        {text:"Argue the classification was a reasonable judgment",    next:"ef", xp:-40,comm:0,    note:"This position does not survive scrutiny."},
      ]},
      hybrid:{scene:"You propose splitting the instrument. Legal and the CFO push back — there is no contractual basis for a split. The instrument has a single redemption clause.",choices:[
        {text:"Acknowledge the hybrid approach is unsupportable — reclassify fully as liability",next:"eg", xp:25,comm:-1000,note:"You corrected course. Good."},
        {text:"Document the hybrid rationale and issue the report anyway",                      next:"eb", xp:-30,comm:6000, note:"Wishful thinking is not accounting policy."},
      ]},
      eg:{ending:true,type:"gold",  title:"Substance Over Form",       body:"You correctly identified the instrument as a financial liability under IFRS 9. The bank had to recapitalise, but the balance sheet was clean. Your memo became a reference document for similar instruments at three other banks."},
      es:{ending:true,type:"silver",title:"Corrected Under Pressure",  body:"The error was caught externally rather than internally — but you accepted responsibility and restated correctly. A costly lesson in not deferring to legal on accounting substance."},
      eb:{ending:true,type:"bronze",title:"A Delay, Not a Solution",   body:"Delaying or softening the classification bought time but not a resolution. The liability surfaced eventually — and you were part of the paper trail."},
      ef:{ending:true,type:"fail",  title:"Deferred to the Wrong Team",body:"Classification is an accounting judgement, not a legal one. Deferring to legal and then defending that position under regulatory scrutiny ended this engagement badly."},
    },
  },
  m4:{
    brief:"ENGRO's tax division CFO wants a deferred tax asset of PKR 380M removed from the balance sheet before year-end — not because it doesn't exist, but because it makes the leverage ratios look worse than analysts expect. You've been brought in to review the deferred tax position.",
    nodes:{
      start:{scene:"Your analysis confirms the DTA is valid — it arises from timing differences on warranty provisions and employee benefits. Future taxable profit is probable based on three years of projections. The CFO says, 'We want it de-recognised. Find a reason.'",choices:[
        {text:"Refuse — the DTA meets IAS 12 recognition criteria, it stays on the balance sheet", next:"refuse", xp:35, comm:-5000,note:"Correct. Recognition criteria are not management's preference."},
        {text:"De-recognise citing 'uncertainty in projections' — it's technically arguable",      next:"derecog",xp:-25,comm:9000, note:"You stretch a judgement to serve a preference."},
        {text:"Propose enhanced disclosure around the DTA instead of de-recognition",             next:"disclose",xp:20, comm:1000, note:"A middle path. But is it enough?"},
      ]},
      refuse:{scene:"You maintain the DTA. The CFO escalates. The engagement partner asks whether there's 'any flexibility.' Analysts are watching the leverage ratios closely.",choices:[
        {text:"Hold the position — document the recognition basis and inform the audit committee",next:"eg", xp:50,comm:-3000,note:"Textbook professional scepticism."},
        {text:"Agree to a partial write-down as a 'prudent estimate'",                           next:"eb", xp:-20,comm:6000, note:"Partial compromise, full problem."},
      ]},
      derecog:{scene:"You de-recognise the DTA. Six months later ENGRO reports strong profits — the 'uncertain projections' were fine. An analyst notices the DTA was absent and queries it publicly. ICAP receives a complaint.",choices:[
        {text:"Respond to ICAP fully and acknowledge the judgement was management-driven",next:"es", xp:5,  comm:-10000,note:"Transparency after the fact."},
        {text:"Defend the de-recognition as conservative and within GAAP",               next:"ef", xp:-40,comm:0,     note:"Conservative and within GAAP are not the same thing."},
      ]},
      disclose:{scene:"You maintain the DTA and add a detailed disclosure explaining the key assumptions. Analysts read it and ask questions — but the balance sheet is clean. The CFO is unhappy but acknowledges the disclosure is thorough.",choices:[
        {text:"Finalise with the disclosure — it's transparent and defensible",           next:"eg", xp:40,comm:2000, note:"Good outcome through a professional path."},
        {text:"Soften the disclosure language to reduce analyst attention",               next:"eb", xp:-15,comm:4000, note:"You reduce transparency to reduce scrutiny."},
      ]},
      eg:{ending:true,type:"gold",  title:"The DTA Stands",              body:"You maintained a valid deferred tax asset against management pressure. The balance sheet reflected economic reality. The audit committee noted your independence as a benchmark for the engagement."},
      es:{ending:true,type:"silver",title:"Transparency, Eventually",    body:"The error was surfaced externally. You responded honestly to ICAP. The complaint was noted but not escalated further. A hard lesson about the cost of deference."},
      eb:{ending:true,type:"bronze",title:"Half a Compromise",           body:"Partial write-downs and softened disclosures don't solve accounting problems — they defer them. The issue surfaced in the next cycle with less room to manoeuvre."},
      ef:{ending:true,type:"fail",  title:"Conservative is Not Correct", body:"De-recognising a valid DTA and defending it as conservative judgement failed under ICAP scrutiny. The distinction between prudence and misrepresentation is one you will not forget."},
    },
  },
  m5:{
    brief:"Lucky Cement Limited is acquiring Bestway Cement's regional operations in a contested deal. Your firm is advising on the IFRS 3 accounting. The goodwill calculation, fair value of identifiable assets, and NCI treatment are all disputed between the two legal teams.",
    nodes:{
      start:{scene:"Day one. You receive the draft SPA. Purchase consideration is PKR 12.4B for 80% of Bestway Regional. The seller insists the fair value of identifiable net assets is PKR 9B. Lucky's team says it's PKR 11B. The PKR 2B difference is the goodwill dispute.",choices:[
        {text:"Commission an independent fair value expert for identifiable assets",                   next:"expert",  xp:30, comm:-2000,note:"Expensive and slow — but clean."},
        {text:"Accept Lucky's PKR 11B estimate — they are your client after all",                     next:"client",  xp:-25,comm:7000, note:"Client-favoured estimates are a red flag."},
        {text:"Propose using the seller's figures with a contingent consideration adjustment",        next:"contingent",xp:15,comm:1000, note:"Creative structure — is it IFRS 3 compliant?"},
      ]},
      expert:{scene:"The independent valuer confirms fair value of net assets at PKR 10.2B. Goodwill is PKR 2.2B (consideration PKR 12.4B + NCI at fair value PKR 1.8B − net assets PKR 10.2B × 100%). Both teams accept. But Lucky's CFO notices NCI at fair value adds PKR 400M to goodwill vs proportionate share.",choices:[
        {text:"Confirm full goodwill method — NCI at fair value is an allowable IFRS 3 election",next:"eg", xp:45,comm:2000, note:"Technically correct and well-reasoned."},
        {text:"Switch to proportionate NCI to minimise goodwill on Lucky's balance sheet",        next:"eb", xp:-10,comm:5000, note:"Switching elections for balance sheet optics is not the purpose of the choice."},
      ]},
      client:{scene:"You use Lucky's PKR 11B estimate. Goodwill is booked at PKR 1.4B. Post-acquisition, an impairment test 18 months later writes goodwill down to zero. The original fair value is questioned by auditors.",choices:[
        {text:"Disclose the estimation basis fully in the acquisition note and restate if required",next:"es", xp:10, comm:-6000,note:"Correct response to a challenged estimate."},
        {text:"Defend the original estimate — impairment tests are forward-looking, not retrospective",next:"ef",xp:-35,comm:0,    note:"True in principle, false as a defence for a biased input."},
      ]},
      contingent:{scene:"You structure PKR 1B of consideration as contingent on Bestway Regional hitting EBITDA targets. Under IFRS 3 this must be recognised at fair value on acquisition date. The probability-weighted fair value is PKR 620M.",choices:[
        {text:"Recognise contingent consideration at PKR 620M fair value on day one — per IFRS 3",next:"eg", xp:35,comm:1500, note:"Correct. Contingent consideration is not deferred."},
        {text:"Defer recognition until the EBITDA condition is probable — to keep goodwill lower", next:"eb", xp:-20,comm:5000, note:"IFRS 3 does not permit deferral of contingent consideration."},
      ]},
      eg:{ending:true,type:"gold",  title:"The Acquisition is Clean",    body:"The goodwill calculation was independently verified, NCI treatment was correctly elected, and contingent consideration was recognised on acquisition date. Your acquisition memo was retained by Lucky as the reference document for all subsequent deals."},
      es:{ending:true,type:"silver",title:"Corrected at Cost",           body:"The biased estimate was challenged at the impairment stage. Full disclosure and willingness to restate kept the situation manageable — but the first-day accounting should have been cleaner."},
      eb:{ending:true,type:"bronze",title:"Election by Convenience",     body:"Switching accounting elections for balance sheet optics and deferring contingent consideration created a trail of adjustments that undermined the acquisition note's credibility."},
      ef:{ending:true,type:"fail",  title:"The Impairment Tells the Story",body:"A goodwill write-down to zero within 18 months of acquisition is a direct challenge to the original fair value inputs. Defending biased client estimates under audit scrutiny ended this engagement."},
    },
  },
};

const GRIMOIRE_ENTRIES = {
  m1:{concept:"Going Concern & IAS 16 — Depreciation",points:["IAS 16 permits Cost Model and Revaluation Model — both valid, consistently applied","Going concern: entity continues for at least 12 months from reporting date","Emphasis of Matter required when substantial going concern doubt exists","Reducing balance front-loads depreciation vs straight-line","Professional integrity is non-negotiable — always document your reasoning"]},
  m2:{concept:"IFRS 10 — Consolidation & Control",points:["Control = Power + Exposure to variable returns + Ability to use power to affect those returns","Majority shareholding is not required — contractual rights can establish control","Substance over form: a 48% stake with unilateral decision-making rights = control","Excluded subsidiaries: only IFRS 5 held-for-sale — not industry difference or size","Intra-group balances and transactions eliminated on consolidation in full"]},
  m3:{concept:"IFRS 9 — Financial Instruments Classification",points:["Classification based on Business Model Test + SPPI (Solely Payments of Principal and Interest) Test","Amortised cost: hold to collect, SPPI cash flows only","FVOCI: hold to collect and sell, or irrevocable equity election","FVTPL: everything else, including trading and most derivatives","Substance over form: a mandatory-redemption fixed-coupon instrument is a liability, not equity regardless of its name","ECL recognised from day one of initial recognition — not on default"]},
  m4:{concept:"IAS 12 — Deferred Tax",points:["Deferred tax liability: carrying amount > tax base of an asset (asset taxed later)","Deferred tax asset: carrying amount < tax base, or deductible temporary differences","DTA recognised only when future taxable profit is probable","Measured at enacted/substantively enacted rates — not current year rate","De-recognition of a valid DTA for cosmetic reasons = misrepresentation","The distinction between prudence and misrepresentation is one of substance, not presentation"]},
  m5:{concept:"IFRS 3 — Business Combinations",points:["Acquisition method mandatory: fair value of consideration + NCI + previously held interest − FV of identifiable net assets = Goodwill","NCI election: full goodwill (FV) or proportionate share — elected per transaction","Contingent consideration recognised at fair value on acquisition date — not deferred","Bargain purchase (negative goodwill): gain recognised in P&L immediately","Transaction costs: expensed as incurred, not capitalised","Goodwill not amortised — tested for impairment annually under IAS 36"]},
};

const LEADERBOARD = [
  {name:"Ayesha K.",  guild:"audit",    xp:1840, comm:185000},
  {name:"Bilal R.",   guild:"tax",      xp:1620, comm:210000},
  {name:"Fatima N.",  guild:"advisory", xp:1450, comm:162000},
  {name:"Omar S.",    guild:"forensic", xp:1200, comm:145000},
  {name:"Sana M.",    guild:"audit",    xp:980,  comm:98000 },
];

const BOARDROOM_SEED = [
  {user:"Ayesha K.",guild:"audit",   text:"On the KTM case — the revaluation was clearly right, but did anyone feel the brief was nudging you toward the clean sign-off with that commission bump on Option C?"},
  {user:"Bilal R.", guild:"tax",     text:"100%. Option C is a classic ethical trap — reward for the wrong choice. The sim is teaching you to notice the incentive structure before you decide."},
  {user:"Fatima N.",guild:"advisory",text:"M-002 was harder. The 48% stake looks like significant influence on the surface. You really have to read the contractual rights to catch the control."},
  {user:"Omar S.",  guild:"forensic",text:"That's the point. Substance over form isn't a principle you recall — it's a reflex you build. These sims are drilling exactly that."},
];

// helpers
function guildOf(id) { return GUILDS.find(g => g.id === id) || GUILDS[0]; }
function diffCol(d)  { return {Initiate:"#7EC8A9",Journeyman:"#C8A96E",Adept:"#D4706A"}[d] || "#C8A96E"; }
function endCol(t)   { return {gold:"#C8A96E",silver:"#A0A8B4",bronze:"#CD7F32",fail:"#D4706A"}[t] || "#C8A96E"; }
function endIcon(t)  { return {gold:"⚔",silver:"◉",bronze:"◈",fail:"✕"}[t] || "◉"; }

function Pill({label, color}) {
  return <span style={{fontSize:11,color,border:"1px solid "+color+"45",padding:"2px 8px",letterSpacing:"0.08em",whiteSpace:"nowrap"}}>{label}</span>;
}

function GoldBtn({label, onClick, color, style}) {
  const bg = color || "#C8A96E";
  return <button onClick={onClick} style={{border:"none",background:bg,color:"#080810",padding:"12px 34px",fontSize:13,letterSpacing:"0.2em",fontWeight:700,cursor:"pointer",...style}}>{label}</button>;
}

function OutlineBtn({label, onClick, color, style}) {
  const c = color || "#C8A96E";
  return <button onClick={onClick} style={{border:"1px solid "+c+"55",background:"transparent",color:c,padding:"11px 28px",fontSize:13,letterSpacing:"0.15em",cursor:"pointer",...style}}>{label}</button>;
}

function Counter({target}) {
  const [v,setV] = useState(0);
  useEffect(()=>{
    if(!target) return;
    let cur=0;
    const step = Math.max(1,Math.ceil(target/45));
    const id = setInterval(()=>{ cur=Math.min(cur+step,target); setV(cur); if(cur>=target) clearInterval(id); },16);
    return ()=>clearInterval(id);
  },[target]);
  return <span>{v.toLocaleString()}</span>;
}

// ── SPLASH ────────────────────────────────────────────────────
function Splash({onContinue}) {
  return (
    <div style={{minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",background:"#080810",textAlign:"center",padding:32}}>
      <div style={{fontSize:56,marginBottom:16,display:"inline-block",animation:"spinR 18s linear infinite"}}>⚔</div>
      <div style={{fontFamily:"'Cinzel',serif",fontSize:11,letterSpacing:"0.5em",color:"#C8A96E",marginBottom:10}}>INSTITUTE OF CHARTERED ACCOUNTANTS</div>
      <h1 style={{fontFamily:"'Cinzel',serif",fontSize:clamp(36,6,64),fontWeight:700,color:"#C8A96E",marginBottom:6,lineHeight:1}}>CA ARENA</h1>
      <p style={{color:"#E2D9C838",letterSpacing:"0.25em",fontSize:12,marginBottom:48}}>WHERE JUDGMENT IS FORGED</p>
      <div style={{display:"flex",gap:20,justifyContent:"center",marginBottom:48,flexWrap:"wrap"}}>
        {GUILDS.map(g=><span key={g.id} style={{fontSize:12,color:g.col+"80",letterSpacing:"0.1em"}}>{g.sigil} {g.name}</span>)}
      </div>
      <OutlineBtn label="Enter the Arena" onClick={onContinue} />
    </div>
  );
}

function clamp(base, minVw, maxPx) { return `clamp(${minVw}vw, ${base}px, ${maxPx}px)`; }

// ── AUTH ──────────────────────────────────────────────────────
function Auth({onAuth}) {
  const [mode,setMode] = useState("login");
  const [name,setName] = useState("");
  const [email,setEmail] = useState("");
  const [pass,setPass] = useState("");
  const [err,setErr] = useState("");
  const [busy,setBusy] = useState(false);

  async function submit() {
    setErr(""); setBusy(true);
    try {
      const BASE=SB_URL, KEY=SB_KEY;
      if(mode==="register") {
        const r = await fetch(BASE+"/auth/v1/signup",{method:"POST",headers:{"Content-Type":"application/json","apikey":KEY},body:JSON.stringify({email,password:pass})});
        const d = await r.json(); if(d.error) throw new Error(d.error.message||"Signup failed");
        onAuth({token:d.access_token,userId:d.user?.id,name,email});
      } else {
        const r = await fetch(BASE+"/auth/v1/token?grant_type=password",{method:"POST",headers:{"Content-Type":"application/json","apikey":KEY},body:JSON.stringify({email,password:pass})});
        const d = await r.json(); if(d.error) throw new Error(d.error_description||"Login failed");
        onAuth({token:d.access_token,userId:d.user?.id,name:"",email});
      }
    } catch(e) { setErr(e.message); }
    setBusy(false);
  }

  const inp = {width:"100%",padding:"11px 14px",background:"#0C0C16",border:"1px solid #C8A96E22",color:"#E2D9C8",fontSize:15,outline:"none",marginBottom:14,fontFamily:"inherit"};

  return (
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"#080810",padding:24}}>
      <div style={{width:"100%",maxWidth:400}} className="fu">
        <div style={{textAlign:"center",marginBottom:32}}>
          <div style={{fontSize:28,marginBottom:6}}>⚔</div>
          <h2 style={{fontFamily:"'Cinzel',serif",fontSize:22,color:"#C8A96E",fontWeight:600}}>CA Arena</h2>
          <p style={{fontSize:11,color:"#E2D9C838",letterSpacing:"0.2em",marginTop:4}}>{mode==="login"?"RETURN TO THE FIELD":"BEGIN YOUR ASCENT"}</p>
        </div>
        <div style={{background:"#0C0C16",border:"1px solid #C8A96E15",padding:28}}>
          {mode==="register" && <input value={name} onChange={e=>setName(e.target.value)} placeholder="Full Name" style={inp}/>}
          <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email" style={inp}/>
          <input type="password" value={pass} onChange={e=>setPass(e.target.value)} placeholder="Password" style={{...inp,marginBottom:0}} onKeyDown={e=>e.key==="Enter"&&submit()}/>
          {err && <div style={{color:"#D4706A",fontSize:13,marginTop:10,padding:"8px 12px",background:"#D4706A0E",border:"1px solid #D4706A28"}}>{err}</div>}
          <button onClick={submit} disabled={busy} style={{width:"100%",marginTop:20,padding:13,background:busy?"#C8A96E50":"#C8A96E",color:"#080810",border:"none",fontSize:13,letterSpacing:"0.2em",fontWeight:700,cursor:busy?"default":"pointer",fontFamily:"inherit"}}>
            {busy?"...":mode==="login"?"Enter":"Register"}
          </button>
          <p style={{textAlign:"center",marginTop:16,fontSize:13,color:"#E2D9C840",cursor:"pointer"}} onClick={()=>{setMode(mode==="login"?"register":"login");setErr("");}}>
            {mode==="login"?"No account? Register →":"Have an account? Login →"}
          </p>
        </div>
        <p style={{textAlign:"center",marginTop:14,fontSize:12,color:"#E2D9C828",cursor:"pointer",letterSpacing:"0.08em"}}
           onClick={()=>onAuth({demo:true,name:"Operative",email:"demo@ca-arena.pk"})}>
          ↳ Continue in Demo Mode
        </p>
      </div>
    </div>
  );
}

// ── GUILD SELECT ──────────────────────────────────────────────
function GuildSelect({onSelect}) {
  const [picked,setPicked] = useState(null);
  const [confirm,setConfirm] = useState(false);

  return (
    <div style={{minHeight:"100vh",background:"#080810",padding:"48px 24px"}}>
      <div style={{maxWidth:840,margin:"0 auto"}} className="fu">
        <div style={{textAlign:"center",marginBottom:44}}>
          <div style={{fontFamily:"'Cinzel',serif",fontSize:11,color:"#C8A96E",letterSpacing:"0.4em",marginBottom:10}}>CHOOSE YOUR PATH</div>
          <h2 style={{fontFamily:"'Cinzel',serif",fontSize:36,color:"#E2D9C8",marginBottom:10}}>Pledge Your Guild</h2>
          <p style={{color:"#E2D9C848",fontSize:15,maxWidth:400,margin:"0 auto"}}>Your guild shapes bonuses, reputation, and how the Arena sees you.</p>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:16,marginBottom:34}}>
          {GUILDS.map(g=>{
            const sel = picked&&picked.id===g.id;
            return (
              <div key={g.id} onClick={()=>{setPicked(g);setConfirm(false);}}
                style={{padding:24,border:"1px solid "+(sel?g.col:"#C8A96E15"),background:sel?g.col+"0E":"#0C0C16",cursor:"pointer",transition:"all .2s",transform:sel?"scale(1.02)":"scale(1)"}}>
                <div style={{fontSize:32,color:g.col,marginBottom:10}}>{g.sigil}</div>
                <div style={{fontFamily:"'Cinzel',serif",fontSize:16,color:sel?g.col:"#E2D9C8",marginBottom:6}}>{g.name}</div>
                <p style={{fontSize:13,color:"#E2D9C852",fontStyle:"italic",marginBottom:14,lineHeight:1.5}}>{g.desc}</p>
                <Pill label={g.bonus} color={g.col}/>
                {sel&&<span style={{float:"right",fontSize:11,color:g.col,letterSpacing:"0.1em"}}>SELECTED ✓</span>}
              </div>
            );
          })}
        </div>
        {picked&&!confirm&&(
          <div style={{textAlign:"center"}} className="fu">
            <OutlineBtn label={"Pledge to "+picked.name+" →"} onClick={()=>setConfirm(true)} color={picked.col}/>
          </div>
        )}
        {confirm&&picked&&(
          <div style={{textAlign:"center",padding:24,border:"1px solid "+picked.col+"35",background:picked.col+"08",marginTop:8}} className="fu">
            <p style={{fontSize:14,color:"#E2D9C8",marginBottom:6}}>You are about to pledge to <strong style={{color:picked.col}}>{picked.name}</strong>.</p>
            <p style={{fontSize:12,color:"#E2D9C840",marginBottom:22}}>This cannot be changed for 30 days.</p>
            <div style={{display:"flex",gap:14,justifyContent:"center"}}>
              <GoldBtn label="I Pledge" onClick={()=>onSelect(picked)} color={picked.col}/>
              <OutlineBtn label="Reconsider" onClick={()=>setConfirm(false)} color="#E2D9C830"/>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── DASHBOARD ─────────────────────────────────────────────────
function MissionRow({m, i, isCompleted, isLocked, onClick}) {
  const [hov,setHov] = useState(false);
  const dc = diffCol(m.diff);
  return (
    <div onClick={onClick} onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
      style={{display:"grid",gridTemplateColumns:"52px 1fr auto",gap:14,padding:"16px 20px",border:"1px solid "+(isCompleted?"#7EC8A918":isLocked?"#C8A96E08":hov?"#C8A96E40":"#C8A96E18"),background:isCompleted?"#7EC8A905":isLocked?"#0A0A12":hov?"#0E0E18":"#0C0C16",cursor:isLocked?"default":"pointer",opacity:isLocked?.45:1,transition:"all .18s",alignItems:"center",animationDelay:(i*50)+"ms"}} className="fu">
      <div style={{textAlign:"center"}}>
        <div style={{fontSize:10,color:"#E2D9C825",marginBottom:3}}>{m.code}</div>
        <div style={{fontSize:20}}>{isCompleted?"✓":isLocked?"🔒":"◉"}</div>
      </div>
      <div>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:5,flexWrap:"wrap"}}>
          <span style={{fontFamily:"'Cinzel',serif",fontSize:15,color:isCompleted?"#7EC8A9":"#E2D9C8"}}>{m.title}</span>
          <Pill label={m.diff} color={dc}/>
          {isLocked && <Pill label="Locked" color="#E2D9C828"/>}
        </div>
        <div style={{fontSize:12,color:"#C8A96E68",marginBottom:3}}>{m.concept}</div>
        <div style={{fontSize:13,color:"#E2D9C842",fontStyle:"italic"}}>{m.client}</div>
      </div>
      <div style={{textAlign:"right",minWidth:100}}>
        <div style={{fontSize:13,color:"#C8A96E"}}>+{m.xp} XP</div>
        <div style={{fontSize:12,color:"#7EC8A9"}}>PKR {m.comm.toLocaleString()}</div>
        {isCompleted && <div style={{fontSize:11,color:"#7EC8A9",marginTop:5}}>Done ✓</div>}
        {!isLocked && !isCompleted && hov && <div style={{fontSize:11,color:"#C8A96E",marginTop:5}}>Enter →</div>}
      </div>
    </div>
  );
}

function Dashboard({profile,onMission,onGrimoire,onLeaderboard,onBoardroom,onForge,onDevUnlock}) {
  const guild = guildOf(profile.guildId);
  const done  = profile.completedMissions||[];
  const unlockedIds = getUnlocked(done, profile.commission||0);
  const [tapCount,setTapCount] = useState(0);

  function handleLogoTap() {
    const next = tapCount + 1;
    setTapCount(next);
    if(next >= 3) { setTapCount(0); onDevUnlock(); }
  }

  return (
    <div style={{minHeight:"100vh",background:"#080810"}}>
      {/* header */}
      <div style={{padding:"15px 26px",borderBottom:"1px solid #C8A96E10",display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:10}}>
        <div style={{display:"flex",alignItems:"center",gap:14,cursor:"pointer",userSelect:"none"}} onClick={handleLogoTap}>
          <span style={{fontSize:20}}>⚔</span>
          <span style={{fontFamily:"'Cinzel',serif",fontSize:17,color:"#C8A96E"}}>CA ARENA</span>
          <span style={{fontSize:10,color:"#E2D9C825",letterSpacing:"0.2em"}}>FIELD OPS</span>
          {tapCount>0&&<span style={{fontSize:10,color:"#C8A96E40"}}>{"·".repeat(tapCount)}</span>}
        </div>
        <div style={{display:"flex",alignItems:"center",gap:20,flexWrap:"wrap"}}>
          <div style={{textAlign:"right"}}>
            <div style={{fontSize:10,color:"#E2D9C830",letterSpacing:"0.12em"}}>XP</div>
            <div style={{fontSize:19,fontWeight:700,color:"#C8A96E"}}><Counter target={profile.xp||0}/></div>
          </div>
          <div style={{textAlign:"right"}}>
            <div style={{fontSize:10,color:"#E2D9C830",letterSpacing:"0.12em"}}>COMMISSION</div>
            <div style={{fontSize:17,fontWeight:700,color:"#7EC8A9"}}>PKR <Counter target={profile.commission||0}/></div>
          </div>
          <div style={{padding:"5px 11px",border:"1px solid "+guild.col+"38",background:guild.col+"10",color:guild.col,fontSize:12}}>
            {guild.sigil} {guild.name}
          </div>
          <div>
            <div style={{fontSize:13,color:"#E2D9C8"}}>{profile.name||"Operative"}</div>
            <div style={{fontSize:11,color:"#E2D9C838"}}>{profile.rank||"Initiate"}</div>
          </div>
        </div>
      </div>

      <div style={{maxWidth:960,margin:"0 auto",padding:"30px 22px"}}>
        <h2 style={{fontFamily:"'Cinzel',serif",fontSize:24,color:"#E2D9C8",marginBottom:6}}>Active Dossiers</h2>
        <p style={{color:"#E2D9C838",fontSize:14,fontStyle:"italic",marginBottom:26}}>
          Complete all five to unlock the Open World. Each client needs your judgment — not just your knowledge.
        </p>

        <div style={{display:"flex",flexDirection:"column",gap:12,marginBottom:38}}>
          {MISSIONS.map((m,i)=>{
            const isCompleted = done.includes(m.id);
            const isUnlocked  = unlockedIds.includes(m.id);
            const isLocked    = !isUnlocked && !isCompleted;
            return (
              <MissionRow key={m.id} m={m} i={i} isCompleted={isCompleted} isLocked={isLocked} onClick={()=>!isLocked&&onMission(m)}/>
            );
          })}
        </div>

        {/* unlock hint */}
        {(profile.commission||0) < 15000 && done.length===0 && (
          <div style={{padding:"12px 18px",border:"1px solid #C8A96E15",background:"#C8A96E08",fontSize:13,color:"#E2D9C850",fontStyle:"italic",marginBottom:28}}>
            💡 Complete M-001 to start earning commission. Commission unlocks further missions alongside XP.
          </div>
        )}

        <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:12,marginBottom:12}}>
          {[
            {icon:"📖",label:"Grimoire",   desc:"Your knowledge archive", col:"#A98FD4", action:onGrimoire},
            {icon:"🏆",label:"Leaderboard",desc:"Guild & XP standings",   col:"#C8A96E", action:onLeaderboard},
            {icon:"🏛",label:"Boardroom",  desc:"Collaborate on cases",   col:"#7EC8A9", action:onBoardroom},
            {icon:"⚙",label:"Scenario Forge",desc:"Build & share your own simulations", col:"#D4706A", action:onForge},
          ].map(n=>(
            <div key={n.label} onClick={n.action}
              style={{padding:20,border:"1px solid #C8A96E10",background:"#0C0C16",cursor:"pointer",transition:"all .2s"}}
              onMouseEnter={e=>{e.currentTarget.style.borderColor=n.col+"45";e.currentTarget.style.background=n.col+"0A";}}
              onMouseLeave={e=>{e.currentTarget.style.borderColor="#C8A96E10";e.currentTarget.style.background="#0C0C16";}}>
              <div style={{fontSize:24,marginBottom:8}}>{n.icon}</div>
              <div style={{fontFamily:"'Cinzel',serif",fontSize:14,color:n.col,marginBottom:4}}>{n.label}</div>
              <div style={{fontSize:12,color:"#E2D9C838"}}>{n.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function getUnlocked(done, commission) {
  const ids = ["m1"];
  if(done.includes("m1") || commission >= 10000)  ids.push("m2");
  if(done.includes("m2") || commission >= 25000)  ids.push("m3");
  if(done.includes("m3") || commission >= 45000)  ids.push("m4");
  if(done.includes("m4") || commission >= 70000)  ids.push("m5");
  return ids;
}
// ── PRELIM ────────────────────────────────────────────────────
function Prelim({mission, onPass, onFail, onBack}) {
  const qs    = PRELIMS[mission.id] || [];
  const total = qs.length;
  const need  = Math.ceil(total*0.6);
  const [idx,setIdx]     = useState(0);
  const [sel,setSel]     = useState(null);
  const [shown,setShown] = useState(false);
  const [log,setLog]     = useState([]);
  const [done,setDone]   = useState(false);
  const [score,setScore] = useState(0);

  if(!total) { onPass(); return null; }

  const q = qs[idx];

  function confirm() { if(sel===null) return; setShown(true); }

  function next() {
    const nl = [...log,{correct:sel===q.ans}];
    setLog(nl);
    if(idx+1>=total) { const sc=nl.filter(x=>x.correct).length; setScore(sc); setDone(true); }
    else { setIdx(idx+1); setSel(null); setShown(false); }
  }

  if(done) {
    const passed = score>=need;
    return (
      <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"#080810",padding:24}}>
        <div style={{textAlign:"center",maxWidth:440}} className="fu">
          <div style={{fontSize:52,marginBottom:14}}>{passed?"⚔":"✕"}</div>
          <h2 style={{fontFamily:"'Cinzel',serif",fontSize:30,color:passed?"#7EC8A9":"#D4706A",marginBottom:8}}>{passed?"Prelim Cleared":"Not Yet"}</h2>
          <p style={{fontSize:17,color:"#E2D9C858",marginBottom:6}}>{score}/{total} correct</p>
          <p style={{fontSize:14,color:"#E2D9C842",fontStyle:"italic",marginBottom:34}}>
            {passed?"The mission briefing awaits. The client is ready.":"You need "+need+" correct to proceed. Review the concepts and return."}
          </p>
          <div style={{display:"flex",gap:14,justifyContent:"center"}}>
            {passed
              ? <GoldBtn label="Begin Mission →" onClick={onPass}/>
              : <><OutlineBtn label="Retry" onClick={onFail} color="#D4706A"/><OutlineBtn label="← Hub" onClick={onBack} color="#E2D9C828"/></>
            }
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"#080810",padding:24}}>
      <div style={{width:"100%",maxWidth:580}} className="fu">
        <div style={{marginBottom:26}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:10}}>
            <span style={{fontSize:11,color:"#C8A96E",letterSpacing:"0.28em"}}>PRELIMINARY — {mission.code}</span>
            <span style={{fontSize:13,color:"#E2D9C838"}}>{idx+1}/{total}</span>
          </div>
          <div style={{height:2,background:"#C8A96E10"}}><div style={{height:"100%",background:"#C8A96E",width:((idx/total)*100)+"%",transition:"width .4s"}}/></div>
        </div>
        <p style={{fontSize:18,lineHeight:1.65,color:"#E2D9C8",marginBottom:26}}>{q.q}</p>
        <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:26}}>
          {q.opts.map((opt,oi)=>{
            const isSel=sel===oi, isAns=oi===q.ans;
            let bc="#C8A96E15",bg="#0C0C16",fc="#E2D9C8";
            if(shown){ if(isAns){bc="#7EC8A9";bg="#7EC8A90E";fc="#7EC8A9";}else if(isSel){bc="#D4706A";bg="#D4706A0E";fc="#D4706A";} }
            else if(isSel){bc="#C8A96E";bg="#C8A96E0E";fc="#C8A96E";}
            return (
              <div key={oi} onClick={()=>!shown&&setSel(oi)}
                style={{padding:"12px 17px",border:"1px solid "+bc,background:bg,color:fc,cursor:shown?"default":"pointer",transition:"all .13s",fontSize:15,display:"flex",gap:13,alignItems:"center"}}>
                <span style={{fontSize:11,fontFamily:"monospace",opacity:.38}}>{String.fromCharCode(65+oi)}.</span>
                <span style={{flex:1}}>{opt}</span>
                {shown&&isAns&&<span>✓</span>}
                {shown&&isSel&&!isAns&&<span>✕</span>}
              </div>
            );
          })}
        </div>
        <div style={{display:"flex",gap:11}}>
          {!shown
            ? <button onClick={confirm} disabled={sel===null} style={{flex:1,padding:13,background:sel!==null?"#C8A96E":"#C8A96E30",color:"#080810",border:"none",fontSize:13,letterSpacing:"0.18em",fontWeight:700,cursor:sel!==null?"pointer":"default",fontFamily:"inherit"}}>CONFIRM</button>
            : <button onClick={next} style={{flex:1,padding:13,background:"#C8A96E",color:"#080810",border:"none",fontSize:13,letterSpacing:"0.18em",fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>{idx+1>=total?"SEE RESULTS →":"NEXT →"}</button>
          }
          <button onClick={onBack} style={{padding:"13px 16px",background:"transparent",border:"1px solid #C8A96E15",color:"#E2D9C838",fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>←</button>
        </div>
      </div>
    </div>
  );
}

// ── SIMULATION ────────────────────────────────────────────────
function Simulation({mission, onComplete, onBack}) {
  const simData = SIMS[mission.id];
  const [phase,setPhase]     = useState("brief");
  const [nodeId,setNodeId]   = useState("start");
  const [history,setHistory] = useState([]);
  const [xpMod,setXpMod]     = useState(0);
  const [commMod,setCommMod] = useState(0);
  const [pending,setPending] = useState(null);
  const [endNode,setEndNode] = useState(null);

  const node = simData ? simData.nodes[nodeId] : null;
  const finalXp   = Math.max(0,(mission.xp||120)+xpMod);
  const finalComm = (mission.comm||15000)+commMod;
  const grimoire  = GRIMOIRE_ENTRIES[mission.id];

  function pick(choice) {
    if(pending) return;
    setPending(choice);
    setTimeout(()=>{
      const next = simData.nodes[choice.next];
      setHistory(h=>[...h,{text:choice.text,xp:choice.xp,comm:choice.comm}]);
      setXpMod(x=>x+choice.xp);
      setCommMod(c=>c+choice.comm);
      if(next.ending){setEndNode(next);setPhase("end");}
      else{setNodeId(choice.next);}
      setPending(null);
    },1100);
  }

  if(!simData) return (
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"#080810"}}>
      <div style={{textAlign:"center"}}>
        <p style={{color:"#E2D9C8",marginBottom:20}}>Mission simulation coming in Phase 3.</p>
        <OutlineBtn label="← Back" onClick={onBack}/>
      </div>
    </div>
  );

  if(phase==="brief") return (
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"#080810",padding:24}}>
      <div style={{maxWidth:600,width:"100%"}} className="fu">
        <div style={{fontFamily:"'Cinzel',serif",fontSize:11,color:"#C8A96E",letterSpacing:"0.28em",marginBottom:14}}>MISSION BRIEFING — {mission.code}</div>
        <h2 style={{fontFamily:"'Cinzel',serif",fontSize:28,color:"#E2D9C8",marginBottom:6}}>{mission.title}</h2>
        <p style={{fontSize:13,color:"#C8A96E65",marginBottom:26}}>Client: {mission.client}</p>
        <div style={{background:"#0C0C16",border:"1px solid #C8A96E15",padding:24,marginBottom:24}}>
          <div style={{fontSize:11,color:"#C8A96E45",letterSpacing:"0.18em",marginBottom:10}}>INCOMING BRIEFING</div>
          <p style={{fontSize:16,lineHeight:1.8,color:"#E2D9C8",fontStyle:"italic"}}>"{simData.brief}"</p>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:24}}>
          <div style={{padding:14,border:"1px solid #C8A96E12",background:"#0C0C16"}}>
            <div style={{fontSize:10,color:"#C8A96E40",letterSpacing:"0.12em",marginBottom:5}}>CONCEPT</div>
            <div style={{fontSize:13,color:"#E2D9C8"}}>{mission.concept}</div>
          </div>
          <div style={{padding:14,border:"1px solid #C8A96E12",background:"#0C0C16"}}>
            <div style={{fontSize:10,color:"#C8A96E40",letterSpacing:"0.12em",marginBottom:5}}>BASE REWARD</div>
            <div style={{fontSize:13,color:"#7EC8A9"}}>PKR {mission.comm.toLocaleString()} + {mission.xp} XP</div>
          </div>
        </div>
        <p style={{fontSize:13,color:"#E2D9C840",fontStyle:"italic",marginBottom:26,lineHeight:1.6}}>
          ⚠ Your decisions affect your final commission. Poor judgment deducts. Excellent judgment compounds. There is no single correct path — only better and worse judgment.
        </p>
        <div style={{display:"flex",gap:12}}>
          <GoldBtn label="Begin →" onClick={()=>setPhase("sim")}/>
          <OutlineBtn label="← Back" onClick={onBack} color="#E2D9C825"/>
        </div>
      </div>
    </div>
  );

  if(phase==="end"&&endNode) {
    const ec = endCol(endNode.type);
    const ei = endIcon(endNode.type);
    return (
      <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"#080810",padding:24}}>
        <div style={{maxWidth:540,width:"100%",textAlign:"center"}} className="fu">
          <div style={{fontSize:50,marginBottom:12}}>{ei}</div>
          <div style={{fontFamily:"'Cinzel',serif",fontSize:11,color:ec,letterSpacing:"0.38em",marginBottom:8}}>{endNode.type.toUpperCase()} OUTCOME</div>
          <h2 style={{fontFamily:"'Cinzel',serif",fontSize:26,color:ec,marginBottom:16}}>{endNode.title}</h2>
          <p style={{fontSize:15,lineHeight:1.8,color:"#E2D9C868",fontStyle:"italic",marginBottom:28}}>{endNode.body}</p>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:24}}>
            <div style={{padding:16,border:"1px solid "+ec+"25",background:ec+"08"}}>
              <div style={{fontSize:10,color:ec+"70",letterSpacing:"0.1em",marginBottom:5}}>XP EARNED</div>
              <div style={{fontSize:28,fontWeight:700,color:ec}}>+{finalXp}</div>
            </div>
            <div style={{padding:16,border:"1px solid "+ec+"25",background:ec+"08"}}>
              <div style={{fontSize:10,color:ec+"70",letterSpacing:"0.1em",marginBottom:5}}>COMMISSION</div>
              <div style={{fontSize:20,fontWeight:700,color:finalComm>=0?"#7EC8A9":"#D4706A"}}>
                {finalComm>=0?"+":"-"}PKR {Math.abs(finalComm).toLocaleString()}
              </div>
            </div>
          </div>
          {grimoire&&(
            <div style={{padding:18,border:"1px solid #A98FD428",background:"#A98FD406",marginBottom:24,textAlign:"left"}}>
              <div style={{fontSize:11,color:"#A98FD4",letterSpacing:"0.18em",marginBottom:10}}>📖 GRIMOIRE UNLOCKED</div>
              <div style={{fontSize:14,color:"#E2D9C8",marginBottom:8}}>{grimoire.concept}</div>
              {grimoire.points.map((pt,i)=>(
                <div key={i} style={{fontSize:13,color:"#E2D9C855",marginBottom:5,display:"flex",gap:8}}>
                  <span style={{color:"#A98FD455"}}>›</span>{pt}
                </div>
              ))}
            </div>
          )}
          <GoldBtn label="Return to Hub →" onClick={()=>onComplete({xp:finalXp,comm:finalComm,missionId:mission.id})} color={ec}/>
        </div>
      </div>
    );
  }

  // sim phase
  return (
    <div style={{minHeight:"100vh",background:"#080810",padding:"36px 22px"}}>
      <div style={{maxWidth:640,margin:"0 auto"}}>
        {history.length>0&&(
          <div style={{marginBottom:20,padding:"13px 17px",background:"#0C0C16",border:"1px solid #C8A96E0C",fontSize:12}}>
            <div style={{fontSize:10,color:"#C8A96E38",letterSpacing:"0.14em",marginBottom:7}}>DECISION TRAIL</div>
            {history.map((h,i)=>(
              <div key={i} style={{marginBottom:4,color:h.xp>=0?"#7EC8A958":"#D4706A58",fontSize:13}}>
                → {h.text.substring(0,70)}{h.text.length>70?"…":""}
              </div>
            ))}
          </div>
        )}
        <div className="fu" key={nodeId}>
          <div style={{fontSize:11,color:"#C8A96E",letterSpacing:"0.28em",marginBottom:16}}>DECISION POINT {history.length+1} — {mission.code}</div>
          <div style={{background:"#0C0C16",border:"1px solid #C8A96E15",padding:22,marginBottom:24}}>
            <p style={{fontSize:16,lineHeight:1.8,color:"#E2D9C8"}}>{node.scene}</p>
          </div>
          {pending&&(
            <div style={{padding:"13px 17px",background:"#C8A96E08",border:"1px solid #C8A96E28",marginBottom:18}} className="fu">
              <div style={{fontSize:11,color:"#C8A96E55",letterSpacing:"0.1em",marginBottom:5}}>CONSEQUENCE</div>
              <div style={{fontSize:14,color:"#E2D9C8",fontStyle:"italic"}}>{pending.note}</div>
              <div style={{display:"flex",gap:16,marginTop:8}}>
                <span style={{fontSize:12,color:pending.xp>=0?"#7EC8A9":"#D4706A"}}>XP: {pending.xp>=0?"+":""}{pending.xp}</span>
                <span style={{fontSize:12,color:pending.comm>=0?"#7EC8A9":"#D4706A"}}>Commission: {pending.comm>=0?"+":"-"}PKR {Math.abs(pending.comm).toLocaleString()}</span>
              </div>
            </div>
          )}
          {!pending&&node.choices&&(
            <div style={{display:"flex",flexDirection:"column",gap:11}}>
              <div style={{fontSize:11,color:"#E2D9C835",letterSpacing:"0.18em",marginBottom:3}}>YOUR DECISION:</div>
              {node.choices.map((c,i)=>(
                <div key={i} onClick={()=>pick(c)}
                  style={{padding:"15px 19px",border:"1px solid #C8A96E20",background:"#0C0C16",cursor:"pointer",fontSize:15,lineHeight:1.5,color:"#E2D9C8",display:"flex",gap:13,transition:"all .13s"}}
                  onMouseEnter={e=>{e.currentTarget.style.borderColor="#C8A96E50";e.currentTarget.style.background="#C8A96E08";}}
                  onMouseLeave={e=>{e.currentTarget.style.borderColor="#C8A96E20";e.currentTarget.style.background="#0C0C16";}}>
                  <span style={{color:"#C8A96E48",fontFamily:"monospace",fontSize:12,marginTop:2}}>{String.fromCharCode(65+i)}.</span>
                  {c.text}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── GRIMOIRE ──────────────────────────────────────────────────
function Grimoire({entries, onBack}) {
  const [sel,setSel] = useState(entries[0]||null);
  return (
    <div style={{minHeight:"100vh",background:"#080810",display:"flex"}}>
      <div style={{width:250,borderRight:"1px solid #C8A96E10",padding:22,overflowY:"auto",flexShrink:0}}>
        <button onClick={onBack} style={{background:"transparent",border:"none",color:"#E2D9C838",fontSize:13,marginBottom:22,cursor:"pointer",fontFamily:"inherit"}}>← Hub</button>
        <div style={{fontSize:11,color:"#A98FD4",letterSpacing:"0.28em",marginBottom:4}}>📖 GRIMOIRE</div>
        <h3 style={{fontFamily:"'Cinzel',serif",fontSize:18,color:"#E2D9C8",marginBottom:20}}>Knowledge Archive</h3>
        {entries.length===0
          ? <p style={{fontSize:13,color:"#E2D9C825",fontStyle:"italic"}}>Complete missions to unlock entries.</p>
          : entries.map((e,i)=>(
            <div key={i} onClick={()=>setSel(e)}
              style={{padding:"10px 13px",marginBottom:7,cursor:"pointer",border:"1px solid "+(sel===e?"#A98FD448":"#C8A96E10"),background:sel===e?"#A98FD40E":"#0C0C16",transition:"all .18s"}}>
              <div style={{fontSize:13,color:sel===e?"#A98FD4":"#E2D9C8",lineHeight:1.4}}>{e.concept}</div>
            </div>
          ))
        }
      </div>
      <div style={{flex:1,padding:40,overflowY:"auto"}}>
        {sel
          ? <>
              <div style={{fontSize:11,color:"#A98FD4",letterSpacing:"0.18em",marginBottom:10}}>CONCEPT</div>
              <h2 style={{fontFamily:"'Cinzel',serif",fontSize:26,color:"#E2D9C8",marginBottom:26}}>{sel.concept}</h2>
              {sel.points.map((pt,i)=>(
                <div key={i} style={{padding:"13px 17px",marginBottom:9,border:"1px solid #A98FD415",background:"#A98FD406",display:"flex",gap:13,alignItems:"flex-start"}}>
                  <span style={{color:"#A98FD4",fontSize:15,flexShrink:0}}>›</span>
                  <span style={{fontSize:15,color:"#E2D9C8",lineHeight:1.6}}>{pt}</span>
                </div>
              ))}
            </>
          : <p style={{color:"#E2D9C825",fontStyle:"italic"}}>Select an entry from the archive.</p>
        }
      </div>
    </div>
  );
}

// ── LEADERBOARD ───────────────────────────────────────────────
function Leaderboard({profile, token, onBack}) {
  const guild = guildOf(profile.guildId);
  const [tab,setTab]   = useState("xp");
  const [lbRows,setLbRows] = useState([
    ...LEADERBOARD,
    {name:profile.name||"You",guild:profile.guildId,xp:profile.xp||0,comm:profile.commission||0,isYou:true},
  ]);

  useEffect(()=>{
    if(!token||profile.demo) return;
    sb("GET","/rest/v1/profiles?select=display_name,guild_id,xp,commission&order=xp.desc&limit=20",null,token)
      .then(rows=>{
        if(!rows||rows.length===0) return;
        const live = rows.map(r=>({
          name:  r.display_name||"Operative",
          guild: r.guild_id||"audit",
          xp:    r.xp||0,
          comm:  r.commission||0,
          isYou: r.display_name===profile.name,
        }));
        const hasMe = live.find(r=>r.isYou);
        if(!hasMe) live.push({name:profile.name||"You",guild:profile.guildId,xp:profile.xp||0,comm:profile.commission||0,isYou:true});
        setLbRows(live);
      }).catch(()=>{});
  },[token]);

  const rows = lbRows;
  const sorted = tab==="xp"
    ? [...rows].sort((a,b)=>b.xp-a.xp)
    : [...rows].sort((a,b)=>b.comm-a.comm);

  return (
    <div style={{minHeight:"100vh",background:"#080810",padding:38}}>
      <div style={{maxWidth:740,margin:"0 auto"}}>
        <button onClick={onBack} style={{background:"transparent",border:"none",color:"#E2D9C838",fontSize:13,marginBottom:26,cursor:"pointer",fontFamily:"inherit"}}>← Hub</button>
        <div style={{fontFamily:"'Cinzel',serif",fontSize:11,color:"#C8A96E",letterSpacing:"0.28em",marginBottom:8}}>🏆 LEADERBOARD</div>
        <h2 style={{fontFamily:"'Cinzel',serif",fontSize:28,color:"#E2D9C8",marginBottom:20}}>Arena Rankings</h2>

        {/* tabs */}
        <div style={{display:"flex",gap:0,marginBottom:22,borderBottom:"1px solid #C8A96E15"}}>
          {["xp","commission"].map(t=>(
            <button key={t} onClick={()=>setTab(t)}
              style={{padding:"9px 22px",background:"transparent",border:"none",borderBottom:tab===t?"2px solid #C8A96E":"2px solid transparent",color:tab===t?"#C8A96E":"#E2D9C840",fontSize:12,letterSpacing:"0.15em",textTransform:"uppercase",cursor:"pointer",fontFamily:"inherit",marginBottom:-1}}>
              {t==="xp"?"XP Rank":"Commission Rank"}
            </button>
          ))}
        </div>

        {/* guild summary */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:24}}>
          {GUILDS.map(g=>{
            const members = rows.filter(r=>r.guild===g.id);
            const totalXp = members.reduce((s,m)=>s+m.xp,0);
            return (
              <div key={g.id} style={{padding:"12px 14px",border:"1px solid "+g.col+"20",background:g.col+"08"}}>
                <div style={{fontSize:18,marginBottom:4}}>{g.sigil}</div>
                <div style={{fontSize:12,color:g.col,marginBottom:4}}>{g.name}</div>
                <div style={{fontSize:11,color:"#E2D9C840"}}>{members.length} members</div>
                <div style={{fontSize:12,color:g.col+"90"}}>{totalXp.toLocaleString()} XP total</div>
              </div>
            );
          })}
        </div>

        {sorted.map((r,i)=>{
          const g = guildOf(r.guild);
          const medals = ["⚔","◉","◈"];
          return (
            <div key={i} style={{display:"grid",gridTemplateColumns:"44px 1fr auto auto",gap:14,padding:"14px 17px",marginBottom:9,border:"1px solid "+(r.isYou?"#C8A96E32":"#C8A96E10"),background:r.isYou?"#C8A96E07":"#0C0C16",alignItems:"center"}}>
              <div style={{textAlign:"center",fontSize:i<3?20:13,color:i===0?"#C8A96E":i===1?"#A0A8B4":i===2?"#CD7F32":"#E2D9C825"}}>
                {i<3?medals[i]:"#"+(i+1)}
              </div>
              <div>
                <div style={{fontSize:14,color:r.isYou?"#C8A96E":"#E2D9C8"}}>
                  {r.name}{r.isYou&&<span style={{fontSize:11,color:"#C8A96E55"}}> (you)</span>}
                </div>
                <div style={{fontSize:11,color:g.col+"80"}}>{g.sigil} {g.name}</div>
              </div>
              <div style={{textAlign:"right"}}>
                <div style={{fontSize:15,fontWeight:700,color:"#C8A96E"}}>{r.xp.toLocaleString()}</div>
                <div style={{fontSize:10,color:"#E2D9C835"}}>XP</div>
              </div>
              <div style={{textAlign:"right",minWidth:100}}>
                <div style={{fontSize:13,color:"#7EC8A9"}}>PKR {(r.comm||0).toLocaleString()}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── BOARDROOM ─────────────────────────────────────────────────
function Boardroom({profile, token, onBack}) {
  const guild = guildOf(profile.guildId);
  const [msgs,setMsgs]   = useState(BOARDROOM_SEED);
  const [input,setInput] = useState("");
  const [activeCase,setActiveCase] = useState("m1");
  const [loadingMsgs,setLoadingMsgs] = useState(false);

  useEffect(()=>{
    if(!token||profile.demo) return;
    setLoadingMsgs(true);
    loadMessages(token).then(rows=>{
      if(rows.length>0) {
        const parsed = rows.map(r=>({
          user:  r.author_name||"Operative",
          guild: r.author_guild||"audit",
          text:  r.content||"",
          time:  new Date(r.created_at).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"}),
          case:  r.case_id||"m1",
        }));
        setMsgs([...BOARDROOM_SEED,...parsed]);
      }
      setLoadingMsgs(false);
    });
  },[token]);

  const cases = MISSIONS.map(m=>({id:m.id,label:m.code+" — "+m.title}));

  function send() {
    if(!input.trim()) return;
    const msg = {user:profile.name||"You",guild:profile.guildId,text:input,time:"now",isYou:true,case:activeCase};
    setMsgs(m=>[...m,msg]);
    setInput("");
    if(token&&!profile.demo) {
      postMessage({
        author_name:  profile.name||"Operative",
        author_guild: profile.guildId,
        content:      input,
        case_id:      activeCase,
        created_at:   new Date().toISOString(),
      }, token);
    }
  }

  return (
    <div style={{height:"100vh",background:"#080810",display:"flex",flexDirection:"column"}}>
      <div style={{padding:"13px 22px",borderBottom:"1px solid #C8A96E10",display:"flex",alignItems:"center",gap:14,flexShrink:0}}>
        <button onClick={onBack} style={{background:"transparent",border:"none",color:"#E2D9C838",fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>←</button>
        <div style={{flex:1}}>
          <div style={{fontSize:11,color:"#7EC8A9",letterSpacing:"0.18em"}}>🏛 BOARDROOM</div>
          <div style={{fontFamily:"'Cinzel',serif",fontSize:16,color:"#E2D9C8"}}>Case Discussion</div>
        </div>
        <select value={activeCase} onChange={e=>setActiveCase(e.target.value)}
          style={{background:"#0C0C16",border:"1px solid #C8A96E20",color:"#E2D9C8",padding:"6px 12px",fontSize:12,fontFamily:"inherit",cursor:"pointer"}}>
          {cases.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
      </div>

      <div style={{flex:1,padding:"18px 22px",overflowY:"auto"}}>
        {msgs.map((m,i)=>{
          const g = guildOf(m.guild);
          return (
            <div key={i} style={{marginBottom:16}} className="fu">
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:5}}>
                <span style={{fontSize:13,fontWeight:700,color:m.isYou?"#C8A96E":g.col}}>{m.user}</span>
                <span style={{fontSize:11,color:g.col+"60"}}>{g.sigil} {g.name}</span>
                <span style={{fontSize:11,color:"#E2D9C820",marginLeft:"auto"}}>{m.time||""}</span>
              </div>
              <div style={{padding:"11px 15px",background:m.isYou?"#C8A96E07":"#0C0C16",border:"1px solid "+(m.isYou?"#C8A96E22":"#C8A96E0C"),fontSize:14,lineHeight:1.65,color:"#E2D9C8",maxWidth:"88%"}}>
                {m.text}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{padding:"13px 22px",borderTop:"1px solid #C8A96E10",display:"flex",gap:11,flexShrink:0}}>
        <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&send()}
          placeholder="Share your analysis of this case..."
          style={{flex:1,padding:"11px 14px",background:"#0C0C16",border:"1px solid #C8A96E18",color:"#E2D9C8",fontSize:14,outline:"none",fontFamily:"inherit"}}/>
        <button onClick={send} style={{padding:"11px 20px",background:"#C8A96E",color:"#080810",border:"none",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>Send</button>
      </div>
    </div>
  );
}


// ── PHASE 3: SCENARIO FORGE ───────────────────────────────────

const SEED_SCENARIOS = [
  {
    id:"sc_001",
    title:"The Phantom Revenue",
    author:"Ayesha K.",
    authorGuild:"audit",
    concept:"Revenue Recognition & IFRS 15",
    company:"TechSol Pvt Ltd.",
    description:"TechSol books software licence revenue upfront on 3-year contracts. The CFO argues the performance obligation is satisfied at contract signing. Analyse and decide.",
    difficulty:"Journeyman",
    xpReward:80,
    commReward:10000,
    plays:34,
    rating:4.6,
    ratingCount:12,
    tags:["IFRS 15","Revenue","SaaS"],
    nodes:{
      start:{scene:"TechSol's CFO presents a PKR 240M revenue figure for Q3. It includes PKR 180M from 3-year software licences signed in September — all recognised immediately. Your review finds no evidence of distinct performance obligations satisfied at signing.",choices:[
        {text:"Restate revenue — recognise ratably over 36 months per IFRS 15",     next:"restate", xp:35,comm:3000, note:"Correct. IFRS 15 requires recognition as performance obligations are satisfied."},
        {text:"Accept the CFO's argument — licence transfer = obligation satisfied", next:"accept",  xp:-20,comm:6000,note:"Dangerous. Licence ≠ performance obligation satisfied if ongoing service exists."},
        {text:"Propose a hybrid — 50% on signing, 50% ratable",                    next:"hybrid",  xp:10, comm:2000,note:"Is there a contractual basis for this split?"},
      ]},
      restate:{scene:"You restate. Revenue drops to PKR 110M for Q3. The CFO escalates. The board asks if IFRS 15's five-step model truly applies to software licences.",choices:[
        {text:"Walk the board through the five-step model — this is a right-of-use licence, not functional", next:"eg",xp:40,comm:2000,note:"Excellent. Board-level communication of IFRS 15 substance."},
        {text:"Agree to revisit the classification — give the CFO another week",                             next:"eb",xp:-15,comm:4000,note:"Delay without basis."},
      ]},
      accept:{scene:"Q3 reports cleanly. Six months later an analyst drills into contract terms and publishes a note questioning the revenue. Share price drops 8%. You are named in the investigation.",choices:[
        {text:"Cooperate fully — disclose the restatement",next:"es",xp:-5,comm:-8000,note:"The right move now."},
        {text:"Defend the original position",              next:"ef",xp:-40,comm:0,   note:"Indefensible under IFRS 15 scrutiny."},
      ]},
      hybrid:{scene:"The hybrid has no contractual basis. Auditors challenge it during the year-end review. You need to justify the 50/50 split.",choices:[
        {text:"Acknowledge no basis — restate fully to ratable recognition", next:"eg",xp:20,comm:1000,note:"Better late than never."},
        {text:"Document a memo asserting the split reflects delivery milestones",next:"eb",xp:-25,comm:5000,note:"Wishful documentation."},
      ]},
      eg:{ending:true,type:"gold",  title:"Revenue Recognised Correctly", body:"You applied IFRS 15's five-step model correctly, restated the revenue, and communicated the rationale to the board. The analyst community noted the transparency. Trust in the financials improved."},
      es:{ending:true,type:"silver",title:"Corrected Under Scrutiny",      body:"The restatement came after external pressure rather than internal judgment. Costly but recoverable."},
      eb:{ending:true,type:"bronze",title:"Deferred, Not Resolved",        body:"Delays and unsupported hybrid approaches deferred a problem that compounded with interest."},
      ef:{ending:true,type:"fail",  title:"The Analyst Was Right",         body:"Defending an indefensible revenue recognition policy under public scrutiny ended this engagement and damaged the firm's credibility."},
    },
    grimoire:{concept:"IFRS 15 — Revenue Recognition",points:["Five-step model: identify contract → identify obligations → determine price → allocate → recognise","Right-of-use vs functional licence: functional recognised at point in time, right-of-use ratable","Software + ongoing updates/support = single performance obligation recognised over time","'Standalone selling price' basis for allocating transaction price across obligations","CFO pressure on revenue timing is the most common ethical exposure in practice"]},
    createdAt: Date.now()-86400000*3,
  },
  {
    id:"sc_002",
    title:"The Related Party Deal",
    author:"Omar S.",
    authorGuild:"forensic",
    concept:"Related Party Disclosures & IAS 24",
    company:"Ravi Industries Ltd.",
    description:"Ravi Industries buys raw materials from a supplier 40% owned by the CEO's family trust. The transactions are at 'arm's length' per management. Verify.",
    difficulty:"Adept",
    xpReward:110,
    commReward:14000,
    plays:19,
    rating:4.2,
    ratingCount:8,
    tags:["IAS 24","Related Party","Governance"],
    nodes:{
      start:{scene:"You identify a PKR 320M purchase contract with Al-Razi Supplies — a company 40% held by a trust where the CEO is a named beneficiary. Management says prices are market rate. No IAS 24 disclosure exists in the draft accounts.",choices:[
        {text:"Require IAS 24 disclosure — related party relationship exists regardless of pricing",next:"disclose",xp:30,comm:2000, note:"Correct. Disclosure is required even if arm's length."},
        {text:"Accept management's arm's length assertion — no disclosure needed",                next:"accept", xp:-25,comm:7000,note:"IAS 24 does not exempt arm's length transactions from disclosure."},
        {text:"Obtain independent price benchmarking before deciding",                          next:"benchmark",xp:20,comm:0,   note:"Thorough. But don't let benchmarking delay the disclosure requirement."},
      ]},
      disclose:{scene:"You require disclosure. The CEO pushes back — 'This will create noise with minority shareholders.' The CFO offers to add a brief note in small print in the financial instruments section.",choices:[
        {text:"Require a prominent related party note per IAS 24 — not buried",next:"eg", xp:40,comm:1000,note:"IAS 24 requires sufficient disclosure for understanding — prominence matters."},
        {text:"Accept the buried footnote — at least it's disclosed",          next:"eb", xp:-10,comm:4000,note:"Technically disclosed but practically obscured."},
      ]},
      accept:{scene:"The accounts are filed. A minority shareholder requests details on the purchase contract. SECP receives a complaint. Your sign-off is on the accounts.",choices:[
        {text:"Restate with proper IAS 24 disclosure immediately",next:"es",xp:0, comm:-7000,note:"Correct response, late timing."},
        {text:"Argue the transactions were genuinely arm's length",next:"ef",xp:-35,comm:0,  note:"Arm's length pricing does not remove the disclosure requirement."},
      ]},
      benchmark:{scene:"Independent benchmarking confirms prices are 12% above market. The arm's length claim fails. You now have evidence of both a related party relationship and non-arm's length pricing.",choices:[
        {text:"Require full IAS 24 disclosure AND report the pricing variance to the audit committee",next:"eg",xp:50,comm:3000,note:"This is the complete professional response."},
        {text:"Require IAS 24 disclosure but don't escalate the pricing variance",                  next:"es",xp:15,comm:1000,note:"Half the picture disclosed."},
      ]},
      eg:{ending:true,type:"gold",  title:"Transparency Prevails",       body:"You required prominent IAS 24 disclosure, escalated the pricing variance to the audit committee, and documented everything. The minority shareholders and SECP noted the quality of governance."},
      es:{ending:true,type:"silver",title:"Partially Surfaced",          body:"The disclosure was made but incompletely or late. The situation was recoverable but the first-pass accounts should have been cleaner."},
      eb:{ending:true,type:"bronze",title:"Obscured but Disclosed",      body:"A buried footnote satisfies the letter of IAS 24 but not its spirit. The note was found — and the quality of disclosure questioned."},
      ef:{ending:true,type:"fail",  title:"Arm's Length is Not a Shield",body:"IAS 24 requires disclosure of related party transactions regardless of whether they are arm's length. This is not a matter of judgment — it is a matter of compliance."},
    },
    grimoire:{concept:"IAS 24 — Related Party Disclosures",points:["Related party relationship exists when one party controls or has significant influence over another","Disclosure required regardless of whether transaction is arm's length — this is NOT a mitigating factor","Key management personnel (and their families/trusts) are related parties","Disclosure must include: nature of relationship, transaction amount, outstanding balances, pricing policy","Prominence of disclosure matters — burying in notes does not meet the 'sufficient understanding' test"]},
    createdAt: Date.now()-86400000*5,
  },
];

// ── SHARE CARD ────────────────────────────────────────────────
function ShareCard({scenario, profile, outcome, style}) {
  const [copied,setCopied] = useState(false);
  const guild = guildOf(profile.guildId);

  function buildText() {
    const lines = [
      "⚔ Just completed a CA Arena scenario:",
      "",
      '"'+scenario.title+'"',
      scenario.concept,
      "",
    ];
    if(outcome) {
      lines.push("Outcome: "+outcome.endNode.title+" ("+outcome.endNode.type.toUpperCase()+")");
      lines.push("Earned: +"+outcome.finalXp+" XP · PKR "+Math.abs(outcome.finalComm).toLocaleString()+" commission");
      lines.push("Decisions made: "+outcome.history.length);
      lines.push("");
    }
    lines.push(guild.sigil+" "+guild.name+" · "+scenario.difficulty);
    lines.push("");
    lines.push("Built on CA Arena — where judgment is forged.");
    lines.push("#CAArena #CharteredAccountant #ICAP #FinancialReporting #"+scenario.concept.replace(/[^a-zA-Z]/g,""));
    return lines.join("\n");
  }

  function copy() {
    const text = buildText();
    if(navigator.clipboard) {
      navigator.clipboard.writeText(text).then(()=>{setCopied(true);setTimeout(()=>setCopied(false),2000);});
    }
  }

  function openLinkedIn() {
    const text = encodeURIComponent(buildText());
    window.open("https://www.linkedin.com/sharing/share-offsite/?mini=true&summary="+text,"_blank");
  }

  return (
    <div style={{display:"flex",gap:8,...style}}>
      <button onClick={copy}
        style={{padding:"9px 16px",background:"transparent",border:"1px solid #0A66C250",color:"#0A66C2",fontSize:12,cursor:"pointer",fontFamily:"inherit",letterSpacing:"0.08em",transition:"all .15s"}}
        onMouseEnter={e=>{e.currentTarget.style.background="#0A66C215";}}
        onMouseLeave={e=>{e.currentTarget.style.background="transparent";}}>
        {copied?"✓ Copied!":"Copy for LinkedIn"}
      </button>
      <button onClick={openLinkedIn}
        style={{padding:"9px 16px",background:"#0A66C2",border:"none",color:"#fff",fontSize:12,cursor:"pointer",fontFamily:"inherit",letterSpacing:"0.08em"}}>
        Share on LinkedIn
      </button>
    </div>
  );
}

// ── FORGE HUB ─────────────────────────────────────────────────
function ForgeHub({profile, scenarios, onBack, onBuild, onPlay}) {
  const [tab,setTab]         = useState("community");
  const [selected,setSelected] = useState(null);
  const [rated,setRated]     = useState({});
  const guild = guildOf(profile.guildId);
  const myScenarios = (profile.createdScenarios||[]);

  const allFive = (profile.completedMissions||[]).length >= 5;

  function StarRating({score, onRate, id}) {
    const [hover,setHover] = useState(0);
    const current = rated[id] || 0;
    return (
      <div style={{display:"flex",gap:3}}>
        {[1,2,3,4,5].map(s=>(
          <span key={s}
            onMouseEnter={()=>onRate&&setHover(s)}
            onMouseLeave={()=>onRate&&setHover(0)}
            onClick={()=>{if(onRate&&!current){onRate(s);setRated(r=>({...r,[id]:s}));}}}
            style={{fontSize:16,cursor:onRate&&!current?"pointer":"default",color:(hover||current||score)>=s?"#C8A96E":"#C8A96E25",transition:"color .1s"}}>
            ★
          </span>
        ))}
        {current>0&&<span style={{fontSize:11,color:"#C8A96E60",marginLeft:4}}>You rated {current}</span>}
      </div>
    );
  }

  const displayScenarios = tab==="community" ? scenarios : myScenarios;

  return (
    <div style={{minHeight:"100vh",background:"#080810"}}>
      {/* Header */}
      <div style={{padding:"15px 26px",borderBottom:"1px solid #D4706A18",display:"flex",alignItems:"center",gap:14}}>
        <button onClick={onBack} style={{background:"transparent",border:"none",color:"#E2D9C838",fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>← Hub</button>
        <div style={{flex:1}}>
          <div style={{fontFamily:"'Cinzel',serif",fontSize:11,color:"#D4706A",letterSpacing:"0.3em"}}>⚙ SCENARIO FORGE</div>
          <div style={{fontFamily:"'Cinzel',serif",fontSize:18,color:"#E2D9C8"}}>Build. Play. Share.</div>
        </div>
        {allFive
          ? <GoldBtn label="+ Build Scenario" onClick={onBuild} color="#D4706A"/>
          : <div style={{fontSize:13,color:"#E2D9C840",fontStyle:"italic",padding:"10px 18px",border:"1px solid #E2D9C815"}}>Complete all 5 missions to unlock the Forge</div>
        }
      </div>

      <div style={{maxWidth:960,margin:"0 auto",padding:"28px 22px"}}>
        {!allFive && (
          <div style={{padding:"16px 20px",border:"1px solid #D4706A28",background:"#D4706A08",marginBottom:28,display:"flex",gap:16,alignItems:"center"}}>
            <div style={{fontSize:28}}>🔒</div>
            <div>
              <div style={{fontSize:15,color:"#D4706A",marginBottom:4}}>Forge Locked</div>
              <div style={{fontSize:13,color:"#E2D9C850"}}>Complete all five Foundation Missions to unlock scenario creation. You can still play community scenarios below.</div>
              <div style={{marginTop:8,display:"flex",gap:8}}>
                {["m1","m2","m3","m4","m5"].map(id=>(
                  <div key={id} style={{width:28,height:6,background:(profile.completedMissions||[]).includes(id)?"#C8A96E":"#C8A96E20",borderRadius:2}}/>
                ))}
                <span style={{fontSize:11,color:"#E2D9C840",marginLeft:4}}>{(profile.completedMissions||[]).length}/5</span>
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div style={{display:"flex",gap:0,borderBottom:"1px solid #C8A96E12",marginBottom:24}}>
          {[["community","Community Scenarios"],["mine","My Scenarios"]].map(([t,label])=>(
            <button key={t} onClick={()=>setTab(t)}
              style={{padding:"9px 22px",background:"transparent",border:"none",borderBottom:tab===t?"2px solid #D4706A":"2px solid transparent",color:tab===t?"#D4706A":"#E2D9C840",fontSize:12,letterSpacing:"0.12em",textTransform:"uppercase",cursor:"pointer",fontFamily:"inherit",marginBottom:-1}}>
              {label} {t==="community"?`(${scenarios.length})`:`(${myScenarios.length})`}
            </button>
          ))}
        </div>

        {displayScenarios.length===0 ? (
          <div style={{textAlign:"center",padding:48,color:"#E2D9C830",fontStyle:"italic"}}>
            {tab==="mine" ? "You haven't built any scenarios yet. Hit 'Build Scenario' to create your first." : "No community scenarios yet."}
          </div>
        ) : (
          <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:16}}>
            {displayScenarios.map(sc=>{
              const g = guildOf(sc.authorGuild);
              const isSelected = selected&&selected.id===sc.id;
              return (
                <div key={sc.id}
                  style={{border:"1px solid "+(isSelected?"#D4706A45":"#C8A96E12"),background:isSelected?"#D4706A08":"#0C0C16",padding:20,cursor:"pointer",transition:"all .2s"}}
                  onClick={()=>setSelected(isSelected?null:sc)}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
                    <div>
                      <div style={{fontFamily:"'Cinzel',serif",fontSize:15,color:"#E2D9C8",marginBottom:4}}>{sc.title}</div>
                      <div style={{fontSize:11,color:"#C8A96E60",letterSpacing:"0.08em"}}>{sc.concept}</div>
                    </div>
                    <Pill label={sc.difficulty} color={diffCol(sc.difficulty)}/>
                  </div>
                  <p style={{fontSize:13,color:"#E2D9C850",lineHeight:1.5,marginBottom:12,fontStyle:"italic"}}>{sc.description}</p>
                  <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:12}}>
                    {(sc.tags||[]).map(t=><span key={t} style={{fontSize:11,color:"#7EC8A990",border:"1px solid #7EC8A920",padding:"2px 7px"}}>{t}</span>)}
                  </div>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <div>
                      <StarRating score={sc.rating} onRate={null} id={sc.id}/>
                      <div style={{fontSize:11,color:"#E2D9C830",marginTop:3}}>{sc.rating} avg · {sc.ratingCount} ratings · {sc.plays} plays</div>
                    </div>
                    <div style={{textAlign:"right"}}>
                      <div style={{fontSize:12,color:g.col+"90"}}>{g.sigil} {sc.author}</div>
                      <div style={{fontSize:11,color:"#C8A96E"}}>{sc.xpReward} XP · PKR {sc.commReward.toLocaleString()}</div>
                    </div>
                  </div>

                  {isSelected && (
                    <div style={{marginTop:16,paddingTop:16,borderTop:"1px solid #D4706A20",display:"flex",gap:10,flexWrap:"wrap"}} className="fu">
                      <GoldBtn label="▶ Play This Scenario" onClick={()=>onPlay(sc)} color="#D4706A" style={{fontSize:12,padding:"9px 20px"}}/>
                      <ShareCard scenario={sc} profile={profile}/>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── FORGE BUILDER ─────────────────────────────────────────────
function ForgeBuilder({profile, onBack, onPublish}) {
  const [step,setStep]       = useState(0); // 0=meta 1=nodes 2=preview 3=done
  const [meta,setMeta]       = useState({title:"",company:"",concept:"",description:"",difficulty:"Journeyman",tags:""});
  const [brief,setBrief]     = useState("");
  const [nodes,setNodes]     = useState([
    {id:"start",scene:"",choices:[{text:"",next:"n1",xp:20,comm:3000,note:""},{text:"",next:"n2",xp:-10,comm:5000,note:""}]},
    {id:"n1",scene:"",choices:[{text:"",next:"end_gold",xp:30,comm:2000,note:""},{text:"",next:"end_silver",xp:10,comm:4000,note:""}]},
    {id:"n2",scene:"",choices:[{text:"",next:"end_bronze",xp:-20,comm:6000,note:""},{text:"",next:"end_fail",xp:-40,comm:0,note:""}]},
  ]);
  const [endings,setEndings] = useState({
    end_gold:  {type:"gold",  title:"",body:""},
    end_silver:{type:"silver",title:"",body:""},
    end_bronze:{type:"bronze",title:"",body:""},
    end_fail:  {type:"fail",  title:"",body:""},
  });
  const [errors,setErrors]   = useState([]);

  const guild = guildOf(profile.guildId);

  function validate() {
    const errs = [];
    if(!meta.title.trim())       errs.push("Scenario title required");
    if(!meta.company.trim())     errs.push("Company name required");
    if(!meta.concept.trim())     errs.push("Concept required");
    if(!meta.description.trim()) errs.push("Description required");
    if(!brief.trim())            errs.push("Mission brief required");
    nodes.forEach((n,i)=>{
      if(!n.scene.trim()) errs.push("Scene text required for node "+(i+1));
      n.choices.forEach((c,j)=>{ if(!c.text.trim()) errs.push("Choice "+(j+1)+" text required in node "+(i+1)); });
    });
    Object.entries(endings).forEach(([k,e])=>{ if(!e.title.trim()||!e.body.trim()) errs.push("Ending '"+k+"' needs title and body"); });
    return errs;
  }

  function publish() {
    const errs = validate();
    if(errs.length) { setErrors(errs); return; }
    const allNodes = {};
    nodes.forEach(n=>{ allNodes[n.id]={scene:n.scene,choices:n.choices}; });
    Object.entries(endings).forEach(([k,e])=>{ allNodes[k]={...e,ending:true}; });
    const scenario = {
      id:"sc_"+Date.now(),
      title:meta.title, company:meta.company, concept:meta.concept,
      description:meta.description, difficulty:meta.difficulty,
      tags:meta.tags.split(",").map(t=>t.trim()).filter(Boolean),
      brief, nodes:allNodes,
      xpReward:90, commReward:12000,
      author:profile.name||"Operative", authorGuild:profile.guildId,
      plays:0, rating:0, ratingCount:0,
      grimoire:{concept:meta.concept,points:["Concept unlocked from scenario: "+meta.title]},
      createdAt:Date.now(),
    };
    setStep(3);
    setTimeout(()=>onPublish(scenario),1200);
  }

  const inp = {width:"100%",padding:"10px 13px",background:"#0A0A12",border:"1px solid #C8A96E18",color:"#E2D9C8",fontSize:14,outline:"none",fontFamily:"inherit",marginBottom:12};
  const ta  = {...inp,resize:"vertical",minHeight:80};
  const lbl = {fontSize:11,color:"#C8A96E60",letterSpacing:"0.12em",display:"block",marginBottom:5};

  if(step===3) return (
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"#080810"}}>
      <div style={{textAlign:"center"}} className="fu">
        <div style={{fontSize:52,marginBottom:16}}>⚙</div>
        <h2 style={{fontFamily:"'Cinzel',serif",fontSize:28,color:"#D4706A",marginBottom:12}}>Scenario Published</h2>
        <p style={{color:"#E2D9C858",fontSize:15}}>Your scenario is live in the community. Let the arena judge it.</p>
      </div>
    </div>
  );

  return (
    <div style={{minHeight:"100vh",background:"#080810"}}>
      <div style={{padding:"14px 24px",borderBottom:"1px solid #D4706A15",display:"flex",alignItems:"center",gap:14}}>
        <button onClick={onBack} style={{background:"transparent",border:"none",color:"#E2D9C838",fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>← Forge</button>
        <div>
          <div style={{fontFamily:"'Cinzel',serif",fontSize:11,color:"#D4706A",letterSpacing:"0.25em"}}>⚙ SCENARIO BUILDER</div>
          <div style={{fontFamily:"'Cinzel',serif",fontSize:16,color:"#E2D9C8"}}>Design Your Mission</div>
        </div>
        <div style={{marginLeft:"auto",display:"flex",gap:8}}>
          {["Setup","Nodes","Review"].map((s,i)=>(
            <div key={s} style={{fontSize:11,padding:"4px 12px",border:"1px solid "+(step===i?"#D4706A":"#C8A96E15"),color:step===i?"#D4706A":"#E2D9C830",letterSpacing:"0.1em"}}>{i+1}. {s}</div>
          ))}
        </div>
      </div>

      <div style={{maxWidth:820,margin:"0 auto",padding:"30px 22px"}}>
        {/* STEP 0: Meta */}
        {step===0 && (
          <div className="fu">
            <h3 style={{fontFamily:"'Cinzel',serif",fontSize:20,color:"#D4706A",marginBottom:22}}>Step 1: Scenario Setup</h3>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:4}}>
              <div>
                <label style={lbl}>SCENARIO TITLE *</label>
                <input value={meta.title} onChange={e=>setMeta(m=>({...m,title:e.target.value}))} placeholder="e.g. The Missing Provision" style={inp}/>
              </div>
              <div>
                <label style={lbl}>COMPANY NAME *</label>
                <input value={meta.company} onChange={e=>setMeta(m=>({...m,company:e.target.value}))} placeholder="e.g. Fauji Fertilizer Ltd." style={inp}/>
              </div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:4}}>
              <div>
                <label style={lbl}>CONCEPT / STANDARD *</label>
                <input value={meta.concept} onChange={e=>setMeta(m=>({...m,concept:e.target.value}))} placeholder="e.g. Provisions & IAS 37" style={inp}/>
              </div>
              <div>
                <label style={lbl}>DIFFICULTY</label>
                <select value={meta.difficulty} onChange={e=>setMeta(m=>({...m,difficulty:e.target.value}))}
                  style={{...inp,marginBottom:0}}>
                  <option>Initiate</option><option>Journeyman</option><option>Adept</option>
                </select>
              </div>
            </div>
            <label style={lbl}>TAGS (comma separated)</label>
            <input value={meta.tags} onChange={e=>setMeta(m=>({...m,tags:e.target.value}))} placeholder="IAS 37, Provisions, Contingent Liability" style={inp}/>
            <label style={lbl}>BRIEF DESCRIPTION * (shown on the card)</label>
            <textarea value={meta.description} onChange={e=>setMeta(m=>({...m,description:e.target.value}))} placeholder="One paragraph describing the scenario for other players." style={ta}/>
            <label style={lbl}>MISSION BRIEF * (shown to players at start — write it like a briefing)</label>
            <textarea value={brief} onChange={e=>setBrief(e.target.value)} placeholder="You walk into the boardroom. The CFO slides a file across the table..." style={{...ta,minHeight:110}}/>
            <div style={{display:"flex",justifyContent:"flex-end",marginTop:8}}>
              <GoldBtn label="Next: Build Nodes →" onClick={()=>setStep(1)} color="#D4706A"/>
            </div>
          </div>
        )}

        {/* STEP 1: Nodes */}
        {step===1 && (
          <div className="fu">
            <h3 style={{fontFamily:"'Cinzel',serif",fontSize:20,color:"#D4706A",marginBottom:8}}>Step 2: Decision Nodes</h3>
            <p style={{fontSize:13,color:"#E2D9C848",fontStyle:"italic",marginBottom:24}}>Build the branching path. Each node is a situation your player faces with 2 choices. Choices lead to the next node or to an ending.</p>

            {nodes.map((node,ni)=>(
              <div key={node.id} style={{border:"1px solid #D4706A20",background:"#0C0C14",padding:20,marginBottom:16}}>
                <div style={{fontSize:11,color:"#D4706A",letterSpacing:"0.2em",marginBottom:12}}>
                  NODE {ni+1} — {ni===0?"START NODE":node.id.toUpperCase()}
                </div>
                <label style={lbl}>SCENE (what the player reads)</label>
                <textarea value={node.scene} onChange={e=>setNodes(ns=>ns.map((n,i)=>i===ni?{...n,scene:e.target.value}:n))}
                  placeholder="Describe the situation the player is facing..." style={{...ta,minHeight:70}}/>
                {node.choices.map((ch,ci)=>(
                  <div key={ci} style={{background:"#080810",border:"1px solid #C8A96E10",padding:14,marginBottom:10}}>
                    <div style={{fontSize:10,color:"#C8A96E50",letterSpacing:"0.15em",marginBottom:8}}>CHOICE {ci+1}</div>
                    <div style={{display:"grid",gridTemplateColumns:"1fr auto",gap:8,marginBottom:8}}>
                      <div>
                        <label style={{...lbl,marginBottom:3}}>CHOICE TEXT</label>
                        <input value={ch.text} onChange={e=>setNodes(ns=>ns.map((n,i)=>i===ni?{...n,choices:n.choices.map((c,j)=>j===ci?{...c,text:e.target.value}:c)}:n))}
                          placeholder="What the player can choose to do" style={{...inp,marginBottom:4}}/>
                      </div>
                      <div style={{minWidth:110}}>
                        <label style={{...lbl,marginBottom:3}}>LEADS TO</label>
                        <select value={ch.next} onChange={e=>setNodes(ns=>ns.map((n,i)=>i===ni?{...n,choices:n.choices.map((c,j)=>j===ci?{...c,next:e.target.value}:c)}:n))}
                          style={{...inp,marginBottom:4,width:"100%"}}>
                          {nodes.filter((_,i)=>i!==ni).map(n=><option key={n.id} value={n.id}>{n.id}</option>)}
                          <option value="end_gold">end_gold</option>
                          <option value="end_silver">end_silver</option>
                          <option value="end_bronze">end_bronze</option>
                          <option value="end_fail">end_fail</option>
                        </select>
                      </div>
                    </div>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 2fr",gap:8}}>
                      <div>
                        <label style={{...lbl,marginBottom:3}}>XP MOD</label>
                        <input type="number" value={ch.xp} onChange={e=>setNodes(ns=>ns.map((n,i)=>i===ni?{...n,choices:n.choices.map((c,j)=>j===ci?{...c,xp:parseInt(e.target.value)||0}:c)}:n))}
                          style={{...inp,marginBottom:0}}/>
                      </div>
                      <div>
                        <label style={{...lbl,marginBottom:3}}>COMM MOD (PKR)</label>
                        <input type="number" value={ch.comm} onChange={e=>setNodes(ns=>ns.map((n,i)=>i===ni?{...n,choices:n.choices.map((c,j)=>j===ci?{...c,comm:parseInt(e.target.value)||0}:c)}:n))}
                          style={{...inp,marginBottom:0}}/>
                      </div>
                      <div>
                        <label style={{...lbl,marginBottom:3}}>CONSEQUENCE NOTE</label>
                        <input value={ch.note} onChange={e=>setNodes(ns=>ns.map((n,i)=>i===ni?{...n,choices:n.choices.map((c,j)=>j===ci?{...c,note:e.target.value}:c)}:n))}
                          placeholder="Shown after choice is made" style={{...inp,marginBottom:0}}/>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ))}

            <h4 style={{fontFamily:"'Cinzel',serif",fontSize:16,color:"#D4706A",marginTop:24,marginBottom:16}}>Endings</h4>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:20}}>
              {Object.entries(endings).map(([key,end])=>(
                <div key={key} style={{border:"1px solid "+endCol(end.type)+"25",background:endCol(end.type)+"06",padding:16}}>
                  <div style={{fontSize:11,color:endCol(end.type),letterSpacing:"0.15em",marginBottom:10}}>{key.toUpperCase()} ({end.type})</div>
                  <input value={end.title} onChange={e=>setEndings(en=>({...en,[key]:{...en[key],title:e.target.value}}))}
                    placeholder="Ending title" style={{...inp,marginBottom:8}}/>
                  <textarea value={end.body} onChange={e=>setEndings(en=>({...en,[key]:{...en[key],body:e.target.value}}))}
                    placeholder="What happened? What did the player's choices lead to?" style={{...ta,minHeight:60,marginBottom:0}}/>
                </div>
              ))}
            </div>

            {errors.length>0 && (
              <div style={{padding:"12px 16px",border:"1px solid #D4706A35",background:"#D4706A08",marginBottom:16}}>
                <div style={{fontSize:12,color:"#D4706A",marginBottom:6}}>Please fix before publishing:</div>
                {errors.map((e,i)=><div key={i} style={{fontSize:13,color:"#D4706A80",marginBottom:3}}>· {e}</div>)}
              </div>
            )}

            <div style={{display:"flex",gap:12,justifyContent:"space-between"}}>
              <OutlineBtn label="← Back to Setup" onClick={()=>setStep(0)} color="#E2D9C830"/>
              <div style={{display:"flex",gap:12}}>
                <OutlineBtn label="Preview →" onClick={()=>setStep(2)} color="#D4706A"/>
                <GoldBtn label="Publish to Community" onClick={publish} color="#D4706A"/>
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: Preview */}
        {step===2 && (
          <div className="fu">
            <h3 style={{fontFamily:"'Cinzel',serif",fontSize:20,color:"#D4706A",marginBottom:20}}>Step 3: Preview Card</h3>
            <div style={{border:"1px solid #D4706A35",background:"#D4706A06",padding:24,marginBottom:24}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
                <div>
                  <div style={{fontFamily:"'Cinzel',serif",fontSize:18,color:"#E2D9C8",marginBottom:4}}>{meta.title||"Untitled"}</div>
                  <div style={{fontSize:12,color:"#C8A96E60"}}>{meta.concept||"—"}</div>
                </div>
                <Pill label={meta.difficulty} color={diffCol(meta.difficulty)}/>
              </div>
              <p style={{fontSize:13,color:"#E2D9C855",fontStyle:"italic",marginBottom:12,lineHeight:1.5}}>{meta.description||"No description yet."}</p>
              <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:12}}>
                {meta.tags.split(",").filter(t=>t.trim()).map((t,i)=><span key={i} style={{fontSize:11,color:"#7EC8A980",border:"1px solid #7EC8A918",padding:"2px 7px"}}>{t.trim()}</span>)}
              </div>
              <div style={{display:"flex",justifyContent:"space-between"}}>
                <div style={{fontSize:12,color:guildOf(profile.guildId).col+"80"}}>{guildOf(profile.guildId).sigil} {profile.name||"Operative"}</div>
                <div style={{fontSize:12,color:"#C8A96E"}}>90 XP · PKR 12,000</div>
              </div>
            </div>
            <div style={{fontSize:13,color:"#E2D9C848",fontStyle:"italic",marginBottom:20}}>
              Nodes: {nodes.length} decision points · Endings: {Object.keys(endings).length}
            </div>
            <div style={{display:"flex",gap:12,justifyContent:"space-between"}}>
              <OutlineBtn label="← Edit Nodes" onClick={()=>setStep(1)} color="#E2D9C830"/>
              <GoldBtn label="Publish to Community ⚙" onClick={publish} color="#D4706A"/>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── FORGE PLAY ────────────────────────────────────────────────
function ForgePlay({scenario, profile, onComplete, onBack}) {
  const [phase,setPhase]     = useState("brief");
  const [nodeId,setNodeId]   = useState("start");
  const [history,setHistory] = useState([]);
  const [xpMod,setXpMod]     = useState(0);
  const [commMod,setCommMod] = useState(0);
  const [pending,setPending] = useState(null);
  const [endNode,setEndNode] = useState(null);
  const [userRating,setUserRating] = useState(0);

  const node = scenario.nodes[nodeId];
  const finalXp   = Math.max(0,(scenario.xpReward||80)+xpMod);
  const finalComm = (scenario.commReward||10000)+commMod;

  function pick(choice) {
    if(pending) return;
    setPending(choice);
    setTimeout(()=>{
      const next = scenario.nodes[choice.next];
      setHistory(h=>[...h,{text:choice.text,xp:choice.xp,comm:choice.comm}]);
      setXpMod(x=>x+choice.xp);
      setCommMod(c=>c+choice.comm);
      if(next&&next.ending){setEndNode(next);setPhase("end");}
      else if(next){setNodeId(choice.next);}
      setPending(null);
    },1000);
  }

  if(phase==="brief") return (
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"#080810",padding:24}}>
      <div style={{maxWidth:600,width:"100%"}} className="fu">
        <div style={{fontFamily:"'Cinzel',serif",fontSize:11,color:"#D4706A",letterSpacing:"0.28em",marginBottom:14}}>COMMUNITY SCENARIO</div>
        <h2 style={{fontFamily:"'Cinzel',serif",fontSize:28,color:"#E2D9C8",marginBottom:6}}>{scenario.title}</h2>
        <p style={{fontSize:13,color:"#D4706A70",marginBottom:6}}>Company: {scenario.company}</p>
        <p style={{fontSize:12,color:"#E2D9C840",marginBottom:24}}>Built by {guildOf(scenario.authorGuild).sigil} {scenario.author}</p>
        <div style={{background:"#0C0C16",border:"1px solid #D4706A15",padding:22,marginBottom:22}}>
          <div style={{fontSize:11,color:"#D4706A45",letterSpacing:"0.18em",marginBottom:10}}>MISSION BRIEF</div>
          <p style={{fontSize:15,lineHeight:1.8,color:"#E2D9C8",fontStyle:"italic"}}>"{scenario.brief}"</p>
        </div>
        <div style={{display:"flex",gap:12,marginBottom:20}}>
          <div style={{flex:1,padding:14,border:"1px solid #C8A96E12",background:"#0C0C16"}}>
            <div style={{fontSize:10,color:"#C8A96E40",letterSpacing:"0.1em",marginBottom:4}}>CONCEPT</div>
            <div style={{fontSize:13,color:"#E2D9C8"}}>{scenario.concept}</div>
          </div>
          <div style={{flex:1,padding:14,border:"1px solid #C8A96E12",background:"#0C0C16"}}>
            <div style={{fontSize:10,color:"#C8A96E40",letterSpacing:"0.1em",marginBottom:4}}>REWARD</div>
            <div style={{fontSize:13,color:"#7EC8A9"}}>PKR {scenario.commReward.toLocaleString()} + {scenario.xpReward} XP</div>
          </div>
        </div>
        <div style={{display:"flex",gap:12}}>
          <GoldBtn label="Begin →" onClick={()=>setPhase("sim")} color="#D4706A"/>
          <OutlineBtn label="← Back" onClick={onBack} color="#E2D9C825"/>
        </div>
      </div>
    </div>
  );

  if(phase==="end"&&endNode) {
    const ec = endCol(endNode.type);
    const ei = endIcon(endNode.type);
    const guild = guildOf(profile.guildId);
    return (
      <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"#080810",padding:24}}>
        <div style={{maxWidth:560,width:"100%",textAlign:"center"}} className="fu">
          <div style={{fontSize:48,marginBottom:12}}>{ei}</div>
          <div style={{fontFamily:"'Cinzel',serif",fontSize:11,color:ec,letterSpacing:"0.38em",marginBottom:8}}>{endNode.type.toUpperCase()} OUTCOME</div>
          <h2 style={{fontFamily:"'Cinzel',serif",fontSize:26,color:ec,marginBottom:16}}>{endNode.title}</h2>
          <p style={{fontSize:15,lineHeight:1.8,color:"#E2D9C868",fontStyle:"italic",marginBottom:26}}>{endNode.body}</p>

          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:22}}>
            <div style={{padding:16,border:"1px solid "+ec+"25",background:ec+"08"}}>
              <div style={{fontSize:10,color:ec+"70",letterSpacing:"0.1em",marginBottom:5}}>XP EARNED</div>
              <div style={{fontSize:28,fontWeight:700,color:ec}}>+{finalXp}</div>
            </div>
            <div style={{padding:16,border:"1px solid "+ec+"25",background:ec+"08"}}>
              <div style={{fontSize:10,color:ec+"70",letterSpacing:"0.1em",marginBottom:5}}>COMMISSION</div>
              <div style={{fontSize:20,fontWeight:700,color:finalComm>=0?"#7EC8A9":"#D4706A"}}>
                {finalComm>=0?"+":"-"}PKR {Math.abs(finalComm).toLocaleString()}
              </div>
            </div>
          </div>

          {/* Rate the scenario */}
          <div style={{padding:18,border:"1px solid #C8A96E20",background:"#0C0C16",marginBottom:22}}>
            <div style={{fontSize:13,color:"#E2D9C8",marginBottom:10}}>Rate this scenario</div>
            <div style={{display:"flex",justifyContent:"center",gap:6,marginBottom:4}}>
              {[1,2,3,4,5].map(s=>(
                <span key={s} onClick={()=>setUserRating(s)}
                  style={{fontSize:28,cursor:"pointer",color:userRating>=s?"#C8A96E":"#C8A96E20",transition:"color .1s"}}>★</span>
              ))}
            </div>
            {userRating>0 && <div style={{fontSize:12,color:"#C8A96E60"}}>{["","Poor","Fair","Good","Great","Excellent"][userRating]}</div>}
          </div>

          {/* LinkedIn share */}
          <ShareCard scenario={scenario} profile={profile} outcome={{endNode,finalXp,finalComm,history}} style={{marginBottom:22}}/>

          <GoldBtn label="Return to Forge →" onClick={()=>onComplete({xp:finalXp,comm:finalComm,scenarioId:scenario.id,rating:userRating})} color={ec}/>
        </div>
      </div>
    );
  }

  // sim
  return (
    <div style={{minHeight:"100vh",background:"#080810",padding:"36px 22px"}}>
      <div style={{maxWidth:640,margin:"0 auto"}}>
        {history.length>0 && (
          <div style={{marginBottom:18,padding:"12px 16px",background:"#0C0C14",border:"1px solid #D4706A0C",fontSize:12}}>
            <div style={{fontSize:10,color:"#D4706A38",letterSpacing:"0.14em",marginBottom:6}}>DECISION TRAIL</div>
            {history.map((h,i)=>(
              <div key={i} style={{marginBottom:3,color:h.xp>=0?"#7EC8A955":"#D4706A55",fontSize:13}}>
                → {h.text.substring(0,70)}{h.text.length>70?"…":""}
              </div>
            ))}
          </div>
        )}
        <div className="fu" key={nodeId}>
          <div style={{fontSize:11,color:"#D4706A",letterSpacing:"0.28em",marginBottom:16}}>
            DECISION POINT {history.length+1} — {scenario.title}
          </div>
          <div style={{background:"#0C0C16",border:"1px solid #D4706A15",padding:22,marginBottom:22}}>
            <p style={{fontSize:16,lineHeight:1.8,color:"#E2D9C8"}}>{node&&node.scene}</p>
          </div>
          {pending && (
            <div style={{padding:"12px 16px",background:"#D4706A07",border:"1px solid #D4706A25",marginBottom:16}} className="fu">
              <div style={{fontSize:11,color:"#D4706A55",letterSpacing:"0.1em",marginBottom:4}}>CONSEQUENCE</div>
              <div style={{fontSize:14,color:"#E2D9C8",fontStyle:"italic"}}>{pending.note}</div>
              <div style={{display:"flex",gap:16,marginTop:7}}>
                <span style={{fontSize:12,color:pending.xp>=0?"#7EC8A9":"#D4706A"}}>XP: {pending.xp>=0?"+":""}{pending.xp}</span>
                <span style={{fontSize:12,color:pending.comm>=0?"#7EC8A9":"#D4706A"}}>Comm: {pending.comm>=0?"+":"-"}PKR {Math.abs(pending.comm).toLocaleString()}</span>
              </div>
            </div>
          )}
          {!pending && node && node.choices && (
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              <div style={{fontSize:11,color:"#E2D9C832",letterSpacing:"0.18em",marginBottom:3}}>YOUR DECISION:</div>
              {node.choices.map((c,i)=>(
                <div key={i} onClick={()=>pick(c)}
                  style={{padding:"14px 18px",border:"1px solid #D4706A18",background:"#0C0C16",cursor:"pointer",fontSize:15,lineHeight:1.5,color:"#E2D9C8",display:"flex",gap:13,transition:"all .13s"}}
                  onMouseEnter={e=>{e.currentTarget.style.borderColor="#D4706A45";e.currentTarget.style.background="#D4706A07";}}
                  onMouseLeave={e=>{e.currentTarget.style.borderColor="#D4706A18";e.currentTarget.style.background="#0C0C16";}}>
                  <span style={{color:"#D4706A45",fontFamily:"monospace",fontSize:12,marginTop:2}}>{String.fromCharCode(65+i)}.</span>
                  {c.text}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


// ── ROOT ──────────────────────────────────────────────────────
export default function App() {
  const [screen,setScreen]             = useState("splash");
  const [profile,setProfile]           = useState(null);
  const [authToken,setAuthToken]       = useState(null);
  const [mission,setMission]           = useState(null);
  const [simPhase,setSimPhase]         = useState("prelim");
  const [forgeScenario,setForgeScenario] = useState(null);
  const [communityScenarios,setCommunityScenarios] = useState(SEED_SCENARIOS);
  const [saving,setSaving]             = useState(false);

  // ── Sync profile to Supabase whenever it changes ──
  useEffect(()=>{
    if(!profile||!authToken||profile.demo) return;
    const timer = setTimeout(()=>{
      setSaving(true);
      const row = {
        id:                  profile.userId,
        display_name:        profile.name||"Operative",
        email:               profile.email||"",
        guild_id:            profile.guildId||null,
        xp:                  profile.xp||0,
        commission:          profile.commission||0,
        rank:                profile.rank||"Initiate",
        completed_missions:  profile.completedMissions||[],
        grimoire_entries:    profile.grimoireEntries||[],
        created_scenarios:   (profile.createdScenarios||[]).map(s=>s.id),
        played_scenarios:    (profile.playedScenarios||[]).map(s=>s.scenarioId||s),
        updated_at:          new Date().toISOString(),
      };
      upsertProfile(row, authToken).finally(()=>setSaving(false));
    }, 800);
    return ()=>clearTimeout(timer);
  },[profile,authToken]);

  // ── Load community scenarios from Supabase ──
  useEffect(()=>{
    if(!authToken) return;
    loadScenarios(authToken).then(rows=>{
      if(rows.length>0) {
        const parsed = rows.map(r=>({
          ...r,
          nodes: typeof r.nodes==="string" ? JSON.parse(r.nodes) : r.nodes,
          grimoire: typeof r.grimoire==="string" ? JSON.parse(r.grimoire) : r.grimoire,
          tags: r.tags||[],
        }));
        setCommunityScenarios([...SEED_SCENARIOS, ...parsed.filter(p=>!SEED_SCENARIOS.find(s=>s.id===p.id))]);
      }
    });
  },[authToken]);

  async function handleAuth(info) {
    if(info.demo) {
      setProfile({
        demo:true, userId:"demo", name:"Operative", email:"demo@ca-arena.pk",
        guildId:null, xp:0, commission:0, rank:"Initiate",
        completedMissions:[], grimoireEntries:[], createdScenarios:[], playedScenarios:[],
      });
      setScreen("guild");
      return;
    }
    setAuthToken(info.token);
    // Try loading existing profile
    const existing = await loadProfile(info.userId, info.token);
    if(existing && existing.guild_id) {
      setProfile({
        userId:             info.userId,
        name:               existing.display_name||info.name||"Operative",
        email:              existing.email||info.email||"",
        guildId:            existing.guild_id,
        xp:                 existing.xp||0,
        commission:         existing.commission||0,
        rank:               existing.rank||"Initiate",
        completedMissions:  existing.completed_missions||[],
        grimoireEntries:    existing.grimoire_entries||[],
        createdScenarios:   [],
        playedScenarios:    [],
      });
      setScreen("dashboard");
    } else {
      setProfile({
        userId:             info.userId,
        name:               info.name||existing?.display_name||"Operative",
        email:              info.email||"",
        guildId:            existing?.guild_id||null,
        xp:                 existing?.xp||0,
        commission:         existing?.commission||0,
        rank:               existing?.rank||"Initiate",
        completedMissions:  existing?.completed_missions||[],
        grimoireEntries:    existing?.grimoire_entries||[],
        createdScenarios:   [],
        playedScenarios:    [],
      });
      setScreen("guild");
    }
  }

  function handleGuild(g) {
    setProfile(p=>({...p,guildId:g.id}));
    setScreen("dashboard");
  }

  function handleMission(m) {
    setMission(m);
    setSimPhase("prelim");
    setScreen("mission");
  }

  function handleComplete({xp,comm,missionId}) {
    setProfile(p=>{
      const newXp   = (p.xp||0)+xp;
      const newComm = (p.commission||0)+Math.max(0,comm);
      const done    = p.completedMissions.includes(missionId)?p.completedMissions:[...p.completedMissions,missionId];
      const ge      = GRIMOIRE_ENTRIES[missionId];
      const entries = ge&&!p.grimoireEntries.find(e=>e.concept===ge.concept)?[...p.grimoireEntries,ge]:p.grimoireEntries;
      const rank    = newXp>1000?"Adept":newXp>400?"Journeyman":"Initiate";
      return {...p,xp:newXp,commission:newComm,completedMissions:done,grimoireEntries:entries,rank};
    });
    setScreen("dashboard");
    setMission(null);
  }

  function handleForgePublish(scenario) {
    const full = {...scenario, author_guild:profile.guildId, author_name:profile.name||"Operative"};
    setCommunityScenarios(sc=>[full,...sc]);
    setProfile(p=>({...p,createdScenarios:[full,...(p.createdScenarios||[])]}));
    if(authToken&&!profile.demo) {
      const row = {
        id:           full.id,
        title:        full.title,
        company:      full.company,
        concept:      full.concept,
        description:  full.description,
        difficulty:   full.difficulty,
        tags:         full.tags||[],
        brief:        full.brief,
        nodes:        JSON.stringify(full.nodes),
        grimoire:     JSON.stringify(full.grimoire||{}),
        xp_reward:    full.xpReward||90,
        comm_reward:  full.commReward||12000,
        author_name:  profile.name||"Operative",
        author_guild: profile.guildId,
        plays:        0,
        rating:       0,
        rating_count: 0,
        created_at:   new Date().toISOString(),
      };
      saveScenario(row, authToken);
    }
    setScreen("forge");
  }

  function goBack() { setScreen("dashboard"); setMission(null); }

  function devUnlock() {
    setProfile(p=>({
      ...p,
      xp: Math.max(p.xp||0,1200),
      commission: Math.max(p.commission||0,80000),
      rank: "Adept",
      completedMissions: ["m1","m2","m3","m4","m5"],
      grimoireEntries: Object.values(GRIMOIRE_ENTRIES),
    }));
  }

  return (
    <>
      <style>{G}</style>
      {saving && <div style={{position:"fixed",bottom:12,right:16,fontSize:11,color:"#C8A96E50",zIndex:999,letterSpacing:"0.1em",animation:"flicker 1.5s infinite"}}>SYNCING…</div>}
      {screen==="splash"     && <Splash onContinue={()=>setScreen("auth")}/>}
      {screen==="auth"       && <Auth onAuth={handleAuth}/>}
      {screen==="guild"      && profile && <GuildSelect onSelect={handleGuild}/>}
      {screen==="dashboard"  && profile && <Dashboard profile={profile} onMission={handleMission} onGrimoire={()=>setScreen("grimoire")} onLeaderboard={()=>setScreen("leaderboard")} onBoardroom={()=>setScreen("boardroom")} onForge={()=>setScreen("forge")} onDevUnlock={devUnlock}/>}
      {screen==="mission"    && mission && simPhase==="prelim" && <Prelim mission={mission} onPass={()=>setSimPhase("sim")} onFail={()=>setSimPhase("prelim")} onBack={goBack}/>}
      {screen==="mission"    && mission && simPhase==="sim"    && <Simulation mission={mission} onComplete={handleComplete} onBack={goBack}/>}
      {screen==="grimoire"   && profile && <Grimoire entries={profile.grimoireEntries} onBack={()=>setScreen("dashboard")}/>}
      {screen==="leaderboard"&& profile && <Leaderboard profile={profile} token={authToken} onBack={()=>setScreen("dashboard")}/>}
      {screen==="boardroom"  && profile && <Boardroom profile={profile} token={authToken} onBack={()=>setScreen("dashboard")}/>}
      {screen==="forge"      && profile && <ForgeHub profile={profile} scenarios={communityScenarios} onBack={()=>setScreen("dashboard")} onBuild={()=>setScreen("forge-build")} onPlay={(s)=>{setForgeScenario(s);setScreen("forge-play");}}/>}
      {screen==="forge-build"&& profile && <ForgeBuilder profile={profile} onBack={()=>setScreen("forge")} onPublish={handleForgePublish}/>}
      {screen==="forge-play" && profile && forgeScenario && <ForgePlay scenario={forgeScenario} profile={profile} onComplete={(result)=>{setProfile(p=>({...p,playedScenarios:[...(p.playedScenarios||[]),result],xp:(p.xp||0)+result.xp,commission:(p.commission||0)+result.comm}));setScreen("forge");}} onBack={()=>setScreen("forge")}/>}
    </>
  );
}