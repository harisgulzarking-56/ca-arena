import { useState, useEffect, useRef, useCallback, createContext, useContext } from "react";
import { supabase } from "./lib/supabase";
import html2canvas from 'html2canvas';
import { generateFreshMartSession, startSession, loadSession, saveDecision, completeSession } from './lib/generateFreshMartSession';
import Grimoire, { upsertGrimoireFromCase } from './components/Grimoire';
import Boardroomv from './boardroomv.jsx';
import StoryMode from './storymode.jsx';
/* ═══════════════════════════════════════════════════════════════════
   SUPABASE CONFIG  ← paste your real values here
   Supabase Dashboard → Settings → API
═══════════════════════════════════════════════════════════════════ */

/* Inline Supabase REST client (no npm needed in this environment) */
/* ─── User Context (flows through entire app) ─────────────────── */
export const UserCtx = createContext(null);
function useUser(){ return useContext(UserCtx); }

const XP_REWARD = { SEED:50, GROWTH:100, APEX:200, DECISION:10 };
// Removed level logic for now - will rebuild later
function xpToRank(xp){ return xp>=2000?"APEX":xp>=800?"GROWTH":"SEED"; }
function xpToLevel(xp){ return Math.max(1, Math.floor((Number(xp)||0)/200)+1); } // Simplified for display
function xpToRankMeta(xp){
  const safeXp = Number(xp)||0;
  const tier = xpToRank(safeXp);
  const level = xpToLevel(safeXp);
  return { tier, level, label:`${tier}` };
}
const DIFF_UNLOCK_LEVEL = { SEED:1, GROWTH:4, APEX:8 };
function canAccessDifficulty(xp, diff){
  return true; // Remove level restrictions for now
}



/* ═══════════════════════════════════════════════════════════════════
   DESIGN TOKENS
═══════════════════════════════════════════════════════════════════ */
const T = {
  bg:"#0A0A0A",
  surf:"#121212",
  surf2:"#1A1A1A",
  border:"#2A2A2A",

  txt:"#F5F5F5",
  dim:"#9CA3AF",

  gold:"#D4AF37",
  goldSoft:"#D4AF3722",

  blue:"#3B82F6",
  green:"#10B981",
  red:"#F43F5E",
  muted:  "#3A3A3A",
  goldM:  "#D4AF3788",
  purple: "#8B5CF6",
  sans:   "'IBM Plex Sans', sans-serif",
  serif:  "'Playfair Display', serif",
  mono:   "'IBM Plex Mono', monospace",
};
const DC = { SEED:"#3DEB8A", GROWTH:"#F4C430", APEX:"#FF5252" };

const css = `
@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;700&family=IBM+Plex+Sans:wght@400;600;700&family=Playfair+Display:wght@700;900&display=swap');
*{box-sizing:border-box;margin:0;padding:0;}
@keyframes spriteIn{from{opacity:0;transform:translateX(-50%) translateY(10px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}
@keyframes dialogueIn{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:translateY(0)}}
@keyframes screenShake{0%,100%{transform:translateX(0)}20%{transform:translateX(-5px)}40%{transform:translateX(5px)}60%{transform:translateX(-3px)}80%{transform:translateX(3px)}}
@keyframes xpPop{0%{opacity:0;transform:translateY(0) scale(.8)}40%{opacity:1;transform:translateY(-20px) scale(1.15)}100%{opacity:0;transform:translateY(-44px) scale(.9)}}
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
/* ═══════════════════════════════════════════════════════════════════
   DYNAMIC STATE-BASED FRESHMART SIMULATION
═══════════════════════════════════════════════════════════════════ */

const RENT = 400000;
const MONTHLY_BURN = 900000; // Approximate monthly cash burn

// Scenario-driven FreshMart Simulation
const FM_INITIAL_STATE = {
  // Financial metrics
  cash_on_hand: 1000000,  // Monthly sales amount
  monthly_sales: 1000000,
  monthly_expenses: 900000,  // 90% cost of sales
  monthly_burn: 900000,
  debt_stress: 0.7,  // High due to low margins
  
  // Fixed costs
  rent_expense: 400000,
  salary_expense: 450000,  // 15 employees × 30,000
  electricity_expense: 50000,
  
  // Business performance
  customer_footfall: 100,  // 100/day
  profit_margin: 0.1,  // 10% margin
  dead_stock_units: 400,  // 400+ slow moving SKUs
  dead_stock_share: 0.8,  // High dead stock ratio
  inventory_turnover: 0.3,
  
  // Stakeholder metrics
  customer_satisfaction: 0.6,
  employee_morale: 0.5,
  supplier_relations: 0.5,
  
  // Growth metrics
  month_target_3: 2000000,  // 2M sales by month 3
  month_target_6: 4000000,  // 4M sales by month 6
  capital_invested: 30000000,  // 30M invested
  
  // Compound growth multipliers
  growth_base: 1000000,  // Base monthly sales from initial state
  footfall_multiplier: 1.0,  // Customer traffic multiplier
  conversion_multiplier: 1.0,  // Sales conversion multiplier  
  momentum_multiplier: 1.0,  // Growth momentum multiplier
  
  // Decision impact tracking
  month1_decision_impact: 0,  // Growth contribution from Month 1 decisions
  month2_decision_impact: 0,  // Growth contribution from Month 2 decisions
  month3_decision_impact: 0,  // Growth contribution from Month 3 decisions
  
  // Game state
  current_month: 0,
  decisions_made: 0,
  path_taken: [],
  checkpoint_passed: false,
  scaling_phase: false,
  distress_phase: false
};

// Comprehensive FreshMart Business Scenario Graph
const FRESHMART_SCENARIOS = {
  // MONTH 1 - INITIAL LIQUIDITY TRAP
  start: {
    id: "start",
    description: "You walk into FreshMart as a CA intern. The store is in crisis: 400+ SKUs of dead inventory blocking cash, 100 daily customers, 1M monthly sales with only 10% margin due to competitor pressure. Fixed costs: 400K rent + 450K salaries + 50K electricity = 900K monthly burn. The owner needs 2M sales by Month 3 and 4M by Month 6 to recover his 30M investment. What's your first move?",
    options: [
      {
        id: "layoff_employees",
        label: "Layoff Employees - Reduce variable costs immediately",
        xp: 15,
        effect: {
          salary_expense: "-200000",
          employee_morale: "-0.3",
          customer_satisfaction: "-0.1"
        },
        next: "layoff_decision"
      },
      {
        id: "take_loan",
        label: "Take Business Loan - Inject cash for operations",
        xp: 20,
        effect: {
          cash_on_hand: "+1000000",
          debt_stress: "+0.3"
        },
        next: "loan_decision"
      },
      {
        id: "increase_prices",
        label: "Increase Prices - Improve margins immediately",
        xp: 25,
        percentageInput: { type: "price_increase", label: "Price Increase %", min: 1, max: 50, default: 15 },
        effect: {
          profit_margin: "+0.15",
          customer_footfall: "-20",
          customer_satisfaction: "-0.2"
        },
        next: "pricing_decision"
      },
      {
        id: "supplier_credit",
        label: "Negotiate Supplier Credit - Reduce cash pressure",
        xp: 35,
        effect: {
          cash_on_hand: "+300000",
          supplier_relations: "-0.1"
        },
        next: "credit_decision"
      }
    ]
  },

  // LAYOFF PATH - MONTH 1 DECISIONS
  layoff_decision: {
    id: "layoff_decision",
    description: "Laying off staff will immediately reduce costs but impacts service quality. How aggressive should you be?",
    options: [
      {
        id: "aggressive_layoff",
        label: "Aggressive Layoff (40-50% of staff) - Maximum cost reduction",
        xp: 10,
        effect: {
          salary_expense: "-250000",
          employee_morale: "-0.4",
          customer_satisfaction: "-0.3",
          customer_footfall: "-15"
        },
        next: "month2_low_service"
      },
      {
        id: "smart_layoff",
        label: "Smart Layoff (20% + role redesign) - Balanced approach",
        xp: 30,
        effect: {
          salary_expense: "-150000",
          employee_morale: "-0.2",
          inventory_turnover: "+0.2"
        },
        next: "month2_optimized_ops"
      }
    ]
  },

  // LOAN PATH - MONTH 1 DECISIONS
  loan_decision: {
    id: "loan_decision",
    description: "You have 1M in loan funds. How will you allocate this capital for maximum impact?",
    options: [
      {
        id: "loan_inventory_clearance",
        label: "Use for Inventory Clearance - Deep discount sale to free cash",
        xp: 35,
        percentageInput: { type: "discount", label: "Discount %", min: 5, max: 70, default: 30 },
        effect: {
          dead_stock_units: "-200",
          cash_on_hand: "+400000",
          profit_margin: "-0.05"
        },
        next: "month2_cleared_inventory"
      },
      {
        id: "loan_expansion",
        label: "Use for Expansion - Marketing and store layout improvements",
        xp: 20,
        effect: {
          customer_footfall: "+30",
          cash_on_hand: "-200000",
          customer_satisfaction: "+0.1"
        },
        next: "month2_growth_bet"
      },
      {
        id: "loan_poor_allocation",
        label: "Poor Allocation - Spread too thin across initiatives",
        xp: 10,
        effect: {
          cash_on_hand: "-100000",
          debt_stress: "+0.2"
        },
        next: "month2_debt_trap"
      }
    ]
  },

  // PRICING PATH - MONTH 1 DECISIONS
  pricing_decision: {
    id: "pricing_decision",
    description: "Price increases can boost margins but may drive customers away. What's your strategy?",
    options: [
      {
        id: "blind_increase",
        label: "Blind Price Increase - Apply across all products",
        xp: 10,
        percentageInput: { type: "price_increase", label: "Price Increase %", min: 5, max: 50, default: 20 },
        effect: {
          profit_margin: "+0.2",
          customer_footfall: "-40",
          customer_satisfaction: "-0.4"
        },
        next: "month2_demand_collapse"
      },
      {
        id: "selective_increase",
        label: "Selective Increase - Only on essential items",
        xp: 30,
        percentageInput: { type: "price_increase", label: "Price Increase %", min: 1, max: 30, default: 10 },
        effect: {
          profit_margin: "+0.1",
          customer_footfall: "-10",
          customer_satisfaction: "-0.1"
        },
        next: "month2_balanced_pricing"
      },
      {
        id: "bundle_strategy",
        label: "Bundle Strategy - Package slow items with popular ones",
        xp: 35,
        percentageInput: { type: "discount", label: "Bundle Discount %", min: 5, max: 40, default: 15 },
        effect: {
          dead_stock_units: "-100",
          profit_margin: "+0.08",
          customer_footfall: "+5"
        },
        next: "month2_inventory_unlock"
      }
    ]
  },

  // SUPPLIER CREDIT PATH - MONTH 1 DECISIONS
  credit_decision: {
    id: "credit_decision",
    description: "Supplier negotiations can provide breathing room or create dependency. What's the outcome?",
    options: [
      {
        id: "successful_negotiation",
        label: "Successful Negotiation - Secured favorable credit terms",
        xp: 35,
        effect: {
          cash_on_hand: "+500000",
          supplier_relations: "+0.2",
          inventory_turnover: "+0.1"
        },
        next: "month2_stable_supply"
      },
      {
        id: "rejected_credit",
        label: "Credit Rejected - Suppliers unwilling to extend terms",
        xp: 15,
        effect: {
          supplier_relations: "-0.2",
          debt_stress: "+0.1"
        },
        next: "month2_stagnation"
      },
      {
        id: "overuse_credit",
        label: "Overuse Credit - Took maximum available, creating dependency",
        xp: 20,
        effect: {
          cash_on_hand: "+800000",
          supplier_relations: "-0.3",
          debt_stress: "+0.2"
        },
        next: "month2_dependency"
      }
    ]
  },

  // MONTH 2 PATHS - COMBO PHASE PREPARATION
  month2_low_service: {
    id: "month2_low_service",
    description: "Month 2: Aggressive layoffs reduced costs but service quality suffered. Customer complaints are up, and some shelves are poorly stocked. You need to address the service gap while maintaining cost control.",
    options: [
      {
        id: "service_recovery",
        label: "Service Recovery - Retrain remaining staff, improve processes",
        xp: 30,
        effect: {
          employee_morale: "+0.2",
          customer_satisfaction: "+0.3",
          salary_expense: "+50000"
        },
        next: "month3_decisions"
      },
      {
        id: "automation",
        label: "Invest in Automation - Self-checkout, inventory systems",
        xp: 25,
        effect: {
          inventory_turnover: "+0.3",
          cash_on_hand: "-200000",
          employee_morale: "-0.1"
        },
        next: "month3_decisions"
      }
    ]
  },

  month2_optimized_ops: {
    id: "month2_optimized_ops", 
    description: "Month 2: Smart layoffs and role redesign improved efficiency. Staff morale is decent, and operations are smoother. Now you can focus on growth initiatives.",
    options: [
      {
        id: "customer_experience",
        label: "Enhance Customer Experience - Loyalty program, better service",
        xp: 35,
        effect: {
          customer_satisfaction: "+0.3",
          customer_footfall: "+15",
          cash_on_hand: "-100000"
        },
        next: "month3_decisions"
      },
      {
        id: "inventory_optimization",
        label: "Advanced Inventory Management - JIT ordering, demand forecasting",
        xp: 30,
        effect: {
          dead_stock_units: "-150",
          inventory_turnover: "+0.4",
          supplier_relations: "+0.2"
        },
        next: "month3_decisions"
      }
    ]
  },

  // LOAN PATH - MONTH 2 SCENARIOS
  month2_cleared_inventory: {
    id: "month2_cleared_inventory",
    description: "Month 2: Deep discount sale cleared 200 dead stock units and generated PKR 400K cash. However, profit margins took a hit. You need to rebuild margins while maintaining cash flow.",
    options: [
      {
        id: "margin_recovery",
        label: "Margin Recovery - Strategic price increases on key items",
        xp: 30,
        percentageInput: { type: "price_increase", label: "Price Increase %", min: 2, max: 25, default: 12 },
        effect: {
          profit_margin: "+0.12",
          customer_footfall: "-10",
          customer_satisfaction: "-0.1"
        },
        next: "month3_decisions"
      },
      {
        id: "volume_focus",
        label: "Volume Focus - Push for higher sales volume at current margins",
        xp: 25,
        effect: {
          monthly_sales: "+300000",
          cash_on_hand: "-150000",
          customer_satisfaction: "+0.1"
        },
        next: "month3_decisions"
      }
    ]
  },

  month2_growth_bet: {
    id: "month2_growth_bet",
    description: "Month 2: Marketing and layout improvements increased footfall by 30 people. Initial investment of PKR 200K is showing promise, but you need to convert this traffic into sustainable sales.",
    options: [
      {
        id: "conversion_optimization",
        label: "Conversion Optimization - Better merchandising and upselling",
        xp: 35,
        effect: {
          monthly_sales: "+400000",
          profit_margin: "+0.05",
          customer_satisfaction: "+0.2"
        },
        next: "month3_decisions"
      },
      {
        id: "marketing_scale",
        label: "Scale Marketing - Double down on successful campaigns",
        xp: 25,
        effect: {
          customer_footfall: "+25",
          cash_on_hand: "-300000",
          monthly_sales: "+200000"
        },
        next: "month3_decisions"
      }
    ]
  },

  month2_debt_trap: {
    id: "month2_debt_trap",
    description: "Month 2: Poor loan allocation wasted PKR 100K and increased debt stress. The business is now in a weaker position with higher financial obligations. You need to fix this quickly.",
    options: [
      {
        id: "emergency_cost_cut",
        label: "Emergency Cost Cutting - Reduce expenses immediately",
        xp: 15,
        effect: {
          monthly_expenses: "-150000",
          employee_morale: "-0.3",
          customer_satisfaction: "-0.2"
        },
        next: "month3_decisions"
      },
      {
        id: "debt_restructuring",
        label: "Debt Restructuring - Negotiate better loan terms",
        xp: 30,
        effect: {
          debt_stress: "-0.2",
          supplier_relations: "-0.1",
          cash_on_hand: "+100000"
        },
        next: "month3_decisions"
      }
    ]
  },

  // PRICING PATH - MONTH 2 SCENARIOS
  month2_demand_collapse: {
    id: "month2_demand_collapse",
    description: "Month 2: Blind price increases caused demand to collapse - 40 fewer customers per day. Margins improved but volume dropped significantly. You need to recover customer traffic.",
    options: [
      {
        id: "price_correction",
        label: "Price Correction - Roll back some increases to recover traffic",
        xp: 30,
        percentageInput: { type: "discount", label: "Price Reduction %", min: 2, max: 30, default: 8 },
        effect: {
          customer_footfall: "+25",
          profit_margin: "-0.08",
          customer_satisfaction: "+0.3"
        },
        next: "month3_decisions"
      },
      {
        id: "value_addition",
        label: "Value Addition - Add services to justify higher prices",
        xp: 25,
        effect: {
          customer_satisfaction: "+0.2",
          monthly_expenses: "+100000",
          customer_footfall: "+10"
        },
        next: "month3_decisions"
      }
    ]
  },

  month2_balanced_pricing: {
    id: "month2_balanced_pricing",
    description: "Month 2: Selective price increases worked well - modest margin improvement with minimal customer impact. The business is stable but needs growth acceleration.",
    options: [
      {
        id: "strategic_expansion",
        label: "Strategic Expansion - Add high-margin product lines",
        xp: 30,
        effect: {
          profit_margin: "+0.08",
          monthly_sales: "+200000",
          cash_on_hand: "-150000"
        },
        next: "month3_decisions"
      },
      {
        id: "customer_retention",
        label: "Customer Retention - Loyalty programs to increase repeat business",
        xp: 35,
        effect: {
          customer_satisfaction: "+0.25",
          monthly_sales: "+150000",
          cash_on_hand: "-80000"
        },
        next: "month3_decisions"
      }
    ]
  },

  month2_inventory_unlock: {
    id: "month2_inventory_unlock",
    description: "Month 2: Bundle strategy successfully cleared 100 dead stock units while maintaining customer traffic. Inventory is healthier and cash flow improved.",
    options: [
      {
        id: "bundle_scaling",
        label: "Scale Bundling - Expand successful bundle strategies",
        xp: 30,
        effect: {
          dead_stock_units: "-100",
          monthly_sales: "+200000",
          profit_margin: "+0.03"
        },
        next: "month3_decisions"
      },
      {
        id: "inventory_system",
        label: "Inventory System - Invest in better inventory management",
        xp: 25,
        effect: {
          inventory_turnover: "+0.3",
          cash_on_hand: "-200000",
          dead_stock_units: "-50"
        },
        next: "month3_decisions"
      }
    ]
  },

  // SUPPLIER CREDIT PATH - MONTH 2 SCENARIOS
  month2_stable_supply: {
    id: "month2_stable_supply",
    description: "Month 2: Successful supplier negotiations secured PKR 500K credit and improved terms. Supply chain is stable with better cash flow. Time to leverage this advantage.",
    options: [
      {
        id: "inventory_expansion",
        label: "Inventory Expansion - Use credit to add popular products",
        xp: 35,
        effect: {
          monthly_sales: "+300000",
          supplier_relations: "+0.1",
          inventory_turnover: "+0.2"
        },
        next: "month3_decisions"
      },
      {
        id: "cash_reserve",
        label: "Build Cash Reserve - Hold credit as emergency buffer",
        xp: 30,
        effect: {
          cash_on_hand: "+200000",
          debt_stress: "-0.1",
          supplier_relations: "+0.1"
        },
        next: "month3_decisions"
      }
    ]
  },

  month2_stagnation: {
    id: "month2_stagnation",
    description: "Month 2: Credit rejection left the business in a difficult position. Suppliers are wary and cash pressure continues. You need alternative solutions.",
    options: [
      {
        id: "cost_optimization",
        label: "Cost Optimization - Find efficiency gains without supplier help",
        xp: 25,
        effect: {
          monthly_expenses: "-100000",
          employee_morale: "-0.1",
          inventory_turnover: "+0.1"
        },
        next: "month3_decisions"
      },
      {
        id: "alternative_funding",
        label: "Alternative Funding - Explore other financing options",
        xp: 20,
        effect: {
          cash_on_hand: "+300000",
          debt_stress: "+0.15",
          supplier_relations: "-0.1"
        },
        next: "month3_decisions"
      }
    ]
  },

  month2_dependency: {
    id: "month2_dependency",
    description: "Month 2: Overusing supplier credit created dependency and strained relationships. You have PKR 800K extra cash but suppliers are concerned about payment reliability.",
    options: [
      {
        id: "relationship_repair",
        label: "Repair Supplier Relationships - Make partial payments to build trust",
        xp: 30,
        effect: {
          supplier_relations: "+0.3",
          cash_on_hand: "-400000",
          debt_stress: "-0.1"
        },
        next: "month3_decisions"
      },
      {
        id: "diversification",
        label: "Supplier Diversification - Find alternative suppliers to reduce dependency",
        xp: 35,
        effect: {
          supplier_relations: "+0.2",
          inventory_turnover: "+0.15",
          cash_on_hand: "-150000"
        },
        next: "month3_decisions"
      }
    ]
  },

  // MONTH 3 DECISIONS - Final push before checkpoint
  month3_decisions: {
    id: "month3_decisions",
    description: "Month 3: The checkpoint evaluation is approaching. Your early decisions have set the foundation, but this month could make or break the 2M target. What's your final strategic move before the system evaluation?",
    options: [
      {
        id: "aggressive_expansion",
        label: "Aggressive Expansion - Open new sections, add product lines",
        xp: 25,
        effect: {
          monthly_sales: "+400000",
          cash_on_hand: "-600000",
          customer_footfall: "+30",
          inventory_turnover: "-0.1"
        },
        next: "benchmark1_evaluation"
      },
      {
        id: "operational_optimization",
        label: "Operational Optimization - Streamline processes, reduce waste",
        xp: 35,
        effect: {
          monthly_sales: "+200000",
          monthly_expenses: "-150000",
          employee_morale: "+0.2",
          inventory_turnover: "+0.2"
        },
        next: "benchmark1_evaluation"
      },
      {
        id: "customer_focus",
        label: "Customer Retention Focus - Loyalty programs, service improvements",
        xp: 30,
        effect: {
          monthly_sales: "+250000",
          customer_satisfaction: "+0.3",
          customer_footfall: "+20",
          cash_on_hand: "-200000"
        },
        next: "benchmark1_evaluation"
      },
      {
        id: "conservative_approach",
        label: "Conservative Stabilization - Focus on current operations, minimize risk",
        xp: 20,
        effect: {
          monthly_sales: "+100000",
          cash_on_hand: "+100000",
          debt_stress: "-0.1",
          employee_morale: "+0.1"
        },
        next: "benchmark1_evaluation"
      }
    ]
  },

  benchmark1_evaluation: {
    id: "benchmark1_evaluation",
    description: "BENCHMARK 1 EVALUATION: Start of Month 4 - Time to evaluate your 3-month performance toward the 2M sales target. Your decisions have shaped the business trajectory. Based on current performance, you'll either advance to scaling phase or enter distress mode.",
    isEnding: false,
    checkpoint: true,
    options: [] // Will be dynamically determined based on performance
  },

  // SCALE PHASE (Months 4-6) - For successful businesses
  scaling_phase: {
    id: "scaling_phase",
    description: "Months 4-6: You've achieved the 2M sales target! Now the race to 4M begins. The business is stable but needs aggressive growth strategies. What's your scaling approach?",
    options: [
      {
        id: "online_channels",
        label: "Launch Online Channels - Delivery, e-commerce platform",
        xp: 60,
        effect: {
          customer_footfall: "+50",
          monthly_sales: "+500000",
          cash_on_hand: "-300000"
        },
        next: "month5_scaling"
      },
      {
        id: "private_label",
        label: "Develop Private Label Products - Higher margins, brand control",
        xp: 50,
        percentageInput: { type: "price_increase", label: "Private Label Margin Uplift %", min: 5, max: 40, default: 15 },
        effect: {
          profit_margin: "+0.15",
          monthly_sales: "+300000",
          cash_on_hand: "-400000"
        },
        next: "month5_scaling"
      },
      {
        id: "customer_retention",
        label: "Customer Retention Strategy - Loyalty programs, subscription services",
        xp: 55,
        effect: {
          customer_satisfaction: "+0.3",
          monthly_sales: "+400000",
          cash_on_hand: "-200000"
        },
        next: "month5_scaling"
      },
      {
        id: "bulk_deals",
        label: "Bulk Purchase Deals - Negotiate volume discounts with suppliers",
        xp: 40,
        effect: {
          monthly_expenses: "-100000",
          supplier_relations: "+0.2",
          inventory_turnover: "+0.2"
        },
        next: "month5_scaling"
      }
    ]
  },

  // DISTRESS PHASE (Months 4-6) - For struggling businesses  
  distress_phase: {
    id: "distress_phase",
    description: "Months 4-6: You missed the 2M target. Cash is tight, pressure is mounting. Emergency measures are required to survive. This is make-or-break time.",
    options: [
      {
        id: "heavy_discount",
        label: "Heavy Discount Clearance - Liquidate everything to generate cash",
        xp: 20,
        percentageInput: { type: "discount", label: "Clearance Discount %", min: 20, max: 80, default: 40 },
        effect: {
          dead_stock_units: "-300",
          cash_on_hand: "+200000",
          profit_margin: "-0.15"
        },
        next: "month5_survival"
      },
      {
        id: "desperate_renegotiation",
        label: "Desperate Supplier Renegotiation - Emergency terms to stay afloat",
        xp: 15,
        effect: {
          supplier_relations: "-0.4",
          cash_on_hand: "+150000",
          debt_stress: "+0.2"
        },
        next: "month5_survival"
      },
      {
        id: "shutdown_decision",
        label: "Consider Shutdown - Acknowledge failure and exit",
        xp: 5,
        effect: {},
        next: "ending_failure"
      }
    ]
  },

  // MONTH 5 SURVIVAL - Emergency measures for struggling businesses
  month5_survival: {
    id: "month5_survival",
    description: "Month 5: Emergency measures are in place but the business is still fragile. You need to stabilize operations while finding a path to survival. Every decision counts as cash reserves dwindle. Can you turn this around?",
    options: [
      {
        id: "emergency_funding",
        label: "Emergency Funding - Seek last-resort financing at high cost",
        xp: 15,
        effect: {
          cash_on_hand: "+1000000",
          debt_stress: "+0.3",
          monthly_expenses: "+50000"
        },
        next: "month6_final"
      },
      {
        id: "radical_downsize",
        label: "Radical Downsize - Cut to essentials, focus on core products only",
        xp: 20,
        effect: {
          monthly_expenses: "-300000",
          dead_stock_units: "-200",
          monthly_sales: "-200000",
          employee_morale: "-0.3"
        },
        next: "month6_final"
      },
      {
        id: "last_ditch_marketing",
        label: "Last-Ditch Marketing - Desperate promotion to boost sales quickly",
        xp: 25,
        effect: {
          monthly_sales: "+500000",
          cash_on_hand: "-300000",
          customer_footfall: "+40"
        },
        next: "month6_final"
      },
      {
        id: "accept_failure",
        label: "Accept Failure - Prepare for orderly shutdown",
        xp: 5,
        effect: {},
        next: "ending_failure"
      }
    ]
  },

  // MONTH 5 SCALING - Building momentum toward 4M target
  month5_scaling: {
    id: "month5_scaling",
    description: "Month 5: Your scaling strategy is showing results! The business is growing but the 4M monthly target is ambitious. You need to accelerate growth while maintaining operational stability. What's your push to the finish line?",
    options: [
      {
        id: "aggressive_marketing",
        label: "Aggressive Marketing Campaign - Digital ads, local promotions",
        xp: 35,
        effect: {
          customer_footfall: "+80",
          monthly_sales: "+800000",
          cash_on_hand: "-500000",
          monthly_expenses: "+100000"
        },
        next: "month6_final"
      },
      {
        id: "product_expansion",
        label: "Premium Product Expansion - High-margin specialty items",
        xp: 40,
        effect: {
          profit_margin: "+0.2",
          monthly_sales: "+600000",
          dead_stock_units: "-50",
          cash_on_hand: "-400000"
        },
        next: "month6_final"
      },
      {
        id: "operational_efficiency",
        label: "Operational Efficiency - Streamline processes, reduce waste",
        xp: 30,
        effect: {
          monthly_expenses: "-200000",
          inventory_turnover: "+0.3",
          monthly_sales: "+400000",
          employee_morale: "+0.2"
        },
        next: "month6_final"
      },
      {
        id: "strategic_partnership",
        label: "Strategic Partnership - Collaborate with complementary businesses",
        xp: 45,
        effect: {
          monthly_expenses: "-150000",
          supplier_relations: "+0.3",
          monthly_sales: "+500000",
          profit_margin: "+0.1"
        },
        next: "month6_final"
      }
    ]
  },

  // MONTH 6 FINAL - Final evaluation
  month6_final: {
    id: "month6_final",
    description: "Month 6: This is it - the final evaluation. Your decisions over the past 5 months have led to this moment. The business will either achieve the 4M monthly sales target and secure its future, or fall short. Time to see the results of your turnaround strategy.",
    options: [
      {
        id: "final_push",
        label: "Final Evaluation - Review performance and determine outcome",
        xp: 25,
        effect: {},
        next: "ending_evaluation"
      }
    ]
  },

  // ENDING EVALUATION - Dynamic outcome based on performance
  ending_evaluation: {
    id: "ending_evaluation",
    description: "Final Business Evaluation: Your 6-month turnaround journey is complete. The evaluation will determine FreshMart's future based on your strategic decisions and operational results.",
    options: [
      {
        id: "review_results",
        label: "View Final Results",
        effect: {},
        next: null // This will trigger the evaluateFinalOutcome function
      }
    ]
  },

  // FINAL ENDINGS
  ending_success: {
    id: "ending_success",
    type: "success",
    description: "SUCCESS: FreshMart is thriving! You achieved 4M+ monthly sales with healthy cash flow and optimized operations. The owner's 30M investment is recovered, and the business is positioned for sustainable growth. Your strategic decisions transformed a crisis into a success story.",
    isEnding: true
  },

  ending_survival: {
    id: "ending_survival", 
    type: "survival",
    description: "SURVIVAL: FreshMart is alive but fragile. You stabilized the business but growth is limited. Sales are improving but cash flow remains tight. The business survives but the owner's full recovery isn't guaranteed. More work needed to reach true success.",
    isEnding: true
  },

  ending_failure: {
    id: "ending_failure",
    type: "failure", 
    description: "FAILURE: FreshMart couldn't overcome the liquidity crisis. Despite your efforts, the business collapsed under cash flow pressure. The owner lost his 30M investment, and the store closed. Sometimes even the best decisions can't save a business from certain doom.",
    isEnding: true
  }
};

const FM_STATE_META = {
  cash_on_hand: { label: "Cash on Hand", good: "high", unit: "PKR" },
  monthly_sales: { label: "Monthly Sales", good: "high", unit: "PKR" },
  monthly_expenses: { label: "Monthly Expenses", good: "low", unit: "PKR" },
  monthly_burn: { label: "Monthly Burn", good: "low", unit: "PKR" },
  debt_stress: { label: "Debt Stress", good: "low", unit: "%" },
  rent_expense: { label: "Rent Expense", good: "low", unit: "PKR" },
  salary_expense: { label: "Salary Expense", good: "low", unit: "PKR" },
  electricity_expense: { label: "Electricity", good: "low", unit: "PKR" },
  customer_footfall: { label: "Daily Footfall", good: "high", unit: "people" },
  profit_margin: { label: "Profit Margin", good: "high", unit: "%" },
  dead_stock_units: { label: "Dead Stock Units", good: "low", unit: "SKUs" },
  inventory_turnover: { label: "Inventory Turnover", good: "high", unit: "turns" },
  customer_satisfaction: { label: "Customer Satisfaction", good: "high", unit: "%" },
  employee_morale: { label: "Employee Morale", good: "high", unit: "%" },
  supplier_relations: { label: "Supplier Relations", good: "high", unit: "%" }
};

// Dynamic scoring system for FreshMart business simulation
const calculateRecoveryScore = (state) => {
  const weights = {
    cash_stability: 0.25,
    profitability: 0.20,
    inventory_health: 0.15,
    customer_satisfaction: 0.15,
    operational_efficiency: 0.15,
    risk_management: 0.10
  };
  
  const scores = {
    cash_stability: Math.min(1, state.cash_on_hand / 3000000) * (1 - state.debt_stress * 0.5),
    profitability: Math.min(1, state.profit_margin / 0.3) * Math.max(0, state.monthly_sales / state.month_target_3),
    inventory_health: Math.max(0, 1 - state.dead_stock_units / 400) * state.inventory_turnover,
    customer_satisfaction: state.customer_satisfaction * Math.min(1, state.customer_footfall / 150),
    operational_efficiency: (state.employee_morale * 0.5 + state.supplier_relations * 0.5),
    risk_management: (1 - state.debt_stress) * Math.max(0, state.cash_on_hand / (state.monthly_burn * 3))
  };
  
  return Object.entries(weights).reduce((total, [key, weight]) => {
    return total + (scores[key] || 0) * weight;
  }, 0) * 100;
};

// Determine ending based on state
const determineEnding = (state, month) => {
  const recoveryScore = calculateRecoveryScore(state);
  
  if (state.cash_on_hand <= 0) {
    return {
      type: "bad",
      title: "Business Closure",
      text: "FreshMart ran out of cash and ceased operations.",
      score: recoveryScore
    };
  }
  
  if (state.debt_stress > 0.8 && state.monthly_burn > state.cash_on_hand * 0.1) {
    return {
      type: "bad", 
      title: "Debt Spiral",
      text: "Unsustainable debt burden led to collapse.",
      score: recoveryScore
    };
  }
  
  // Only allow recovery endings after at least 2 months (minimum time for meaningful intervention)
  if (month >= 2) {
    if (recoveryScore >= 75 && state.cash_on_hand > 1500000) {
      return {
        type: "perfect",
        title: "Optimal Recovery", 
        text: "FreshMart recovered strongly with sustainable operations.",
        score: recoveryScore
      };
    }
    
    if (recoveryScore >= 50 && state.cash_on_hand > 800000) {
      return {
        type: "good",
        title: "Business Stabilized",
        text: "FreshMart stabilized but continues to face challenges.",
        score: recoveryScore
      };
    } else {
      return {
        type: "struggle",
        title: "Ongoing Struggle",
        text: "FreshMart survives but remains in fragile condition.",
        score: recoveryScore
      };
    }
  }
  
  return null; // Continue simulation
};

// Legacy compatibility
const FM_INITIAL = FM_INITIAL_STATE;
const FM_STAT_META = FM_STATE_META;
const FM_STAT_KEYS = Object.keys(FM_STATE_META);

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
  if(key==="cash_on_hand") return v>=3000000?"good":v>=1500000?"warn":"bad";
  if(key==="monthly_sales") return v>=3000000?"good":v>=2000000?"warn":"bad";
  if(key==="monthly_expenses") return v<=800000?"good":v<=1000000?"warn":"bad";
  if(key==="customer_footfall") return v>=150?"good":v>=100?"warn":"bad";
  if(key==="employee_morale") return v>=0.7?"good":v>=0.5?"warn":"bad";
  if(key==="debt_stress") return v<=0.3?"good":v<=0.6?"warn":"bad";
  if(key==="profit_margin") return v>=0.2?"good":v>=0.1?"warn":"bad";
  if(key==="dead_stock_units") return v<=100?"good":v<=200?"warn":"bad";
  if(key==="customer_satisfaction") return v>=0.8?"good":v>=0.6?"warn":"bad";
  if(key==="supplier_relations") return v>=0.7?"good":v>=0.5?"warn":"bad";
  return "good";
}


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
  const rankMeta = user ? xpToRankMeta(user.xp) : null;
  const items=[
    "▸ CASES LIVE: 2,847",
    "▸ ACTIVE BOARDS: 34",
    user ? `▸ YOUR XP: ${user.xp.toLocaleString()}` : "▸ JOIN TO EARN XP",
    user ? `▸ RANK: ${rankMeta.label}` : "▸ SIGN UP FREE",
    "▸ NEW CASE: Engro APEX",
    "▸ BOARDROOM LIVE: Lucky Cement",
  ];
  return <div style={{background:T.gold,padding:"5px 0",overflow:"hidden",borderBottom:"2px solid #000",flexShrink:0}}><div style={{display:"flex",gap:60,animation:"ticker 22s linear infinite",whiteSpace:"nowrap",paddingLeft:"100%",fontFamily:T.mono,fontSize:10,fontWeight:700,color:"#111",letterSpacing:1}}>{[...items,...items].map((t,i)=><span key={i}>{t}</span>)}</div></div>;
}

function LeaderboardPanel({leaderboard,currentUserId,loading}){
  if(loading && (!leaderboard||!leaderboard.length)){
    return(
      <div style={{background:T.surf,border:`2px solid ${T.border}`,padding:"20px 18px"}}>
        <div style={{fontFamily:T.mono,fontSize:8,color:T.dim,letterSpacing:3,marginBottom:14}}>GLOBAL RANK</div>
        <div style={{fontFamily:T.mono,fontSize:10,color:T.dim,textAlign:"center",padding:"20px 0"}}>Loading…</div>
      </div>
    );
  }
  if(!leaderboard||!leaderboard.length){
    return(
      <div style={{background:T.surf,border:`2px solid ${T.border}`,padding:"20px 18px"}}>
        <div style={{fontFamily:T.mono,fontSize:8,color:T.dim,letterSpacing:3,marginBottom:14}}>GLOBAL RANK</div>
        <div style={{fontFamily:T.mono,fontSize:10,color:T.dim,textAlign:"center",padding:"20px 0"}}>No leaderboard data yet</div>
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
        const rankMeta = xpToRankMeta(p.xp);
        return(
          <div key={p.id} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderBottom:i<leaderboard.length-1?`1px solid ${T.muted}`:"none",background:isMe?`${T.gold}06`:"transparent"}}>
            <span style={{fontFamily:T.mono,fontSize:11,color:i<3?T.gold:T.muted,fontWeight:800,width:18,textAlign:"right",flexShrink:0}}>{i+1}</span>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontFamily:T.sans,fontSize:12,color:isMe?T.gold:"#ccc",fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.username}{isMe?" ◀":""}</div>
              <div style={{fontFamily:T.mono,fontSize:7,color:T.dim,letterSpacing:1}}>
                #{i+1} · {p.cases_completed} cases · <span style={{color:DC[rankMeta.tier]||T.dim}}>{rankMeta.label}</span>
              </div>
            </div>
            <div style={{textAlign:"right",flexShrink:0}}>
              <div style={{fontFamily:T.mono,fontSize:10,color:"#777",fontWeight:700}}>{p.xp.toLocaleString()}</div>
              <div style={{fontFamily:T.mono,fontSize:8,color:T.green}}>+{p.xp_gained_today||0}</div>
              <div style={{fontFamily:T.mono,fontSize:8,color:T.gold}}>{p.commission||0} commission</div>
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
  const rankMeta = xpToRankMeta(user.xp);
  const currRank = rankMeta.tier;
  const nextRankXp = currRank==="SEED"?5000:currRank==="GROWTH"?10000:99999;
  const prevRankXp = currRank==="SEED"?0:currRank==="GROWTH"?5000:10000;
  const pct = Math.min(100,Math.round(((user.xp-prevRankXp)/(nextRankXp-prevRankXp))*100));
  const nextRank = currRank==="SEED"?"GROWTH":currRank==="GROWTH"?"APEX":"MAX";
  return(
    <div style={{background:T.surf,border:`2px solid ${T.border}`,padding:"14px 20px",display:"flex",alignItems:"center",gap:20}}>
      <div style={{flex:1}}>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
          <span style={{fontFamily:T.mono,fontSize:8,color:T.dim,letterSpacing:2}}>{currRank} → {nextRank}</span>
          <span style={{fontFamily:T.mono,fontSize:8,color:T.gold}}>{user.xp.toLocaleString()} / {nextRankXp.toLocaleString()} XP</span>
        </div>
        <div style={{height:4,background:T.muted}}>
          <div style={{height:"100%",width:`${pct}%`,background:`linear-gradient(90deg,${T.gold},${T.goldM})`,transition:"width .8s"}}/>
        </div>
        <div style={{fontFamily:T.mono,fontSize:8,color:T.dim,marginTop:3,letterSpacing:1}}>{(nextRankXp-user.xp).toLocaleString()} XP to {nextRank}</div>
      </div>
      <div style={{textAlign:"right"}}>
        <div style={{fontFamily:T.serif,fontSize:18,color:T.gold,fontWeight:700,lineHeight:1}}>{currRank}</div>
        <div style={{fontFamily:T.mono,fontSize:7,color:T.dim,letterSpacing:1}}>LV {rankMeta.level}</div>
      </div>
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

/**
 * ═══════════════════════════════════════════════════════════════════
 *  FRESHMART SIM — COMPLETE IMMERSIVE VERSION
 *  Drop-in replacement for FreshMartSim in App.jsx
 *
 *  HOW TO INTEGRATE:
 *  1. Delete the old FreshMartSim function and all its helpers
 *     from App.jsx (lines ~1402–2450).
 *  2. Paste this entire file's contents in their place.
 *  3. Add to the `css` const at line 60 in App.jsx:
 *       @keyframes spriteIn{from{opacity:0;transform:translateX(-50%) translateY(10px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}
 *       @keyframes dialogueIn{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:translateY(0)}}
 *       @keyframes screenShake{0%,100%{transform:translateX(0)}20%{transform:translateX(-5px)}40%{transform:translateX(5px)}60%{transform:translateX(-3px)}80%{transform:translateX(3px)}}
 *       @keyframes xpPop{0%{opacity:0;transform:translateY(0) scale(.8)}40%{opacity:1;transform:translateY(-20px) scale(1.15)}100%{opacity:0;transform:translateY(-44px) scale(.9)}}
 *
 *  IMAGE FILES — place in /public/freshmart/:
 *    Image 1 → imran_neutral.png
 *    Image 2 → imran_concerned.png
 *    Image 3 → imran_confident.png
 *    Image 5 → imran_thinking.png
 *    Image 6 → imran_angry.png
 *    Image 7 → imran_confronting.png
 *    Image 9 → imran_desperate.png
 *    Image 8 → store_empty.jpg   (background)
 *    Image 4 → back_office.jpg   (supplier/meeting background)
 * ═══════════════════════════════════════════════════════════════════
 */

// ─── Asset maps ────────────────────────────────────────────────────
const FM_SPRITES = {
  neutral:     "/freshmart/imran_neutral.png",
  concerned:   "/freshmart/imran_concerned.png",
  confident:   "/freshmart/imran_confident.png",
  thinking:    "/freshmart/imran_thinking.png",
  angry:       "/freshmart/imran_angry.png",
  confronting: "/freshmart/imran_confronting.png",
  desperate:   "/freshmart/imran_desperate.png",
};

const FM_BACKGROUNDS = {
  store:       "/freshmart/store_empty.jpg",
  back_office: "/freshmart/back_office.jpg",
};

// ─── Dynamic dialogue generation ────────────────────────────────────────
function generateDynamicDialogue(scenarioId, session, state) {
  const fmt = (n) => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
    return String(Math.round(n));
  };
  const pct = (n) => `${Math.round(n * 100)}%`;

  if (scenarioId === "start") {
    return [
      { speaker:"narrator", bg:"store",
        text:"Lahore, 9 AM. You step into the store for your first day as a CA intern. The fluorescent light flickers. Something is wrong." },
      { speaker:"owner", expression:"desperate", bg:"store",
        text:"Acha hua aa gaye. I've been here since Fajr. Sit down — you need to see these numbers." },
      { speaker:"owner", expression:"thinking",
        text:`My head cashier — eight years with me — he's gone. And PKR ${fmt(state.cash_embezzled)} went with him.` },
      { speaker:"owner", expression:"concerned",
        text:`I have ${state.dead_stock_units} SKUs sitting on shelves that haven't moved in three months. Dead stock. Cash locked, going nowhere.` },
      { speaker:"owner", expression:"desperate",
        text:`Rent is PKR ${fmt(state.rent_expense)}. Salaries PKR ${fmt(state.salary_expense)}. Electricity PKR ${fmt(state.electricity_expense)}. Every month — whether we sell or not.` },
      { speaker:"narrator",
        text:`Monthly sales: PKR ${fmt(state.monthly_sales)}. Monthly burn: PKR ${fmt(state.monthly_burn)}. Margin: ${pct(state.profit_margin)}. The math barely works — and that was before the crisis.` },
      { speaker:"owner", expression:"concerned",
        text:`I invested PKR ${fmt(state.capital_invested)}. My retirement. My children's future. I need PKR ${fmt(state.month_target_3)} by Month 3 and PKR ${fmt(state.month_target_6)} by Month 6. Tell me — what do we do first?` },
    ];
  }

  if (scenarioId === "month2_optimized_ops") {
    return [
      { speaker:"narrator", text:"Month 2. The early decisions are showing results. The numbers are moving in the right direction." },
      { speaker:"owner", expression:"neutral",
        text:"I've been watching daily. We're not there yet — but it feels different. More organised." },
      { speaker:"owner", expression:"thinking",
        text:`We need to accelerate. Month 3 target is PKR ${fmt(state.month_target_3)}. One month to close the gap.` },
    ];
  }

  if (scenarioId === "scaling_phase") {
    return [
      { speaker:"owner", expression:"confident",
        text:`We hit it. PKR ${fmt(state.month_target_3)}. I honestly wasn't sure we would.` },
      { speaker:"owner", expression:"neutral",
        text:"The business is viable. Now — how do we grow it? Month 6 target is PKR ${fmt(state.month_target_6)}. We're halfway." },
      { speaker:"narrator", text:"Month 4. The business has stabilised. The strategic phase begins." },
    ];
  }

  if (scenarioId === "ending_success") {
    return [
      { speaker:"narrator", bg:"store", text:"Month 6. The final count is in." },
      { speaker:"owner", expression:"confident", bg:"store",
        text:`We did it. PKR ${fmt(state.month_target_6)}. My accountant confirmed this morning. The investment is recoverable.` },
      { speaker:"owner", expression:"neutral", bg:"store",
        text:"You taught me to read my own business. I was running on instinct for years. You brought the numbers into it." },
      { speaker:"narrator", bg:"store",
        text:`Final sales: PKR ${fmt(state.monthly_sales)}. Recovery score: ${Math.round(state.monthly_sales / state.month_target_6 * 100)}%. The business is saved.` },
    ];
  }

  if (scenarioId === "loan_decision") {
    const loanAmount = 1_000_000; // Default loan amount, could be made dynamic from session
    return [
      { speaker:"narrator", bg:"back_office", text:"You call the bank. The relationship manager arrives within the hour." },
      { speaker:"owner", expression:"thinking", bg:"back_office",
        text:`PKR ${fmt(loanAmount)} injected. Breathing room. But now we owe the bank on top of everything else.` },
      { speaker:"owner", expression:"concerned", bg:"back_office",
        text:"Interest starts immediately. We need to deploy this carefully — where does it go?" },
    ];
  }

  if (scenarioId === "credit_decision") {
    const creditAmount = 300_000; // Default credit amount, could be made dynamic from session
    return [
      { speaker:"narrator", bg:"back_office", text:"You arrange a meeting with the main supplier. Chai is poured. The negotiation begins." },
      { speaker:"owner", expression:"neutral", bg:"back_office",
        text:"We've been loyal customers for eleven years. I'm asking for 60 days. Just 60 days to stabilise." },
      { speaker:"narrator", bg:"back_office",
        text:`The supplier agrees — reluctantly. PKR ${fmt(creditAmount)} in cash pressure relieved.` },
      { speaker:"owner", expression:"confident",
        text:"Good. Now let's use this window properly. What's the next move?" },
    ];
  }

  // Default fallback for other scenarios (keep existing hardcoded for now)
  return FM_DIALOGUE_STATIC[scenarioId] || [];
}

// Static dialogue for non-start scenarios (can be made dynamic later)
const FM_DIALOGUE_STATIC = {
  layoff_decision: [
    { speaker:"narrator", text:"You recommend cutting the salary bill. The owner stares at the staff roster." },
    { speaker:"owner", expression:"thinking",
      text:"Some of these boys have been with me five, six years. But you're right — we can't afford to be sentimental right now." },
    { speaker:"owner", expression:"concerned",
      text:"How deep do we cut? Enough to survive, or enough to actually fix the numbers?" },
  ],
  loan_decision: [
    { speaker:"narrator", bg:"back_office", text:"You call the bank. The relationship manager arrives within the hour." },
    { speaker:"owner", expression:"thinking", bg:"back_office",
      text:"PKR 1 million injected. Breathing room. But now we owe the bank on top of everything else." },
    { speaker:"owner", expression:"concerned", bg:"back_office",
      text:"Interest starts immediately. We need to deploy this carefully — where does it go?" },
  ],
  pricing_decision: [
    { speaker:"narrator", text:"You pull up the competitor price list. The gap is real but narrow." },
    { speaker:"owner", expression:"thinking",
      text:"If we raise prices and customers go across the road to D-Mart, we lose both margin and volume." },
    { speaker:"owner", expression:"concerned",
      text:"Which items do we touch? Everything, or only where they have no alternative?" },
  ],
  credit_decision: [
    { speaker:"narrator", bg:"back_office", text:"You arrange a meeting with the main supplier. Chai is poured. The negotiation begins." },
    { speaker:"owner", expression:"neutral", bg:"back_office",
      text:"We've been loyal customers for eleven years. I'm asking for 60 days. Just 60 days to stabilise." },
    { speaker:"narrator", bg:"back_office",
      text:"The supplier agrees — reluctantly. PKR 300,000 in cash pressure relieved." },
    { speaker:"owner", expression:"confident",
      text:"Good. Now let's use this window properly. What's the next move?" },
  ],
  month2_optimized_ops: [
    { speaker:"narrator", text:"Month 2. The early decisions are showing results. The numbers are moving in the right direction." },
    { speaker:"owner", expression:"neutral",
      text:"I've been watching daily. We're not there yet — but it feels different. More organised." },
    { speaker:"owner", expression:"thinking",
      text:"We need to accelerate. Month 3 target is PKR 2M. One month to close the gap." },
  ],
  month2_high_footfall: [
    { speaker:"narrator", text:"Month 2. More people are coming through the door. Converting them is the next challenge." },
    { speaker:"owner", expression:"neutral",
      text:"Footfall is up. But the cashier says average basket size hasn't moved. People are browsing, not buying." },
    { speaker:"owner", expression:"thinking",
      text:"How do we turn visitors into actual sales?" },
  ],
  month2_low_service: [
    { speaker:"narrator", text:"Month 2. The layoffs hit harder than expected. Two regulars complained about slow service this week." },
    { speaker:"owner", expression:"angry",
      text:"Yaar, this isn't working. A customer said she's going to Carrefour next time. Because our queue is too long." },
    { speaker:"owner", expression:"concerned",
      text:"We cut too deep. What do we do now to stop losing people?" },
  ],
  month2_stable_ops: [
    { speaker:"narrator", text:"Month 2. Operations are stable. Not exceptional — but not deteriorating. A window of opportunity." },
    { speaker:"owner", expression:"neutral",
      text:"Things are steady. That's something. But steady won't hit the Month 3 target." },
    { speaker:"owner", expression:"thinking",
      text:"We need a new revenue stream. Something that uses what we already have." },
  ],
  checkpoint_evaluation: [
    { speaker:"narrator",
      text:"End of Month 3. The owner pulls out the ledger. Both of you already know what the numbers say." },
    { speaker:"owner", expression:"thinking",
      text:"Three months. Let's see where we actually stand against where we said we'd be." },
  ],
  scaling_phase: [
    { speaker:"owner", expression:"confident",
      text:"We hit it. PKR 2M. I honestly wasn't sure we would." },
    { speaker:"owner", expression:"neutral",
      text:"The business is viable. Now — how do we grow it? Month 6 target is PKR 4M. We're halfway." },
    { speaker:"narrator", text:"Month 4. The business has stabilised. The strategic phase begins." },
  ],
  distress_phase: [
    { speaker:"owner", expression:"desperate",
      text:"We missed the target. I don't have to tell you — you can see it in the numbers." },
    { speaker:"owner", expression:"angry",
      text:"The bank has been calling. The supplier is chasing the overdue balance. I still have fifteen staff to pay Friday." },
    { speaker:"narrator", text:"Month 4. The distress phase. Every decision from here is crisis management." },
    { speaker:"owner", expression:"concerned",
      text:"Tell me honestly — is there still a way out of this?" },
  ],
  month5_scaling: [
    { speaker:"narrator", text:"Month 5. The growth strategy is working. One month left." },
    { speaker:"owner", expression:"confident",
      text:"You know, when you first walked in I thought — what can a student tell me about my own business? I was wrong." },
    { speaker:"owner", expression:"neutral",
      text:"Final month. Do we protect what we've built, or push harder for PKR 4M?" },
  ],
  month5_distress: [
    { speaker:"narrator", text:"Month 5. The restructuring bought time. The business still needs to perform." },
    { speaker:"owner", expression:"concerned",
      text:"One more month. Whatever we do next — it has to work. There's nothing left to cut." },
  ],
  ending_success: [
    { speaker:"narrator", bg:"store", text:"Month 6. The final count is in." },
    { speaker:"owner", expression:"confident", bg:"store",
      text:"We did it. PKR 4M. My accountant confirmed this morning. The investment is recoverable." },
    { speaker:"owner", expression:"neutral", bg:"store",
      text:"You taught me to read my own business. I was running on instinct for years. You brought the numbers into it." },
    { speaker:"narrator", bg:"store",
      text:"FreshMart recovered. The owner's PKR 30M investment is back on track." },
  ],
  ending_survival: [
    { speaker:"narrator", text:"Month 6. Below target, but the store is still standing." },
    { speaker:"owner", expression:"concerned",
      text:"We didn't hit PKR 4M. But we're still here. The staff are paid. The suppliers are talking to us." },
    { speaker:"owner", expression:"thinking",
      text:"Some decisions — I think we needed more time. Or better timing." },
    { speaker:"narrator",
      text:"FreshMart survives. Not the outcome you planned for, but a business that learned from crisis." },
  ],
  ending_failure: [
    { speaker:"narrator", bg:"store", text:"Month 6. The shutters stay down today." },
    { speaker:"owner", expression:"desperate", bg:"store",
      text:"I had to let the remaining staff go last week. It was the hardest day of my life." },
    { speaker:"owner", expression:"concerned", bg:"store",
      text:"PKR 30 million. Eleven years. Gone." },
    { speaker:"narrator", bg:"store",
      text:"FreshMart closes. Decisions made under pressure compounded into an outcome that couldn't be reversed." },
    { speaker:"owner", expression:"thinking", bg:"store",
      text:"Maybe with different choices... I don't know. You tried. Thank you for that." },
  ],
};

// Immediate owner reaction after each decision
const FM_REACTIONS = {
  layoff_employees:     { expression:"concerned",  text:"Staff cuts. It'll help the salary line — but I worry about morale. These boys work hard." },
  take_loan:            { expression:"concerned",  text:"PKR 1M from the bank. Breathing room. Now the pressure is to use it right." },
  increase_prices:      { expression:"thinking",   text:"Some customers won't like it. But if it improves margin without killing footfall..." },
  supplier_credit:      { expression:"confident",  text:"60 days. The breathing room we needed. Good — now we move." },
  aggressive_layoff:    { expression:"angry",      text:"40%? That's a lot. I hope the remaining team can hold the service level." },
  smart_layoff:         { expression:"neutral",    text:"Controlled. We keep service quality but reduce the burden. I can work with this." },
  loan_inventory:       { expression:"confident",  text:"Clear the dead stock, free the cash. Classic. Why didn't I do this months ago?" },
  loan_marketing:       { expression:"thinking",   text:"More footfall — but if margin stays thin, more customers means more loss." },
  bundle_strategy:      { expression:"confident",  text:"Bundles. Higher perceived value, better margin. Customers feel they're getting something." },
  selective_pricing:    { expression:"neutral",    text:"Surgical pricing. Touch only where we have leverage. Smart." },
  inventory_clearance:  { expression:"confident",  text:"Clearance sale. The shelves look better already. Cash moving — that's what we needed." },
  product_refresh:      { expression:"neutral",    text:"New categories. It's a bet — but customers respond to fresh inventory." },
  staff_incentives:     { expression:"confident",  text:"Commission structure. Now the staff want to sell. Alignment at last." },
  category_focus:       { expression:"confident",  text:"80/20. Focus on what actually sells. The rest was noise." },
  upsell_training:      { expression:"neutral",    text:"Training on upselling. Small investment, direct impact on basket size." },
  express_checkout:     { expression:"neutral",    text:"Faster checkout. Customers appreciate that more than discounts." },
  rehire_key_staff:     { expression:"concerned",  text:"Rehiring costs us. But losing long-term customers costs more. Correct call." },
  customer_recovery:    { expression:"thinking",   text:"Vouchers won't solve it permanently — but it buys goodwill while we fix the root." },
  b2b_contracts:        { expression:"confident",  text:"B2B supply. Predictable volume, consistent cash flow. This could be a real pillar." },
  whatsapp_orders:      { expression:"confident",  text:"WhatsApp ordering. Free channel, direct to customer. I like this." },
  second_location:      { expression:"thinking",   text:"Two stores. Double the exposure — double the risk. I hope we're ready." },
  online_channels:      { expression:"confident",  text:"E-commerce. We reach customers who never walk past the store. That's growth." },
  private_label:        { expression:"confident",  text:"Our own brand. Higher margin, stronger identity. Right move." },
  debt_restructuring:   { expression:"neutral",    text:"Extended terms. Monthly burden drops. Now we use the space to perform." },
  asset_liquidation:    { expression:"desperate",  text:"Liquidating. It hurts to watch. But we preserve what's left of the core." },
  consolidate_gains:    { expression:"confident",  text:"Discipline. Protecting a working business is strategy too." },
  final_push:           { expression:"thinking",   text:"All in for Month 6. High risk — but if it works, we hit the target." },
  cost_discipline:      { expression:"concerned",  text:"Cut everything non-essential. Painful but necessary. Survival mode." },
  last_chance_marketing:{ expression:"desperate",  text:"Last gamble. PKR 250K on visibility. It has to convert or we're done." },
};

// ─── Pure helper functions ─────────────────────────────────────────

function fmtMoneyFM(n) {
  const v = Math.abs(Number(n) || 0);
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000)     return `${(v / 1_000).toFixed(0)}K`;
  return String(Math.round(v));
}

function calcRecovery(state) {
  return Math.min(100, Math.round(((state.monthly_sales||0)/(state.month_target_6||4_000_000))*100));
}

function applyFMEffects(base, effects, userPct) {
  const s = { ...base };
  // If this option has a percentageInput type, override relevant effects dynamically
  if (userPct && userPct.type && userPct.value != null) {
    const pct = Number(userPct.value) || 0;
    if (userPct.type === "discount") {
      // Discount: boosts sales volume, hurts margin
      effects = {
        ...effects,
        monthly_sales: `+${Math.round(base.monthly_sales * pct * 0.01 * 0.8)}`,
        profit_margin: `-${(pct * 0.01).toFixed(3)}`
      };
    } else if (userPct.type === "price_increase") {
      // Price increase: boosts margin, reduces footfall proportionally
      effects = {
        ...effects,
        profit_margin: `+${(pct * 0.01).toFixed(3)}`,
        customer_footfall: `-${Math.round(pct * 2)}`,
        customer_satisfaction: `-${(pct * 0.008).toFixed(3)}`
      };
    }
  }
  Object.entries(effects||{}).forEach(([k,v]) => {
    if (typeof v==="string" && v.startsWith("+")) s[k]=Math.max(0,(s[k]||0)+parseFloat(v));
    else if (typeof v==="string" && v.startsWith("-")) s[k]=Math.max(0,(s[k]||0)+parseFloat(v));
    else s[k]=v;
  });
  if (effects.customer_footfall)
    s.footfall_multiplier=Math.max(0.5,s.footfall_multiplier+(parseFloat(effects.customer_footfall)||0)/100);
  if (effects.customer_satisfaction)
    s.conversion_multiplier=Math.max(0.5,s.conversion_multiplier+(parseFloat(effects.customer_satisfaction)||0)*0.3);
  if (effects.employee_morale)
    s.momentum_multiplier=Math.max(0.5,s.momentum_multiplier+(parseFloat(effects.employee_morale)||0)*0.2);
  if (!effects.monthly_sales)
    s.monthly_sales=Math.max(1_000_000,s.growth_base*s.footfall_multiplier*s.conversion_multiplier*s.momentum_multiplier);
  s.decisions_made=(s.decisions_made||0)+1;
  return s;
}

function applyFMMonthlyOps(cur, month) {
  const s={...cur};
  const burn=s.monthly_burn||s.monthly_expenses||900_000;
  s.previous_cash_on_hand=s.cash_on_hand||0;
  s.monthly_expense_deduction=burn;
  let cash=(s.cash_on_hand||0)-burn;
  if (cash<0) {
    const loan=Math.abs(cash);
    s.accumulated_debt=((s.accumulated_debt||0)+loan)*1.15;
    s.loan_taken_this_month=loan;
    s.cash_on_hand=0;
    s.escalation_stage=s.accumulated_debt>=5_000_000?3:s.accumulated_debt>=2_000_000?2:1;
  } else {
    s.cash_on_hand=cash;
    s.loan_taken_this_month=0;
  }
  if (month>=4) {
    if (s.customer_satisfaction>0.7) s.monthly_sales=Math.min(s.monthly_sales*1.1,5_000_000);
    else if (s.customer_satisfaction<0.3) s.monthly_sales=Math.max(s.monthly_sales*0.9,500_000);
  }
  s.current_month=month;
  return s;
}

function fmEvaluateCheckpoint(s) {
  return (s.monthly_sales>=2_000_000 && s.monthly_sales>s.monthly_expenses)
    ? FRESHMART_SCENARIOS.scaling_phase
    : FRESHMART_SCENARIOS.distress_phase;
}

function fmEvaluateFinal(s) {
  const sales=s.monthly_sales||0, debt=s.accumulated_debt||0;
  if (sales>=4_000_000) return FRESHMART_SCENARIOS.ending_success;
  if (sales>=3_000_000 && debt<3_000_000) return FRESHMART_SCENARIOS.ending_success;
  if (sales>=2_700_000 && debt<5_000_000) return FRESHMART_SCENARIOS.ending_survival;
  return FRESHMART_SCENARIOS.ending_failure;
}

function fmResolveNext(nextId, state, month) {
  if (nextId==="benchmark1_evaluation") return fmEvaluateCheckpoint(state);
  if (!nextId||nextId==="ending_evaluation") return fmEvaluateFinal(state);
  if (month>=6) return fmEvaluateFinal(state);
  return FRESHMART_SCENARIOS[nextId]||FRESHMART_SCENARIOS.ending_failure;
}

// ─── DialoguePlayer ────────────────────────────────────────────────
function FMDialoguePlayer({ scenarioId, ownerName, onComplete, session, state }) {
  const lines = generateDynamicDialogue(scenarioId, session, state);
  const [idx,setIdx]         = useState(0);
  const [visible,setVisible] = useState(true);

  useEffect(()=>{ setIdx(0); setVisible(true); },[scenarioId]);

  const done = idx>=lines.length;
  useEffect(()=>{ if(done) onComplete(); },[done]);
  if (!lines.length) { onComplete(); return null; }
  if (done) return null;

  const line    = lines[idx];
  const bg      = FM_BACKGROUNDS[line.bg]||FM_BACKGROUNDS.store;
  const isOwner = line.speaker==="owner";
  const isNarr  = line.speaker==="narrator";

  function advance(){
    setVisible(false);
    setTimeout(()=>{ setIdx(i=>i+1); setVisible(true); },100);
  }

  return (
    <div onClick={advance} style={{cursor:"pointer",marginBottom:20,userSelect:"none",animation:"fadeIn .3s both"}}>

      {/* Scene */}
      <div style={{position:"relative",height:300,overflow:"hidden",border:`1px solid ${T.border}`}}>
        <img src={bg} alt="" style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover"}}
          onError={e=>e.target.style.display="none"}/>

        {/* Vignette */}
        <div style={{position:"absolute",inset:0,
          background:"linear-gradient(to top,rgba(0,0,0,.85) 0%,rgba(0,0,0,.18) 55%,rgba(0,0,0,.5) 100%)",
          pointerEvents:"none"}}/>

        {/* Sprite */}
        {isOwner && line.expression && (
          <img key={`${scenarioId}-${idx}`} src={FM_SPRITES[line.expression]} alt={line.expression}
            style={{position:"absolute",bottom:0,left:"50%",transform:"translateX(-50%)",
              height:"94%",objectFit:"contain",
              animation:visible?"spriteIn .25s both":"none",
              filter:"drop-shadow(0 4px 28px rgba(0,0,0,.75))"}}
            onError={e=>e.target.style.display="none"}/>
        )}

        {/* Progress dots */}
        <div style={{position:"absolute",bottom:10,left:"50%",transform:"translateX(-50%)",display:"flex",gap:5}}>
          {lines.map((_,i)=>(
            <div key={i} style={{width:5,height:5,borderRadius:"50%",
              background:i===idx?T.gold:"rgba(255,255,255,.25)",transition:"background .2s"}}/>
          ))}
        </div>

        {/* Hint */}
        <div style={{position:"absolute",bottom:10,right:14,
          fontFamily:T.mono,fontSize:7,color:"rgba(255,255,255,.4)",
          letterSpacing:1.5,animation:"pulse 2s infinite"}}>▶ CLICK</div>
      </div>

      {/* Dialogue box */}
      <div style={{background:"rgba(6,6,8,.97)",
        border:`1px solid ${isNarr?T.muted+"44":T.gold+"44"}`,
        borderTop:`2px solid ${isNarr?T.muted+"66":T.gold}`,
        padding:"13px 18px",minHeight:72,
        animation:visible?"dialogueIn .18s both":"none"}}>

        {isOwner&&(
          <div style={{fontFamily:T.mono,fontSize:8,color:T.gold,letterSpacing:2.5,marginBottom:7,
            display:"flex",alignItems:"center",gap:8}}>
            <span style={{width:5,height:5,borderRadius:"50%",background:T.gold,display:"inline-block"}}/>
            {(ownerName||"IMRAN KHAN").toUpperCase()} · OWNER
          </div>
        )}
        {isNarr&&(
          <div style={{fontFamily:T.mono,fontSize:7,color:T.muted,letterSpacing:2.5,marginBottom:7}}>NARRATOR</div>
        )}

        <div style={{fontFamily:isNarr?T.mono:T.sans,fontSize:isNarr?11:13,
          color:isNarr?T.dim:T.txt,lineHeight:1.75,fontStyle:isNarr?"italic":"normal"}}>
          {line.text.replace(/Imran/g,ownerName||"Imran")}
        </div>
      </div>
    </div>
  );
}

// ─── ReactionBox ───────────────────────────────────────────────────
function FMReactionBox({ optionId, ownerName }) {
  const r = FM_REACTIONS[optionId];
  if (!r) return null;
  return (
    <div style={{display:"flex",gap:12,alignItems:"flex-start",
      background:T.surf,border:`1px solid ${T.gold}33`,
      borderLeft:`3px solid ${T.gold}`,padding:"12px 14px",
      marginBottom:16,animation:"fadeUp .3s both"}}>
      <img src={FM_SPRITES[r.expression]} alt={r.expression}
        style={{width:52,height:52,objectFit:"cover",objectPosition:"top center",
          flexShrink:0,border:`1px solid ${T.border}`}}
        onError={e=>e.target.style.display="none"}/>
      <div>
        <div style={{fontFamily:T.mono,fontSize:7,color:T.gold,letterSpacing:2,marginBottom:5}}>
          {(ownerName||"IMRAN").toUpperCase().split(" ")[0]} REACTS
        </div>
        <div style={{fontFamily:T.sans,fontSize:12,color:T.dim,lineHeight:1.65}}>
          "{r.text}"
        </div>
      </div>
    </div>
  );
}

// ─── XpPopup ───────────────────────────────────────────────────────
function FMXpPopup({ xp, visible }) {
  if (!visible||!xp) return null;
  return (
    <div style={{position:"fixed",top:76,right:22,zIndex:999,
      fontFamily:T.serif,fontSize:22,color:T.gold,fontWeight:900,
      animation:"xpPop 1.4s both",pointerEvents:"none",
      textShadow:`0 0 22px ${T.gold}`}}>
      +{xp} XP
    </div>
  );
}

// ─── PercentageInputPanel ──────────────────────────────────────────
function PercentageInputPanel({ config, value, onChange, baseState }) {
  const pct = Number(value) || config.default;
  const type = config.type;

  // Compute live impact preview
  const preview = (() => {
    if (type === "discount") {
      const salesBoost = Math.round((baseState.monthly_sales||1_000_000) * pct * 0.01 * 0.8);
      const marginDrop = (pct * 0.01 * 100).toFixed(1);
      return [
        { label: "Monthly Sales ↑", value: `+PKR ${salesBoost>=1e6?(salesBoost/1e6).toFixed(1)+"M":(salesBoost/1e3).toFixed(0)+"K"}`, color: T.green },
        { label: "Profit Margin ↓", value: `-${marginDrop}pp`, color: T.red },
        { label: "Dead Stock Cleared", value: "Partial", color: T.gold },
      ];
    } else {
      const footfallDrop = Math.round(pct * 2);
      const margGain = (pct * 0.01 * 100).toFixed(1);
      const csatDrop = (pct * 0.8).toFixed(1);
      return [
        { label: "Profit Margin ↑", value: `+${margGain}pp`, color: T.green },
        { label: "Daily Footfall ↓", value: `-${footfallDrop} customers`, color: T.red },
        { label: "Customer Satisfaction ↓", value: `-${csatDrop}%`, color: T.red },
      ];
    }
  })();

  const trackPct = Math.round(((pct - config.min) / (config.max - config.min)) * 100);

  return (
    <div style={{
      marginTop: 12, padding: "14px 16px",
      background: "#0a0f1a",
      border: `1px solid ${T.gold}44`,
      borderLeft: `3px solid ${T.gold}`,
      animation: "fadeIn .2s both"
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <span style={{ fontFamily: T.mono, fontSize: 8, color: T.gold, letterSpacing: 2 }}>
          {config.label.toUpperCase()}
        </span>
        <div style={{
          fontFamily: T.mono, fontSize: 16, fontWeight: 700,
          color: T.gold, minWidth: 46, textAlign: "right"
        }}>
          {pct}%
        </div>
      </div>

      {/* Slider */}
      <div style={{ position: "relative", marginBottom: 10 }}>
        <div style={{
          height: 4, background: T.muted, borderRadius: 2, position: "relative", overflow: "hidden"
        }}>
          <div style={{
            position: "absolute", left: 0, top: 0, height: "100%",
            width: `${trackPct}%`, background: T.gold, transition: "width .1s"
          }}/>
        </div>
        <input
          type="range"
          min={config.min} max={config.max} value={pct} step={1}
          onChange={e => onChange(Number(e.target.value))}
          style={{
            position: "absolute", inset: 0, width: "100%", height: "100%",
            opacity: 0, cursor: "pointer", margin: 0
          }}
        />
      </div>

      {/* Min/Max labels */}
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
        <span style={{ fontFamily: T.mono, fontSize: 7, color: T.dim }}>{config.min}%</span>
        <span style={{ fontFamily: T.mono, fontSize: 7, color: T.dim }}>{config.max}%</span>
      </div>

      {/* Impact preview */}
      <div style={{
        padding: "8px 10px", background: T.surf,
        border: `1px solid ${T.border}`, borderTop: `1px solid ${T.goldM}`
      }}>
        <div style={{ fontFamily: T.mono, fontSize: 7, color: T.muted, letterSpacing: 2, marginBottom: 6 }}>
          PROJECTED IMPACT
        </div>
        {preview.map((row, i) => (
          <div key={i} style={{
            display: "flex", justifyContent: "space-between", gap: 8,
            paddingBottom: i < preview.length - 1 ? 4 : 0
          }}>
            <span style={{ fontFamily: T.mono, fontSize: 8, color: T.dim }}>{row.label}</span>
            <span style={{ fontFamily: T.mono, fontSize: 8, color: row.color, fontWeight: 700 }}>{row.value}</span>
          </div>
        ))}
      </div>

      {/* Intensity warning */}
      {type === "discount" && pct >= 50 && (
        <div style={{ marginTop: 6, fontFamily: T.mono, fontSize: 7, color: T.red, letterSpacing: 1 }}>
          ⚠ Heavy discount — margin damage may be irreversible
        </div>
      )}
      {type === "price_increase" && pct >= 30 && (
        <div style={{ marginTop: 6, fontFamily: T.mono, fontSize: 7, color: "#F97316", letterSpacing: 1 }}>
          ⚡ Aggressive increase — high footfall loss risk
        </div>
      )}
    </div>
  );
}

// ─── OptionCard ────────────────────────────────────────────────────
function FMOptionCard({ option, index, onSelect, userPercentages, onPercentageChange, baseState }) {
  const [hov,setHov]=useState(false);
  const xpVal   = option.xp||10;
  const quality = xpVal>=30?"OPTIMAL":xpVal>=20?"MODERATE":"RISKY";
  const qColor  = xpVal>=30?T.green:xpVal>=20?T.gold:T.red;
  const hasPctInput = !!option.percentageInput;
  const pctKey  = option.id;
  const currentPct = userPercentages?.[pctKey] ?? option.percentageInput?.default ?? 15;

  function handleSelect() {
    const pctData = hasPctInput ? { type: option.percentageInput.type, value: currentPct } : null;
    onSelect(option, pctData);
  }

  return (
    <div
      onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
      style={{background:hov?T.surf2:T.surf,
        border:`1px solid ${hov?qColor+"66":T.border}`,
        borderLeft:`3px solid ${qColor}`,
        padding:"15px 18px",
        transition:"all .18s",position:"relative"}}>
      <div style={{position:"absolute",top:10,right:12,
        fontFamily:T.mono,fontSize:7,color:T.gold,
        border:`1px solid ${T.goldM}`,padding:"2px 7px",letterSpacing:1}}>
        +{xpVal} XP
      </div>
      <div style={{fontFamily:T.mono,fontSize:7,color:qColor,letterSpacing:2,marginBottom:5}}>
        OPTION {index+1} · {quality}
      </div>
      <div style={{fontFamily:T.sans,fontSize:13,color:T.txt,lineHeight:1.5,fontWeight:600,paddingRight:64}}>
        {option.label}
      </div>

      {/* Percentage input panel (always visible when option has pctInput) */}
      {hasPctInput && (
        <PercentageInputPanel
          config={option.percentageInput}
          value={currentPct}
          onChange={val => onPercentageChange(pctKey, val)}
          baseState={baseState}
        />
      )}

      {/* Static effect preview for non-percentage options */}
      {!hasPctInput && hov && option.effect && (
        <div style={{marginTop:10,paddingTop:10,borderTop:`1px solid ${T.border}`,
          display:"grid",gridTemplateColumns:"1fr 1fr",gap:4,animation:"fadeIn .15s both"}}>
          {Object.entries(option.effect).map(([k,v])=>{
            const pos=typeof v==="string"&&v.startsWith("+");
            const neg=typeof v==="string"&&v.startsWith("-");
            if (!pos&&!neg) return null;
            return (
              <div key={k} style={{display:"flex",justifyContent:"space-between",gap:6}}>
                <span style={{fontFamily:T.mono,fontSize:7,color:T.dim}}>{k.replace(/_/g," ")}</span>
                <span style={{fontFamily:T.mono,fontSize:7,color:pos?T.green:T.red,fontWeight:700}}>{String(v)}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Confirm button */}
      <button
        onClick={handleSelect}
        style={{
          marginTop: 12, width: "100%",
          background: hov ? qColor+"22" : "transparent",
          border: `1px solid ${qColor}66`,
          color: qColor, fontFamily: T.mono, fontSize: 9,
          padding: "7px 0", cursor: "pointer", letterSpacing: 2,
          transition: "all .15s"
        }}
        onMouseEnter={e=>{e.currentTarget.style.background=qColor+"33";}}
        onMouseLeave={e=>{e.currentTarget.style.background=hov?qColor+"22":"transparent";}}
      >
        {hasPctInput ? `CONFIRM AT ${currentPct}% →` : "SELECT →"}
      </button>
    </div>
  );
}

// ─── MAIN COMPONENT ────────────────────────────────────────────────
function FreshMartSim({ onBack, onComplete, onDecisionXP, user }) {

  // Stable session — never regenerates on re-render
  const sessionRef=useRef(null);
  if (!sessionRef.current) sessionRef.current=generateFreshMartSession(user?.xp||0);
  const session   = sessionRef.current;
  const ownerName = session.owner_name||"Imran Khan";

  const [state,setState]                     = useState(()=>({...session.initialState}));
  const [currentMonth,setCurrentMonth]       = useState(1);
  const [phase,setPhase]                     = useState("dialogue");
  const [selectedOption,setSelectedOption]   = useState(null);
  const [decisionHistory,setDecisionHistory] = useState([]);
  const [currentScenario,setCurrentScenario] = useState(FRESHMART_SCENARIOS.start);
  const [permanentConsequences,setPermanentConsequences] = useState({});
  const [userPercentages,setUserPercentages]             = useState({});
  const [isMobile,setIsMobile]               = useState(false);
  const [timeRemaining,setTimeRemaining]     = useState(120);
  const [timerActive,setTimerActive]         = useState(false);
  const [xpPopup,setXpPopup]                 = useState({visible:false,xp:0});
  const [shake,setShake]                     = useState(false);
  const topRef = useRef(null);

  const recoveryScore   = calcRecovery(state);
  const isEnding        = !!currentScenario?.isEnding;
  const isCheckpoint    = !!currentScenario?.checkpoint;
  const salesTargetProg = (state.monthly_sales||0)/(state.month_target_3||2_000_000);
  const endColor        = currentScenario?.type==="success"?T.green:currentScenario?.type==="failure"?T.red:T.gold;

  useEffect(()=>{
    const fn=()=>setIsMobile(window.innerWidth<=768);
    fn(); window.addEventListener("resize",fn);
    return ()=>window.removeEventListener("resize",fn);
  },[]);

  // Timer sound helpers
  const audioContextRef = useRef(null);
  const playTickSound = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    const ctx = audioContextRef.current;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 800;
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.05, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.1);
  }, []);

  const playWarningSound = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    const ctx = audioContextRef.current;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 600;
    osc.type = 'square';
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.3);
  }, []);

  const playAlarmSound = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    const ctx = audioContextRef.current;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 400;
    osc.type = 'sawtooth';
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.5);
  }, []);

  useEffect(()=>{
    if (!timerActive||timeRemaining<=0) return;
    const id=setInterval(()=>{
      setTimeRemaining(t=>{
        const newTime = t-1;
        if (newTime<=0){ setTimerActive(false); handleTimeExpired(); playAlarmSound(); return 120; }
        if (newTime<=30 && newTime>0 && (newTime===30 || newTime===15 || newTime===10 || newTime<=5)) playWarningSound();
        else playTickSound();
        return newTime;
      });
    },1000);
    return ()=>clearInterval(id);
  },[timerActive,timeRemaining,playTickSound,playWarningSound,playAlarmSound]);

  useEffect(()=>{
    if (phase==="decision"&&!isEnding&&!isCheckpoint){ setTimeRemaining(120); setTimerActive(true); }
    else setTimerActive(false);
  },[phase,currentMonth]);

  useEffect(()=>{
    if (user?.id) startSession(supabase,user.id,session).catch(e=>console.warn("session start:",e));
  },[]);

  function handleDialogueComplete(){ setPhase(isEnding?"ending":"decision"); }

  function handleTimeExpired(){
    const opts=currentScenario.options||[];
    if (opts.length) handleOptionSelect(opts[Math.floor(Math.random()*opts.length)]);
  }

  function handleOptionSelect(option, pctData){
    setTimerActive(false);
    setSelectedOption(option);
    const newState=applyFMEffects(state,option.effect||{},pctData);
    const decision={month:currentMonth,scenarioId:currentScenario.id,
      optionId:option.id,optionLabel:option.label,xpEarned:option.xp||10,
      percentageUsed:pctData||null};
    const newHistory=[...decisionHistory,decision];
    setDecisionHistory(newHistory);
    setState(newState);
    setPhase("result");
    setXpPopup({visible:true,xp:option.xp||10});
    setTimeout(()=>setXpPopup({visible:false,xp:0}),1500);
    const bigNeg=Object.values(option.effect||{}).some(v=>typeof v==="string"&&v.startsWith("-")&&Math.abs(parseFloat(v))>200_000);
    if (bigNeg){ setShake(true); setTimeout(()=>setShake(false),500); }
    onDecisionXP&&onDecisionXP(option.xp||10,currentMonth);
    awardDecisionXP(option.xp||10,currentMonth);
    saveDecision(supabase,session.session_id,newState,newHistory).catch(()=>{});
    topRef.current?.scrollIntoView({behavior:"smooth"});
  }

  function handleContinue(){
    if (isEnding){
      completeSession(supabase,session.session_id,currentScenario.type||"failure",
        state,recoveryScore,session.xpMultiplier||1,
        decisionHistory.map(d=>d.optionId),user?.id).catch(()=>{});
      onComplete?.({
        log:decisionHistory.map(d=>({action:d.optionLabel,month:d.month})),
        state,endingType:currentScenario.type,month:currentMonth,
        caseCompany:"FreshMart",caseDiff:"SEED",caseType:"simulation",caseId:"freshmart-sim",
        keyInsights:[{
          crisisHook:"FreshMart was burning PKR 900K/month with 10% margin.",
          pathText:decisionHistory.slice(0,3).map(d=>d.optionLabel).join(" → "),
          score:Math.round(recoveryScore),
          ending:currentScenario.type==="success"?"Business Saved":currentScenario.type==="failure"?"Business Failed":"Business Survived",
          finalSales:state.monthly_sales||0,
        }],
      });
      return;
    }

    let nextScenario;
    if (isCheckpoint) nextScenario=fmEvaluateCheckpoint(state);
    else if (currentMonth>=6) nextScenario=fmEvaluateFinal(state);
    else nextScenario=fmResolveNext(selectedOption?.next,state,currentMonth);

    const newMonth=isCheckpoint?4:Math.min(currentMonth+1,6);
    const updatedState=applyFMMonthlyOps(state,newMonth);
    updatedState.current_month=newMonth;

    setCurrentScenario(nextScenario);
    setCurrentMonth(newMonth);
    setState(updatedState);
    setSelectedOption(null);
    setPhase("dialogue");
    topRef.current?.scrollIntoView({behavior:"smooth"});
  }

  function resetSimulation(){
    sessionRef.current=null;
    sessionRef.current=generateFreshMartSession(user?.xp||0);
    const s=sessionRef.current;
    setState({...s.initialState});
    setCurrentMonth(1);
    setPhase("dialogue");
    setCurrentScenario(FRESHMART_SCENARIOS.start);
    setSelectedOption(null);
    setDecisionHistory([]);
    setPermanentConsequences({});
    setUserPercentages({});
  }

  function formatTime(s){ return `${Math.floor(s/60)}:${String(s%60).padStart(2,"0")}`; }

  const timerColor=timeRemaining<=30?T.red:timeRemaining<=60?"#F97316":T.gold;

  // Sidebar announcements
  const ann=[];
  if ((state.cash_on_hand||0)<=0)
    ann.push({icon:"🚨",color:T.red,pulse:true,title:"CASH CRISIS",body:"Reserves depleted. Line of credit activated — 15% monthly interest."});
  if ((state.accumulated_debt||0)>0)
    ann.push({icon:"💣",color:"#F97316",pulse:(state.escalation_stage||0)>=2,title:`DEBT: PKR ${fmtMoneyFM(state.accumulated_debt)}`,body:`+PKR ${fmtMoneyFM((state.accumulated_debt||0)*0.15)}/month interest.`});
  if ((state.loan_taken_this_month||0)>0)
    ann.push({icon:"💳",color:"#F97316",pulse:false,title:"CREDIT LINE USED",body:`PKR ${fmtMoneyFM(state.loan_taken_this_month)} borrowed this month.`});
  if ((state.dead_stock_units||0)>150)
    ann.push({icon:"📦",color:T.red,pulse:false,title:"INVENTORY ALERT",body:`${state.dead_stock_units} dead SKUs. Cash locked in shelves.`});
  if ((state.customer_satisfaction||1)<0.4&&currentMonth>=2)
    ann.push({icon:"📢",color:T.blue,pulse:false,title:"CUSTOMER FEEDBACK",body:"Satisfaction critical. Negative reviews spreading."});
  if ((state.employee_morale||1)<0.3&&currentMonth>=3)
    ann.push({icon:"👥",color:"#F97316",pulse:false,title:"STAFF MORALE",body:"Team disengaged. Walkout risk rising."});
  if ((state.debt_stress||0)>0.6&&currentMonth>=2)
    ann.push({icon:"⚠️",color:T.red,pulse:false,title:"SUPPLIER PRESSURE",body:"Suppliers demanding faster payment."});
  if ((state.monthly_sales||0)>=(state.month_target_3||2_000_000)&&currentMonth<=3)
    ann.push({icon:"🎉",color:T.green,pulse:false,title:"TARGET MET",body:`Month 3 target of PKR ${fmtMoneyFM(state.month_target_3)} achieved!`});

  // ── Render ─────────────────────────────────────────────────────
  return (
    <div ref={topRef} style={{minHeight:"100vh",background:T.bg,display:"flex",flexDirection:"column",
      animation:shake?"screenShake .4s both":"none"}}>

      <FMXpPopup xp={xpPopup.xp} visible={xpPopup.visible}/>

      <TopBar label={`${(ownerName||"Imran Khan").toUpperCase().split(" ")[0]}'S GENERAL STORE`}
        sub="BRANCHING SIMULATION" onBack={onBack}
        right={
          <div style={{display:"flex",gap:10,alignItems:"center"}}>
            <span style={{fontFamily:T.mono,fontSize:7,color:DC.SEED,border:`1px solid ${DC.SEED}44`,padding:"2px 8px",letterSpacing:1.5}}>SEED</span>
            <button onClick={resetSimulation}
              style={{background:"none",border:`1px solid ${T.border}`,color:T.dim,fontFamily:T.mono,fontSize:9,padding:"4px 12px",cursor:"pointer",letterSpacing:2}}
              onMouseEnter={e=>{e.currentTarget.style.borderColor=T.red;e.currentTarget.style.color=T.red;}}
              onMouseLeave={e=>{e.currentTarget.style.borderColor=T.border;e.currentTarget.style.color=T.dim;}}>
              ↺ RESTART
            </button>
          </div>
        }/>

      <div style={{height:3,background:T.muted,flexShrink:0}}>
        <div style={{height:"100%",width:`${Math.min(100,recoveryScore)}%`,background:T.gold,transition:"width .6s ease"}}/>
      </div>

      {/* Stats ticker */}
      <div style={{background:"#0d1a2e",borderBottom:`1px solid ${T.border}`,padding:"10px 20px",overflowX:"auto",flexShrink:0}}>
        <div style={{display:"flex",gap:22,alignItems:"center",minWidth:"max-content"}}>
          {[
            {key:"monthly_sales",         label:"Sales",       icon:"💰",fmt:"money"},
            {key:"monthly_expenses",       label:"Expenses",    icon:"📊",fmt:"money"},
            {key:"cash_on_hand",           label:"Cash",        icon:"💵",fmt:"money"},
            {key:"customer_satisfaction",  label:"CSAT",        icon:"😊",fmt:"pct"},
            {key:"employee_morale",        label:"Morale",      icon:"👥",fmt:"pct"},
            {key:"debt_stress",            label:"Debt Stress", icon:"⚠️",fmt:"pct"},
          ].map(st=>{
            const val=state[st.key]||0;
            const disp=st.fmt==="money"?`PKR ${fmtMoneyFM(val)}`:`${Math.round(val*100)}%`;
            const prev=state.previous_values?.[st.key];
            const diff=prev!==undefined?(val>prev?1:val<prev?-1:0):0;
            return (
              <div key={st.key} style={{display:"flex",flexDirection:"column",gap:2}}>
                <span style={{fontFamily:T.mono,fontSize:8,color:"#7aa6d4",letterSpacing:1}}>{st.icon} {st.label}</span>
                <div style={{display:"flex",alignItems:"baseline",gap:5}}>
                  <span style={{fontFamily:T.mono,fontSize:12,color:"#fff",fontWeight:600}}>{disp}</span>
                  {diff!==0&&<span style={{fontFamily:T.mono,fontSize:8,color:diff>0?T.green:T.red}}>{diff>0?"▲":"▼"}</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Body */}
      <div style={{flex:1,display:isMobile?"block":"flex",padding:isMobile?"16px 12px":"20px 16px",gap:20,overflowY:"auto"}}>

        {/* Main */}
        <div style={{flex:1,minWidth:0}}>

          {phase==="dialogue"&&(
            <FMDialoguePlayer scenarioId={currentScenario.id} ownerName={ownerName} onComplete={handleDialogueComplete} session={session} state={state}/>
          )}

          {phase==="decision"&&!isEnding&&(
            <div style={{animation:"fadeUp .3s both"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
                <div style={{fontFamily:T.mono,fontSize:8,color:T.dim,letterSpacing:3}}>
                  {isCheckpoint?`MONTH ${currentMonth} · CHECKPOINT`:`MONTH ${currentMonth} · DECISION`}
                </div>
                {timerActive&&(
                  <div style={{display:"flex",alignItems:"center",gap:8,background:T.surf,border:`1px solid ${timerColor}`,padding:"5px 12px"}}>
                    <span style={{fontFamily:T.mono,fontSize:7,color:T.dim,letterSpacing:1}}>⏰</span>
                    <span style={{fontFamily:T.mono,fontSize:10,color:timerColor,fontWeight:700}}>{formatTime(timeRemaining)}</span>
                  </div>
                )}
              </div>

              {isCheckpoint?(
                <>
                  <div style={{background:T.surf,border:`1px solid ${T.gold}`,padding:"16px 18px",marginBottom:16}}>
                    <div style={{fontFamily:T.mono,fontSize:9,color:T.gold,marginBottom:8}}>CHECKPOINT EVALUATION</div>
                    <div style={{fontFamily:T.sans,fontSize:12,color:T.dim,lineHeight:1.6}}>
                      Sales: PKR {fmtMoneyFM(state.monthly_sales)} | Target: PKR {fmtMoneyFM(state.month_target_3||2_000_000)}
                      <span style={{color:salesTargetProg>=1?T.green:T.red,marginLeft:8}}>
                        {salesTargetProg>=1?"✓ TARGET MET":"✗ TARGET MISSED"}
                      </span>
                    </div>
                  </div>
                  <button onClick={handleContinue} style={{width:"100%",background:T.gold,border:"none",color:"#000",fontFamily:T.mono,fontSize:11,fontWeight:800,padding:"12px",cursor:"pointer",letterSpacing:2}}>
                    CONTINUE TO MONTH 4 →
                  </button>
                </>
              ):(
                <>
                  <div style={{fontFamily:T.mono,fontSize:7,color:T.muted,letterSpacing:2,marginBottom:12}}>
                    {(currentScenario.options||[]).length} OPTIONS — SET PARAMETERS & CONFIRM
                  </div>
                  <div style={{display:"flex",flexDirection:"column",gap:10}}>
                    {(currentScenario.options||[]).map((opt,i)=>(
                      <FMOptionCard
                        key={opt.id}
                        option={opt}
                        index={i}
                        onSelect={handleOptionSelect}
                        userPercentages={userPercentages}
                        onPercentageChange={(key, val) => setUserPercentages(prev => ({...prev, [key]: val}))}
                        baseState={state}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {phase==="result"&&selectedOption&&(
            <div style={{animation:"fadeUp .3s both"}}>
              <div style={{fontFamily:T.mono,fontSize:8,color:T.gold,letterSpacing:3,marginBottom:12}}>DECISION LOCKED IN</div>
              <FMReactionBox optionId={selectedOption.id} ownerName={ownerName}/>
              <div style={{background:T.surf,border:`1px solid ${T.gold}44`,padding:"15px 18px",marginBottom:16}}>
                <div style={{fontFamily:T.sans,fontSize:13,color:T.txt,fontWeight:600,marginBottom:8}}>{selectedOption.label}</div>
                {decisionHistory[decisionHistory.length-1]?.percentageUsed && (
                  <div style={{fontFamily:T.mono,fontSize:8,color:T.gold,marginBottom:6,letterSpacing:1}}>
                    {decisionHistory[decisionHistory.length-1].percentageUsed.type === "discount" ? "DISCOUNT" : "PRICE INCREASE"}: {decisionHistory[decisionHistory.length-1].percentageUsed.value}% APPLIED
                  </div>
                )}
                <div style={{fontFamily:T.mono,fontSize:9,color:T.gold}}>+{selectedOption.xp||10} XP earned</div>
                {(state.monthly_expense_deduction||0)>0&&(
                  <div style={{marginTop:10,paddingTop:10,borderTop:`1px solid ${T.border}`}}>
                    <div style={{fontFamily:T.mono,fontSize:7,color:T.dim,letterSpacing:1.5,marginBottom:4}}>MONTHLY BURN DEDUCTED</div>
                    <div style={{fontFamily:T.mono,fontSize:11,color:T.dim}}>
                      PKR {fmtMoneyFM(state.previous_cash_on_hand)} → PKR {fmtMoneyFM(state.cash_on_hand)}
                    </div>
                  </div>
                )}
              </div>
              <button onClick={handleContinue} style={{width:"100%",background:T.gold,border:"none",color:"#000",fontFamily:T.mono,fontSize:11,fontWeight:800,padding:"12px",cursor:"pointer",letterSpacing:2}}>
                CONTINUE TO MONTH {Math.min(currentMonth+1,6)} →
              </button>
            </div>
          )}

          {phase==="ending"&&isEnding&&(
            <div style={{animation:"fadeUp .3s both"}}>
              <div style={{fontFamily:T.mono,fontSize:8,color:endColor,letterSpacing:3,marginBottom:12}}>
                {currentScenario.type==="success"?"OPTIMAL RECOVERY":currentScenario.type==="failure"?"BUSINESS FAILURE":"SURVIVING — BARELY"}
              </div>
              <div style={{background:T.surf,border:`1px solid ${endColor}`,padding:"24px 26px",marginBottom:20}}>
                <div style={{fontFamily:T.serif,fontSize:20,color:endColor,fontWeight:800,marginBottom:14}}>
                  {currentScenario.type==="success"?`${ownerName.split(" ")[0]}'s Store Recovered`
                   :currentScenario.type==="failure"?"The Store Closed":"The Store Survives"}
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                  <div style={{background:T.bg,border:`1px solid ${T.border}`,padding:"10px 12px"}}>
                    <div style={{fontFamily:T.mono,fontSize:7,color:T.dim,letterSpacing:1.5,marginBottom:4}}>RECOVERY SCORE</div>
                    <div style={{fontFamily:T.serif,fontSize:26,color:endColor,fontWeight:900}}>{Math.round(recoveryScore)}%</div>
                  </div>
                  <div style={{background:T.bg,border:`1px solid ${T.border}`,padding:"10px 12px"}}>
                    <div style={{fontFamily:T.mono,fontSize:7,color:T.dim,letterSpacing:1.5,marginBottom:4}}>DECISIONS MADE</div>
                    <div style={{fontFamily:T.serif,fontSize:26,color:T.txt,fontWeight:900}}>{decisionHistory.length}</div>
                  </div>
                </div>
              </div>
              <button onClick={handleContinue} style={{width:"100%",background:endColor,border:"none",color:"#000",fontFamily:T.mono,fontSize:11,fontWeight:800,padding:"14px",cursor:"pointer",letterSpacing:2}}>
                VIEW FULL RESULTS & CLAIM REWARDS →
              </button>
            </div>
          )}

          {decisionHistory.length>0&&phase!=="dialogue"&&(
            <div style={{marginTop:24,borderTop:`1px solid ${T.border}`,paddingTop:18}}>
              <div style={{fontFamily:T.mono,fontSize:7,color:T.muted,letterSpacing:3,marginBottom:10}}>DECISION PATH</div>
              {decisionHistory.map((d,i)=>(
                <div key={i} style={{display:"flex",gap:10,alignItems:"flex-start",marginBottom:8}}>
                  <div style={{width:18,height:18,background:T.muted,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                    <span style={{fontFamily:T.mono,fontSize:7,color:T.dim}}>{i+1}</span>
                  </div>
                  <div>
                    <div style={{fontFamily:T.sans,fontSize:11,color:T.dim}}>{d.optionLabel}</div>
                    <div style={{fontFamily:T.mono,fontSize:7,color:T.muted,letterSpacing:1}}>Month {d.month} · +{d.xpEarned} XP</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div style={{width:isMobile?"100%":268,
          borderLeft:isMobile?"none":`2px solid ${T.border}`,
          borderTop:isMobile?`2px solid ${T.border}`:"none",
          overflowY:"auto",padding:isMobile?"16px 0":"20px 16px",flexShrink:0}}>

          <div style={{marginBottom:18,background:T.surf,border:`1px solid ${T.border}`,padding:"12px 14px"}}>
            <div style={{fontFamily:T.mono,fontSize:7,color:T.muted,letterSpacing:2,marginBottom:10}}>TIMELINE</div>
            <div style={{display:"flex",gap:3}}>
              {[1,2,3,4,5,6].map(m=>{
                const done=m<currentMonth,cur=m===currentMonth;
                return (
                  <div key={m} style={{flex:1,height:26,
                    background:done?T.gold:cur?T.surf2:T.bg,
                    border:`1px solid ${cur?T.gold:done?T.goldM:T.border}`,
                    display:"flex",alignItems:"center",justifyContent:"center"}}>
                    <span style={{fontFamily:T.mono,fontSize:8,color:done?"#000":cur?T.gold:T.muted}}>{m}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{fontFamily:T.mono,fontSize:7,color:T.muted,letterSpacing:2,marginBottom:10}}>LIVE FEED</div>
          {ann.length===0&&(
            <div style={{background:T.surf,border:`1px solid ${T.border}`,borderLeft:`3px solid ${T.muted}`,padding:"11px 13px",marginBottom:8}}>
              <div style={{fontFamily:T.mono,fontSize:7,color:T.muted,letterSpacing:1.5,marginBottom:4}}>STATUS</div>
              <div style={{fontFamily:T.sans,fontSize:10,color:T.dim,lineHeight:1.5}}>Operations ongoing. Make your decisions wisely.</div>
            </div>
          )}
          {ann.map((a,i)=>(
            <div key={i} style={{background:T.surf,border:`1px solid ${a.color}33`,
              borderLeft:`3px solid ${a.color}`,padding:"10px 12px",marginBottom:8,
              animation:a.pulse?"pulse 2s infinite":"none"}}>
              <div style={{display:"flex",gap:8,alignItems:"flex-start"}}>
                <span style={{fontSize:13,flexShrink:0}}>{a.icon}</span>
                <div>
                  <div style={{fontFamily:T.mono,fontSize:7,color:a.color,letterSpacing:1.5,marginBottom:4}}>{a.title}</div>
                  <div style={{fontFamily:T.sans,fontSize:10,color:T.dim,lineHeight:1.5}}>{a.body}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   LOBBY
═══════════════════════════════════════════════════════════════════ */
function Lobby({onNav,user,leaderboard,leaderboardLoading,feed,caseList}){
  const [hov,setHov]=useState(null);
  const [isMobile,setIsMobile]=useState(()=>{
    if(typeof window==="undefined") return false;
    return window.innerWidth<=768;
  });
  useEffect(()=>{
    if(typeof window==="undefined") return;
    const onResize=()=>setIsMobile(window.innerWidth<=768);
    onResize();
    window.addEventListener("resize",onResize);
    return ()=>window.removeEventListener("resize",onResize);
  },[]);
  const list = caseList||CASE_LIST_FALLBACK;
  const modes=[
    {id:"cases",icon:"⬡",code:"01",color:T.gold,title:"Case Simulation",sub:"Dissect. Decide. Score.",desc:"Timed case rooms anchored to real company data. Choose Business Scenario or Financial Statement. Earn XP, rank globally, share results.",badge:"MOST PLAYED",active:list.length||5},
    {id:"boardroom",icon:"◈",code:"02",color:T.blue,title:"The Boardroom",sub:"Defend your numbers. Live.",desc:"Present your financial analysis to a live audience. Gallery watches, reacts, and votes on every decision in real time.",badge:"LIVE NOW",active:218},
  ];
  return(
    <div style={{flex:1,display:"flex",flexDirection:"column",overflow:isMobile?"visible":"hidden"}}>
      <TickerBar user={user}/>
      <div style={{position:"relative",padding:isMobile?"28px 16px 20px":"48px 32px 32px",overflow:"hidden",borderBottom:`2px solid ${T.border}`,flexShrink:0}}>
        <HexBg/>
        <div style={{position:"relative",animation:"fadeUp .5s both"}}>
          <div style={{fontFamily:T.mono,fontSize:9,color:T.gold,letterSpacing:4,marginBottom:12}}>▸ COGNITIVE SPORTS ARENA FOR CA STUDENTS</div>
        </div>
      </div>
      <div style={{flex:1,display:"flex",flexDirection:isMobile?"column":"row",gap:0,overflow:isMobile?"visible":"hidden"}}>
        <div style={{flex:1,overflowY:isMobile?"visible":"auto",padding:isMobile?"16px 12px":"24px 28px",display:"flex",flexDirection:"column",gap:isMobile?16:20}}>
          <XPBar user={user}/>
          <div>
            <div style={{fontFamily:T.mono,fontSize:isMobile?7:8,color:T.muted,letterSpacing:3,marginBottom:isMobile?8:12}}>GAME MODES</div>
            <div style={{display:"flex",gap:isMobile?8:12,flexWrap:"wrap"}}>
              {modes.map(m=>(
                <div key={m.id} onMouseEnter={()=>setHov(m.id)} onMouseLeave={()=>setHov(null)} onClick={()=>onNav(m.id)} style={{flex:1,minWidth:isMobile?"100%":230,background:hov===m.id?"#0e0e12":T.surf,border:`2px solid ${hov===m.id?m.color:T.border}`,padding:isMobile?"16px 14px":"24px 22px",cursor:"pointer",transition:"all .2s",position:"relative",boxShadow:hov===m.id?`0 0 40px ${m.color}12`:"none"}}>
                  <div style={{position:"absolute",top:isMobile?8:12,right:isMobile?8:12,background:m.color,color:"#000",fontFamily:T.mono,fontSize:isMobile?7:8,fontWeight:800,padding:"2px 6px",letterSpacing:2}}>{m.badge}</div>
                  <div style={{display:"flex",alignItems:"center",gap:isMobile?6:10,marginBottom:isMobile?10:14}}>
                    <span style={{fontSize:isMobile?20:24,color:m.color}}>{m.icon}</span>
                    <span style={{fontFamily:T.mono,fontSize:isMobile?8:9,color:m.color,letterSpacing:3}}>{m.code}</span>
                  </div>
                  <h3 style={{fontFamily:T.serif,fontSize:isMobile?16:20,color:T.txt,marginBottom:isMobile?3:4,fontWeight:700}}>{m.title}</h3>
                  <div style={{fontFamily:T.mono,fontSize:isMobile?7:8,color:m.color,letterSpacing:2,marginBottom:isMobile?6:8}}>{m.sub}</div>
                  <p style={{fontFamily:T.sans,fontSize:isMobile?12:13.5,color:T.dim,lineHeight:1.6,maxWidth:isMobile?320:460}}>{m.desc}</p>
                </div>
              ))}
            </div>
         <div>
            <div style={{fontFamily:T.mono,fontSize:8,color:T.muted,letterSpacing:3,marginBottom:12}}>FEATURED CASES</div>
            <div style={{display:"flex",flexDirection:"column",gap:7}}>
              {list.map(c=>(
                <div key={c.id}
                  onClick={()=>{
                    if(canAccessDifficulty(user?.xp||0, c.diff)) onNav(`case-${c.id}`);
                  }}
                  style={{background:T.surf,border:`1px solid ${T.border}`,padding:"13px 16px",cursor:canAccessDifficulty(user?.xp||0, c.diff)?"pointer":"not-allowed",display:"flex",alignItems:"center",gap:14,transition:"all .15s",opacity:canAccessDifficulty(user?.xp||0, c.diff)?1:0.58}}
                  onMouseEnter={e=>{e.currentTarget.style.borderColor=DC[c.diff]+"55";e.currentTarget.style.background="#0e0e12";}}
                  onMouseLeave={e=>{e.currentTarget.style.borderColor=T.border;e.currentTarget.style.background=T.surf;}}>
                  <div style={{width:3,height:38,background:DC[c.diff],flexShrink:0}}/>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:"flex",gap:7,alignItems:"center",marginBottom:5,flexWrap:"wrap"}}>
                      <span style={{fontFamily:T.sans,fontSize:13,color:"#ddd",fontWeight:600,marginBottom:2}}>{c.label}{c.hasSim&&<span style={{marginLeft:8,fontFamily:T.mono,fontSize:7,color:T.blue,border:`1px solid ${T.blue}44`,padding:"1px 6px",letterSpacing:1}}>SIM</span>}</span>
                      <Tag color={DC[c.diff]} small>{c.diff}</Tag>
                      <Tag color={c.type==="financial"?T.blue:T.gold} small filled>{c.type==="financial"?"FINANCIAL":"SCENARIO"}</Tag>
                    </div>
                    <div style={{fontFamily:T.mono,fontSize:8,color:T.dim,letterSpacing:1}}>{c.sub}</div>
                    {c.hasSim&&(
                      <button
                        onClick={(e)=>{
                          e.stopPropagation();
                          if(canAccessDifficulty(user?.xp||0, c.diff)) onNav(`sim-${c.id}`);
                        }}
                        disabled={!canAccessDifficulty(user?.xp||0, c.diff)}
                        style={{marginTop:8,background:"transparent",border:`1px solid ${T.blue}66`,color:T.blue,fontFamily:T.mono,fontSize:9,padding:"5px 9px",cursor:canAccessDifficulty(user?.xp||0, c.diff)?"pointer":"not-allowed",letterSpacing:1.2,opacity:canAccessDifficulty(user?.xp||0, c.diff)?1:0.45}}
                      >
                        OPEN LIVE SIM
                      </button>
                    )}
                    {!canAccessDifficulty(user?.xp||0, c.diff)&&(
                      <div style={{fontFamily:T.mono,fontSize:8,color:T.red,marginTop:5,letterSpacing:1}}>
                        LOCKED · Complete more cases to unlock
                      </div>
                    )}
                  </div>
                  <div style={{textAlign:"right",flexShrink:0}}>
                    <div style={{fontFamily:T.mono,fontSize:9,color:T.dim}}>avg score</div>
                    <div style={{fontFamily:T.mono,fontSize:15,color:T.gold,fontWeight:700}}>{c.avgScore}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div> {/* closes flex:1 left panel (line 2445) */}

        <div style={{width:isMobile?"100%":276,borderLeft:isMobile?"none":`2px solid ${T.border}`,borderTop:isMobile?`2px solid ${T.border}`:"none",overflowY:"auto",padding:isMobile?12:18,display:"flex",flexDirection:"column",gap:14,flexShrink:0}}>
          <LeaderboardPanel leaderboard={leaderboard} currentUserId={user?.id} loading={leaderboardLoading}/>
          <FeedPanel feed={feed}/>
        </div>
      </div>
    </div>
      <div style={{width:isMobile?"100%":276,borderLeft:isMobile?"none":`2px solid ${T.border}`,borderTop:isMobile?`2px solid ${T.border}`:"none",overflowY:"auto",padding:isMobile?12:18,display:"flex",flexDirection:"column",gap:14,flexShrink:0}}>
        <LeaderboardPanel leaderboard={leaderboard} currentUserId={user?.id} loading={leaderboardLoading}/>
        <FeedPanel feed={feed}/>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   CASE BROWSER
═══════════════════════════════════════════════════════════════════ */
function CaseBrowser({onNav,onBack,caseList,user,leaderboard,leaderboardLoading,feed}){
  const [filter,setFilter]=useState("all");
  const [diffFilter,setDiffFilter]=useState("all");
  const [hov,setHov]=useState(null);
  const [isMobile,setIsMobile]=useState(()=>{
    if(typeof window==="undefined") return false;
    return window.innerWidth<=768;
  });
  useEffect(()=>{
    if(typeof window==="undefined") return;
    const onResize=()=>setIsMobile(window.innerWidth<=768);
    onResize();
    window.addEventListener("resize",onResize);
    return ()=>window.removeEventListener("resize",onResize);
  },[]);
  const list = caseList||CASE_LIST_FALLBACK;
  const filtered=list.filter(c=>(filter==="all"||c.type===filter) && (diffFilter==="all"||c.diff===diffFilter));
  return(
    <div style={{minHeight:"100vh",background:T.bg,display:"flex",flexDirection:"column"}}>
      <TopBar label="CASE SIMULATION" sub="SELECT CASE" onBack={onBack}/>
      <div style={{flex:1,display:"flex",flexDirection:isMobile?"column":"row",overflow:isMobile?"visible":"hidden"}}>
        <div style={{flex:1,overflowY:isMobile?"visible":"auto",padding:isMobile?"16px 12px":"32px 28px"}}>
          <div style={{fontFamily:T.mono,fontSize:8,color:T.muted,letterSpacing:3,marginBottom:14}}>CHOOSE FORMAT</div>
          <div style={{display:"flex",gap:12,marginBottom:32,flexWrap:"wrap"}}>
            {[
              {id:"scenario",icon:"◉",color:T.gold,title:"Business Scenario",sub:"Strategic Judgement · Advisory",desc:"Narrative brief with key data. Analyse situation, make recommendations, defend logic. Some cases include live branching simulations."},
              {id:"financial",icon:"▦",color:T.blue,title:"Financial Statement",sub:"Technical Precision · IFRS",desc:"Actual financials — P&L, Balance Sheet, Cash Flow, Ratio Analysis. Calculate ratios, identify anomalies, recommend capital actions."}
            ].map(m=>(
              <div key={m.id} onClick={()=>setFilter(m.id)} onMouseEnter={()=>setHov(m.id)} onMouseLeave={()=>setHov(null)} style={{flex:1,minWidth:isMobile?"100%":220,background:filter===m.id?`${m.color}0a`:T.surf,border:`2px solid ${filter===m.id||hov===m.id?m.color:T.border}`,padding:"20px 18px",cursor:"pointer",transition:"all .2s"}}>
                <div style={{fontSize:22,color:m.color,marginBottom:10}}>{m.icon}</div>
                <div style={{fontFamily:T.serif,fontSize:17,color:T.txt,marginBottom:4,fontWeight:700}}>{m.title}</div>
                <div style={{fontFamily:T.mono,fontSize:8,color:m.color,letterSpacing:2,marginBottom:8}}>{m.sub}</div>
                <p style={{fontFamily:T.sans,fontSize:12,color:"#666",lineHeight:1.65}}>{m.desc}</p>
              </div>
            ))}
          </div>
          <div style={{fontFamily:T.mono,fontSize:8,color:T.muted,letterSpacing:3,marginBottom:12}}>
            {filter==="all" ? "ALL CASES" : filter==="scenario" ? "BUSINESS SCENARIOS" : "FINANCIAL STATEMENTS"}
            <span style={{color:T.dim,marginLeft:8}}>({filtered.length} available)</span>
          </div>
          <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap"}}>
            {["all","SEED","GROWTH","APEX"].map(id=>{
              const active = diffFilter===id;
              const color = id==="all" ? T.dim : DC[id];
              return(
                <button
                  key={id}
                  onClick={()=>setDiffFilter(id)}
                  style={{
                    background:active?`${color}1a`:"transparent",
                    border:`1px solid ${active?color:T.border}`,
                    color:active?(id==="all"?"#bbb":color):T.dim,
                    fontFamily:T.mono,
                    fontSize:9,
                    padding:"6px 10px",
                    letterSpacing:1.2,
                    cursor:"pointer"
                  }}
                >
                  {id==="all"?"ALL DIFFICULTY":id}
                </button>
              );
            })}
          </div>
          <div style={{fontFamily:T.mono,fontSize:8,color:T.dim,letterSpacing:1,marginBottom:12}}>
            Current Rank: <span style={{color:T.gold,fontWeight:700}}>{xpToRank(user?.xp||0)}</span> ·
            Complete more cases to progress
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {filtered.map(c=>(
              <div key={c.id}
                onClick={()=>{
                  if(canAccessDifficulty(user?.xp||0, c.diff)) onNav(`play-${c.id}`);
                }}
                style={{background:T.surf,border:`1px solid ${T.border}`,padding:"16px 18px",cursor:canAccessDifficulty(user?.xp||0, c.diff)?"pointer":"not-allowed",display:"flex",gap:16,alignItems:"flex-start",transition:"all .15s",opacity:canAccessDifficulty(user?.xp||0, c.diff)?1:0.58}}
                onMouseEnter={e=>{e.currentTarget.style.borderColor=DC[c.diff]+"55";e.currentTarget.style.background="#0e0e12";}}
                onMouseLeave={e=>{e.currentTarget.style.borderColor=T.border;e.currentTarget.style.background=T.surf;}}>
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
                  {!canAccessDifficulty(user?.xp||0, c.diff)&&(
                    <div style={{fontFamily:T.mono,fontSize:8,color:T.red,marginTop:7,letterSpacing:1}}>
                      LOCKED · Complete more cases to unlock
                    </div>
                  )}
                  {c.hasSim&&(
                    <button
                      onClick={(e)=>{
                        e.stopPropagation();
                        if(canAccessDifficulty(user?.xp||0, c.diff)) onNav(`sim-${c.id}`);
                      }}
                      disabled={!canAccessDifficulty(user?.xp||0, c.diff)}
                      style={{marginTop:10,background:"transparent",border:`1px solid ${T.blue}66`,color:T.blue,fontFamily:T.mono,fontSize:9,padding:"6px 10px",cursor:canAccessDifficulty(user?.xp||0, c.diff)?"pointer":"not-allowed",letterSpacing:1.5,opacity:canAccessDifficulty(user?.xp||0, c.diff)?1:0.45}}
                    >
                      OPEN LIVE SIM
                    </button>
                  )}
                </div>
                <div style={{textAlign:"right",flexShrink:0}}>
                  <div style={{fontFamily:T.mono,fontSize:9,color:T.dim}}>avg score</div>
                  <div style={{fontFamily:T.mono,fontSize:15,color:T.gold,fontWeight:700}}>{c.avgScore}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div style={{width:isMobile?"100%":272,borderLeft:isMobile?"none":`2px solid ${T.border}`,borderTop:isMobile?`2px solid ${T.border}`:"none",overflowY:"auto",padding:isMobile?12:16,display:"flex",flexDirection:"column",gap:12,flexShrink:0}}>
          <LeaderboardPanel leaderboard={leaderboard} currentUserId={user?.id} loading={leaderboardLoading}/>
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
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {caseData.ratios.items.map((r,i)=>(
              <div key={i} style={{background:T.surf,border:`1px solid ${HC[r.severity]||T.border}22`,padding:"13px 16px",display:"flex",gap:16,alignItems:"flex-start"}}>
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

  /* sim path nodes */
  const simPath = isSimResult&&simResult?.log ? simResult.log : [];

  /* Build sim story purely from simResult prop — no external scope references */
  const simState   = simResult?.state || {};
  const simScore   = simResult?.keyInsights?.[0]?.score ?? 0;
  const simEnding  = simResult?.keyInsights?.[0]?.ending ?? displayGrade;
  const finalSales = simState.monthly_sales || simResult?.keyInsights?.[0]?.finalSales || 0;
  const initMargin = 10; // FreshMart starts at 10% margin
  const finalMarginPct = Math.round((simState.profit_margin||0.1)*100);
  const monthsPlayed = simResult?.log?.length
    ? (simResult.log[simResult.log.length-1]?.month || simResult.month || 6)
    : (simResult?.month || 6);
  const decisionsCount = simResult?.log?.length || 0;
  const pathSummary = simResult?.keyInsights?.[0]?.pathText || simPath.slice(0,3).map(e=>e.action||e.label||"").join(" → ");

  function fmtSales(n){ return n>=1e6?`PKR ${(n/1e6).toFixed(1)}M`:n>=1e3?`PKR ${(n/1e3).toFixed(0)}K`:`PKR ${Math.round(n)}`; }

  const storyHeadline = isSimResult
    ? (simEnding==="Business Saved"||simEnding==="OPTIMAL"
        ? `Turned a cash-burning grocery store into a ${fmtSales(finalSales)}/month business in ${monthsPlayed} months.`
        : simEnding==="Business Survived"||simEnding==="RECOVERED"
        ? `Stabilised FreshMart from near-collapse to ${fmtSales(finalSales)}/month sales over ${monthsPlayed} months.`
        : `Navigated FreshMart's liquidity crisis across ${monthsPlayed} months — ${decisionsCount} decisions, hard lessons learned.`)
    : null;

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
            {isSimResult&&(
              <>
                <div style={{fontFamily:"'Playfair Display',serif",fontSize:28,color:displayGC,fontWeight:900,lineHeight:1,marginBottom:6}}>{simScore}%</div>
                <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:7,color:"#aaa",letterSpacing:2,marginBottom:4}}>RECOVERY</div>
                <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:8,color:displayGC,fontWeight:800,letterSpacing:1}}>{simEnding}</div>
              </>
            )}
          </div>
          {/* Company info */}
          <div style={{flex:1}}>
            <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:8,color:"#bbb",letterSpacing:2,marginBottom:4}}>{isSimResult?"BRANCHING SIMULATION":"CASE STUDY"}</div>
            <div style={{fontFamily:"'Playfair Display',serif",fontSize:19,color:"#111",fontWeight:700,lineHeight:1.2,marginBottom:8}}>{company}</div>
            {isSimResult && storyHeadline && (
              <p style={{fontFamily:"'IBM Plex Sans',sans-serif",fontSize:12,color:"#333",lineHeight:1.65,margin:"0 0 10px",fontStyle:"italic"}}>{storyHeadline}</p>
            )}
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
                {l:"Recovery Score",v:`${simScore}%`},
                {l:"Decisions",v:decisionsCount},
                {l:"Final Sales",v:fmtSales(finalSales)},
                {l:"Margin",v:`${finalMarginPct}%`},
              ].map(({l,v})=>(
                <div key={l} style={{background:"#eeede8",padding:"4px 10px",borderRadius:2}}>
                  <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:7,color:"#aaa",letterSpacing:1}}>{l.toUpperCase()}</div>
                  <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:11,color:"#222",fontWeight:700}}>{v}</div>
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
          {(keyInsightLines||[]).slice(0,isSimResult?5:4).map((ins,i)=>{
            const text = typeof ins==="string" ? ins : String(ins);
            return(
              <div key={i} style={{display:"flex",gap:12,alignItems:"flex-start"}}>
                <div style={{width:20,height:20,background:T.muted,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,borderRadius:2,marginTop:1}}>
                  <span style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:8,fontWeight:700,color:"#000"}}>{i+1}</span>
                </div>
                <div style={{flex:1}}>
                  <div style={{fontFamily:"'IBM Plex Sans',sans-serif",fontSize:11.5,color:"#444",lineHeight:1.65,margin:0,flex:1}}>{text.replace(/…$/,"")}</div>
                </div>
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
                  <div style={{fontFamily:"'IBM Plex Sans',sans-serif",fontSize:11.5,color:"#333",lineHeight:1.5}}>{e.action||e.label}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── TRANSFORMATION STORY (Sim only) ── */}
      {isSimResult&&(
        <div style={{padding:"16px 24px",background:"#fff",borderBottom:"1px solid #eeeee8"}}>
          <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:7,color:"#bbb",letterSpacing:2,marginBottom:12}}>THE TRANSFORMATION</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:14}}>
            {[
              { label:"Starting Margin", value:`${initMargin}%`, sub:"PKR 1M sales", color:"#dc2626" },
              { label:"Final Sales", value:fmtSales(finalSales), sub:`${finalMarginPct}% margin`, color:displayGC },
              { label:"Decisions Made", value:decisionsCount, sub:`over ${monthsPlayed} months`, color:"#2563eb" },
            ].map(({label,value,sub,color})=>(
              <div key={label} style={{background:"#f9f8f5",padding:"10px 12px",borderRadius:3,borderLeft:`3px solid ${color}`}}>
                <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:7,color:"#aaa",letterSpacing:1,marginBottom:3}}>{label.toUpperCase()}</div>
                <div style={{fontFamily:"'Playfair Display',serif",fontSize:15,color:"#111",fontWeight:700}}>{value}</div>
                <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:7,color:"#999"}}>{sub}</div>
              </div>
            ))}
          </div>
          {pathSummary&&(
            <div style={{background:"#f4f3ee",padding:"10px 14px",borderRadius:3,borderLeft:"3px solid #d4af37"}}>
              <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:7,color:"#bbb",letterSpacing:1,marginBottom:4}}>STRATEGIC PATH</div>
              <div style={{fontFamily:"'IBM Plex Sans',sans-serif",fontSize:11,color:"#444",lineHeight:1.6}}>{pathSummary}</div>
            </div>
          )}
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
  const cardRef = useRef(null);

  const isSimResult  = !!simResult;
  const company      = simResult?.caseCompany || caseData?.company || "";
  const diff         = simResult?.caseDiff    || caseData?.difficulty || "SEED";
  const ctype        = simResult?.caseType    || caseData?.type || "scenario";
  const caseId       = simResult?.caseId || caseData?.id || "";

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
  const financialDecisionImpacts = (caseData?.type==="financial" ? (caseData?.questions||[])
    .map((q,i)=>{
      const ans = answers?.[q.id];
      const opt = q.options?.find(o=>o.id===ans);
      const pts = opt?.score||0;
      if(pts>=100) return null;
      const impactText = q.wrongMoves?.[ans] || q.insight || "This choice weakens financial decision quality for this case.";
      const effectSource = `${q.text} ${impactText}`.toLowerCase();
      const tags = [];
      if(/profit|margin|revenue|expense|cogs|income|earnings|depreciation|nim|cost/.test(effectSource)) tags.push("P&L");
      if(/asset|liability|equity|inventory|debt|capital|car|working capital|balance sheet/.test(effectSource)) tags.push("Balance Sheet");
      if(/cash|liquidity|cash flow|burn|cycle|operating cash|wc/.test(effectSource)) tags.push("Cash Flow");
      if(!tags.length) tags.push("P&L");
      return{
        qNo:i+1,
        pts,
        tags,
        impactText,
        severity: pts<50 ? "high" : pts<75 ? "medium" : "low",
      };
    })
    .filter(Boolean) : []);
  const financialImpactSummary = financialDecisionImpacts.reduce((acc, row)=>{
    row.tags.forEach(tag=>{ acc[tag] = (acc[tag]||0) + 1; });
    return acc;
  }, {});
  const sortedFinancialImpactSummary = Object.entries(financialImpactSummary)
    .sort((a,b)=>b[1]-a[1]);

  /* insights list */
  const keyInsightLines = isSimResult
    ? (simResult.keyInsights||[])
    : (caseData?.questions?.map(q=>q.insight)||[]);

  const synopsis  = CASE_SYNOPSIS_SHORT[caseId] || (caseData?.synopsis ? `${caseData.synopsis.slice(0,200)}…` : "");
  const concepts  = CASE_CONCEPTS[caseId] || [];

  // Download LinkedIn card as PNG
  function downloadLinkedInCard() {
    const cardElement = cardRef.current;
    if (!cardElement) return;
    
    // Add delay for Google Fonts to load
    setTimeout(() => {
      html2canvas(cardElement, {
        backgroundColor: '#ffffff',
        scale: 2,
        useCORS: true,
        allowTaint: false,
        foreignObjectRendering: false,
        logging: false,
        width: cardElement.offsetWidth,
        height: cardElement.offsetHeight
      }).then(canvas => {
        const dataUrl = canvas.toDataURL('image/png', 0.95);
        const a = document.createElement('a');
        a.href = dataUrl;
        a.download = `ca-arena-${company.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-linkedin-card.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }).catch(error => {
        console.error('Error generating LinkedIn card:', error);
        // Fallback: try with allowTaint: true if the first attempt fails
        html2canvas(cardElement, {
          backgroundColor: '#ffffff',
          scale: 2,
          useCORS: false,
          allowTaint: true,
          foreignObjectRendering: false,
          logging: false,
          width: cardElement.offsetWidth,
          height: cardElement.offsetHeight
        }).then(canvas => {
          const dataUrl = canvas.toDataURL('image/png', 0.95);
          const a = document.createElement('a');
          a.href = dataUrl;
          a.download = `ca-arena-${company.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-linkedin-card.png`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        }).catch(fallbackError => {
          console.error('Fallback also failed:', fallbackError);
          alert('Unable to generate LinkedIn card. Please try again or contact support.');
        });
      });
    }, 500); // 500ms delay for fonts to load
  }

  async function downloadCardPng(){
    const node = cardRef.current;
    if(!node) {
      alert("Card element not found. Please try refreshing the page.");
      return false;
    }
    
    try {
      // Check if required APIs are available
      if (!window.XMLSerializer || !document.createElement('canvas').getContext) {
        throw new Error("Required browser APIs not available");
      }
      
      const rect = node.getBoundingClientRect();
      const width = Math.max(900, Math.ceil(rect.width));
      const height = Math.max(1200, Math.ceil(rect.height));
      
      // Create SVG with proper namespace and styling
      const cloned = node.cloneNode(true);
      
      // Ensure all styles are inline
      const computedStyles = window.getComputedStyle(node);
      Array.from(computedStyles).forEach(prop => {
        cloned.style[prop] = computedStyles[prop];
      });
      
      // Recursively inline styles for all child elements
      function inlineStyles(element) {
        const children = element.children;
        for (let child of children) {
          const styles = window.getComputedStyle(child);
          Array.from(styles).forEach(prop => {
            child.style[prop] = styles[prop];
          });
          inlineStyles(child);
        }
      }
      inlineStyles(cloned);
      
      const serialized = new XMLSerializer().serializeToString(cloned);
      
      // Create SVG with proper dimensions and background
      const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
          <rect width="100%" height="100%" fill="#ffffff"/>
          <foreignObject width="100%" height="100%">
            <div xmlns="http://www.w3.org/1999/xhtml" style="font-family: system-ui, -apple-system, sans-serif;">
              ${serialized}
            </div>
          </foreignObject>
        </svg>
      `;
      
      const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      
      // Load the SVG as an image
      const img = new Image();
      img.crossOrigin = "anonymous";
      
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("Image loading timeout"));
        }, 10000);
        
        img.onload = () => {
          clearTimeout(timeout);
          resolve();
        };
        
        img.onerror = (error) => {
          clearTimeout(timeout);
          reject(new Error("Failed to load SVG as image: " + error));
        };
        
        img.src = url;
      });
      
      // Create canvas and draw
      const canvas = document.createElement("canvas");
      const scale = 2;
      canvas.width = width * scale;
      canvas.height = height * scale;
      
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        throw new Error("Could not get canvas context");
      }
      
      ctx.scale(scale, scale);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, width, height);
      
      // Draw the image
      ctx.drawImage(img, 0, 0, width, height);
      
      // Clean up
      URL.revokeObjectURL(url);
      
      // Download the image
      const dataUrl = canvas.toDataURL("image/png", 0.95);
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `ca-arena-${(company || "case").toLowerCase().replace(/[^a-z0-9]+/g, "-")}-linkedin-card.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      return true;
      
    } catch (error) {
      console.error("Card download failed:", error);
      
      // Provide specific error messages
      let errorMessage = "Could not generate PNG. ";
      
      if (error.message.includes("timeout")) {
        errorMessage += "The generation took too long. Try again with a simpler card.";
      } else if (error.message.includes("canvas")) {
        errorMessage += "Your browser doesn't support canvas operations.";
      } else if (error.message.includes("SVG") || error.message.includes("image")) {
        errorMessage += "SVG to image conversion failed. Try using a different browser.";
      } else {
        errorMessage += "Please try taking a screenshot instead.";
      }
      
      alert(errorMessage + "\n\nTip: You can take a screenshot of the card for sharing on LinkedIn.");
      return false;
    }
  }

  /* ── LinkedIn caption (rich, structured) ── */
  const optimalCount = topAnswers.filter(a=>a.pts===100).length;

  // Build sim-specific story caption
  const simCaptionLines = isSimResult ? [
    `🏪 I just completed the FreshMart Business Turnaround Simulation on CA Arena.`,
    ``,
    `The scenario: A general store burning PKR 900K/month with only 10% margin, 400+ dead stock SKUs, and a 30M investment at risk.`,
    ``,
    `My outcome: ${simEnding} — ${fmtSales(finalSales)}/month in final sales after ${monthsPlayed} months.`,
    ``,
    `Key decisions I made:`,
    ...(simPath.slice(0,5).map((e,i)=>`   ${i+1}. [Month ${e.month}] ${e.action||e.label||""}`)),
    ``,
    `What I learned:`,
    ...(simResult?.keyInsights?.[0] ? [
      `   • Recovery Score: ${simScore}%`,
      `   • Final Profit Margin: ${finalMarginPct}%`,
      pathSummary ? `   • Strategic path: ${pathSummary}` : null,
    ].filter(Boolean) : []),
    ``,
    `This is the kind of business judgment that textbooks don't teach — and CA Arena makes you practice it under pressure.`,
    ``,
    `#CharteredAccountancy #CAArenaPK #BusinessTurnaround #FinancialAnalysis #CAStudents #ICAP #ManagementAccounting`,
  ].filter(x=>x!==null).join("\n") : null;

  const captionParts = isSimResult ? simCaptionLines : [
    `📋 CA Arena — Case Study Report`,
    ``,
    `Company: ${company}`,
    `Format: ${ctype==="financial"?"Financial Statement Analysis":"Business Scenario"}`,
    `Difficulty: ${diff}`,
    ``,
    `📌 What this case covered:`,
    synopsis,
    ``,
    `📊 Result: ${displayPct}% · ${displayGrade} · ${optimalCount}/${topAnswers.length} optimal decisions`,
    ``,
    `🧠 CA concepts examined:`,
    concepts.slice(0,5).map((c,i)=>`   ${i+1}. ${c}`).join("\n"),
    ``,
    `💡 Key analytical takeaways:`,
    keyInsightLines.slice(0,3).map((ins,i)=>`   ${i+1}. ${String(ins).replace(/…$/,"")}`).join("\n"),
    ``,
    topAnswers.length>0
      ? [`📝 Decision breakdown:`,
         ...topAnswers.map((a,i)=>`   Q${i+1}: ${a.verdict} (${a.pts}/100)`),
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

            
            <button onClick={()=>setTab("linkedin")} style={{width:"100%",background:T.gold,border:"none",color:"#000",fontFamily:T.mono,fontSize:11,fontWeight:800,padding:"12px",cursor:"pointer",letterSpacing:2}}>GENERATE LINKEDIN CARD →</button>
            <button onClick={downloadLinkedInCard} style={{width:"100%",background:T.gold,border:"none",color:"#000",fontFamily:T.mono,fontSize:11,fontWeight:800,padding:"12px",cursor:"pointer",letterSpacing:2,marginTop:8}}>DOWNLOAD PNG →</button>
          </div>
        )}

        {/* ── BREAKDOWN TAB ── */}
        {tab==="breakdown"&&!isSimResult&&(
          <div style={{animation:"fadeUp .3s both"}}>
            {caseData?.type==="financial"&&financialDecisionImpacts.length>0&&(
              <div style={{background:T.surf,border:`1px solid ${T.border}`,padding:"14px 16px",marginBottom:14}}>
                <div style={{fontFamily:T.mono,fontSize:8,color:T.muted,letterSpacing:3,marginBottom:10}}>FINANCIAL STATEMENT IMPACT OF MISSED DECISIONS</div>
                {sortedFinancialImpactSummary.length>0&&(
                  <div style={{background:"#0f0f12",border:`1px solid ${T.muted}`,padding:"10px 12px",marginBottom:9}}>
                    <div style={{fontFamily:T.mono,fontSize:8,color:T.dim,letterSpacing:1.5,marginBottom:5}}>MOST AFFECTED AREAS</div>
                    <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                      {sortedFinancialImpactSummary.map(([tag,count],idx)=>{
                        const c = tag==="P&L" ? T.gold : tag==="Balance Sheet" ? T.blue : tag==="Cash Flow" ? T.green : T.dim;
                        return(
                          <span key={tag} style={{fontFamily:T.mono,fontSize:9,color:c,border:`1px solid ${c}55`,background:`${c}14`,padding:"3px 8px",letterSpacing:1}}>
                            #{idx+1} {tag} ({count})
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}
                <div style={{display:"flex",flexDirection:"column",gap:8}}>
                  {financialDecisionImpacts.map((r,idx)=>{
                    const c = r.severity==="high"?T.red:r.severity==="medium"?T.gold:T.blue;
                    return(
                      <div key={idx} style={{background:"#0f0f12",border:`1px solid ${c}33`,padding:"10px 12px",borderLeft:`3px solid ${c}`}}>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8,marginBottom:5,flexWrap:"wrap"}}>
                          <div style={{fontFamily:T.mono,fontSize:9,color:"#bbb"}}>Q{r.qNo} · Impacted: {r.tags.join(" + ")}</div>
                          <div style={{fontFamily:T.mono,fontSize:8,color:c,letterSpacing:1.5,fontWeight:700}}>SEVERITY: {r.severity.toUpperCase()}</div>
                        </div>
                        <div style={{fontFamily:T.sans,fontSize:11.5,color:"#8d8d99",lineHeight:1.65}}>{r.impactText}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
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
          <div style={{animation:"fadeUp .3s both"}}>
            <div style={{fontFamily:T.mono,fontSize:10,color:T.gold,letterSpacing:2,marginBottom:16}}>DECISION PATH TAKEN</div>
            {simResult.log && simResult.log.length > 0 ? (
              <div style={{display:"flex",flexDirection:"column",gap:12}}>
                {simResult.log.map((decision, i) => (
                  <div key={i} style={{background:T.surf,border:`1px solid ${T.border}`,padding:"16px 18px",display:"flex",gap:12,alignItems:"flex-start"}}>
                    <div style={{width:24,height:24,background:T.gold,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,borderRadius:"50%"}}>
                      <span style={{fontFamily:T.mono,fontSize:10,color:"#000",fontWeight:700}}>{i+1}</span>
                    </div>
                    <div style={{flex:1}}>
                      <div style={{fontFamily:T.sans,fontSize:13,color:T.txt,fontWeight:600,marginBottom:4,lineHeight:1.4}}>{decision.action}</div>
                      <div style={{fontFamily:T.mono,fontSize:9,color:T.muted,letterSpacing:1}}>MONTH {decision.month || "?"}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{fontFamily:T.sans,fontSize:13,color:T.dim,padding:"16px 0",lineHeight:1.7}}>
                No decision path recorded for this simulation.
              </div>
            )}
            
            {simResult.state && (
              <div style={{marginTop:32}}>
                <div style={{fontFamily:T.mono,fontSize:10,color:T.gold,letterSpacing:2,marginBottom:16}}>FINAL BUSINESS STATE</div>
                <div style={{background:T.surf,border:`1px solid ${T.border}`,padding:"16px 18px"}}>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:16}}>
                    <div>
                      <div style={{fontFamily:T.mono,fontSize:8,color:T.muted,letterSpacing:1,marginBottom:4}}>MONTHLY SALES</div>
                      <div style={{fontFamily:T.mono,fontSize:14,color:T.txt,fontWeight:700}}>PKR {fmtMoney(simResult.state.monthly_sales || 0)}</div>
                    </div>
                    <div>
                      <div style={{fontFamily:T.mono,fontSize:8,color:T.muted,letterSpacing:1,marginBottom:4}}>CASH ON HAND</div>
                      <div style={{fontFamily:T.mono,fontSize:14,color:T.txt,fontWeight:700}}>PKR {fmtMoney(simResult.state.cash_on_hand || 0)}</div>
                    </div>
                    <div>
                      <div style={{fontFamily:T.mono,fontSize:8,color:T.muted,letterSpacing:1,marginBottom:4}}>PROFIT MARGIN</div>
                      <div style={{fontFamily:T.mono,fontSize:14,color:T.txt,fontWeight:700}}>{((simResult.state.profit_margin || 0) * 100).toFixed(1)}%</div>
                    </div>
                    <div>
                      <div style={{fontFamily:T.mono,fontSize:8,color:T.muted,letterSpacing:1,marginBottom:4}}>DEAD STOCK UNITS</div>
                      <div style={{fontFamily:T.mono,fontSize:14,color:T.txt,fontWeight:700}}>{simResult.state.dead_stock_units || 0}</div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {simResult.state && (
              <div style={{marginTop:32}}>
                <div style={{fontFamily:T.mono,fontSize:10,color:T.gold,letterSpacing:2,marginBottom:16}}>GROWTH CONTRIBUTION BREAKDOWN</div>
                <div style={{background:T.surf,border:`1px solid ${T.border}`,padding:"16px 18px"}}>
                  <div style={{fontFamily:T.sans,fontSize:12,color:T.dim,marginBottom:16,lineHeight:1.5}}>
                    Your final sales result was built through compound growth. Each decision contributed to multipliers that compounded over time:
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(250px,1fr))",gap:16}}>
                    <div>
                      <div style={{fontFamily:T.mono,fontSize:8,color:T.muted,letterSpacing:1,marginBottom:4}}>BASE SALES</div>
                      <div style={{fontFamily:T.mono,fontSize:14,color:T.txt,fontWeight:700}}>PKR {fmtMoney(simResult.state.growth_base || 280000)}</div>
                    </div>
                    <div>
                      <div style={{fontFamily:T.mono,fontSize:8,color:T.muted,letterSpacing:1,marginBottom:4}}>FOOTFALL MULTIPLIER</div>
                      <div style={{fontFamily:T.mono,fontSize:14,color:T.txt,fontWeight:700}}>{(simResult.state.footfall_multiplier || 1.0).toFixed(2)}x</div>
                    </div>
                    <div>
                      <div style={{fontFamily:T.mono,fontSize:8,color:T.muted,letterSpacing:1,marginBottom:4}}>CONVERSION MULTIPLIER</div>
                      <div style={{fontFamily:T.mono,fontSize:14,color:T.txt,fontWeight:700}}>{(simResult.state.conversion_multiplier || 1.0).toFixed(2)}x</div>
                    </div>
                    <div>
                      <div style={{fontFamily:T.mono,fontSize:8,color:T.muted,letterSpacing:1,marginBottom:4}}>MOMENTUM MULTIPLIER</div>
                      <div style={{fontFamily:T.mono,fontSize:14,color:T.txt,fontWeight:700}}>{(simResult.state.momentum_multiplier || 1.0).toFixed(2)}x</div>
                    </div>
                  </div>
                  
                  <div style={{marginTop:20,paddingTop:20,borderTop:`1px solid ${T.border}`}}>
                    <div style={{fontFamily:T.mono,fontSize:9,color:T.gold,letterSpacing:1,marginBottom:12}}>MONTHLY DECISION IMPACT</div>
                    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:12}}>
                      <div>
                        <div style={{fontFamily:T.mono,fontSize:8,color:T.muted,letterSpacing:1,marginBottom:4}}>MONTH 1 IMPACT</div>
                        <div style={{fontFamily:T.mono,fontSize:12,color:simResult.state.month1_decision_impact > 0 ? T.green : T.red,fontWeight:700}}>
                          {simResult.state.month1_decision_impact > 0 ? "+" : ""}PKR {fmtMoney(simResult.state.month1_decision_impact || 0)}
                        </div>
                      </div>
                      <div>
                        <div style={{fontFamily:T.mono,fontSize:8,color:T.muted,letterSpacing:1,marginBottom:4}}>MONTH 2 IMPACT</div>
                        <div style={{fontFamily:T.mono,fontSize:12,color:simResult.state.month2_decision_impact > 0 ? T.green : T.red,fontWeight:700}}>
                          {simResult.state.month2_decision_impact > 0 ? "+" : ""}PKR {fmtMoney(simResult.state.month2_decision_impact || 0)}
                        </div>
                      </div>
                      <div>
                        <div style={{fontFamily:T.mono,fontSize:8,color:T.muted,letterSpacing:1,marginBottom:4}}>MONTH 3 IMPACT</div>
                        <div style={{fontFamily:T.mono,fontSize:12,color:simResult.state.month3_decision_impact > 0 ? T.green : T.red,fontWeight:700}}>
                          {simResult.state.month3_decision_impact > 0 ? "+" : ""}PKR {fmtMoney(simResult.state.month3_decision_impact || 0)}
                        </div>
                      </div>
                    </div>
                    <div style={{fontFamily:T.sans,fontSize:11,color:T.dim,marginTop:12,lineHeight:1.4}}>
                      <strong>Compound Formula:</strong> Base × Footfall × Conversion × Momentum = Final Sales<br/>
                      <strong>Your Result:</strong> PKR {fmtMoney(simResult.state.growth_base || 280000)} × {(simResult.state.footfall_multiplier || 1.0).toFixed(2)} × {(simResult.state.conversion_multiplier || 1.0).toFixed(2)} × {(simResult.state.momentum_multiplier || 1.0).toFixed(2)} = PKR {fmtMoney(simResult.state.monthly_sales || 0)}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── LINKEDIN TAB ── */}
        {tab==="linkedin"&&(
          <div style={{animation:"fadeUp .3s both"}}>
            <div style={{fontFamily:T.mono,fontSize:8,color:T.muted,letterSpacing:3,marginBottom:14}}>SHARE CARD PREVIEW</div>

            <div ref={cardRef}>
              <LinkedInCardPreview
                company={company} diff={diff} ctype={ctype}
                displayPct={displayPct} displayGrade={displayGrade} displayGC={displayGC}
                isSimResult={isSimResult} simResult={simResult}
                caseData={caseData} score={score} maxScore={maxScore}
                topAnswers={topAnswers} keyInsightLines={keyInsightLines}
                synopsis={synopsis} concepts={concepts}
              />
            </div>

            {/* Caption block */}
            <div style={{marginTop:22}}>
              <div style={{fontFamily:T.mono,fontSize:8,color:T.muted,letterSpacing:3,marginBottom:10}}>POST CAPTION — COPY & PASTE TO LINKEDIN</div>
              <div style={{background:T.surf,border:`1px solid ${T.border}`,padding:"14px 16px",marginBottom:14,maxHeight:320,overflowY:"auto"}}>
                <pre style={{fontFamily:T.sans,fontSize:12.5,color:"#777",lineHeight:1.8,margin:0,whiteSpace:"pre-wrap"}}>{captionParts}</pre>
              </div>
              <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
                <button onClick={()=>{
                  try{navigator.clipboard.writeText(captionParts);}catch(e){}
                  setCopied(true);setTimeout(()=>setCopied(false),2400);
                }} style={{flex:1,minWidth:180,background:copied?T.green:T.surf,border:`2px solid ${copied?T.green:T.border}`,color:copied?"#000":T.txt,fontFamily:T.mono,fontSize:11,fontWeight:700,padding:"12px",cursor:"pointer",letterSpacing:2,transition:"all .25s"}}>{copied?"✓ COPIED TO CLIPBOARD":"COPY CAPTION"}</button>
                <button onClick={downloadCardPng} style={{flex:1,minWidth:180,background:T.surf,border:`2px solid ${T.border}`,color:T.txt,fontFamily:T.mono,fontSize:11,fontWeight:700,padding:"12px",cursor:"pointer",letterSpacing:2}}>DOWNLOAD CARD PNG</button>
                <button
                  onClick={async ()=>{
                    await downloadCardPng();
                    try{ navigator.clipboard.writeText(captionParts); }catch(e){}
                    setCopied(true);setTimeout(()=>setCopied(false),2400);
                    const linkedInUrl = "https://www.linkedin.com/feed/?shareActive=true";
                    const win = window.open(linkedInUrl, "_blank", "noopener,noreferrer");
                    if(!win){
                      window.location.href = linkedInUrl;
                    }
                  }}
                  style={{flex:1,minWidth:180,background:"#0077b5",border:"none",color:"#fff",fontFamily:T.mono,fontSize:11,fontWeight:800,padding:"12px",cursor:"pointer",letterSpacing:2}}
                >
                  DOWNLOAD + SHARE ON LINKEDIN →
                </button>
              </div>
            </div>
          </div>
        )}

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
          commission: 0,
        },
        authType: "signup",
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
        user: {
          ...profile,
          commission: profile.commission || 0,
        },
        authType: "signin",
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
   AUTH NOTIFICATION — vintage golden styled notifications
═══════════════════════════════════════════════════════════════════ */
function AuthNotification({ type, onDone, user }){
  useEffect(() => {
    const t = setTimeout(onDone, 10000); // 10 seconds auto-dismiss
    return () => clearTimeout(t);
  }, [onDone]);

  const isSignUp = type === "signup";
  const userXp = user?.xp || 0;
  const userLevel = xpToLevel(userXp);
  const userRank = xpToRank(userXp);
  
  const handleBackdropClick = (e) => {
    // Only dismiss if clicking the backdrop, not the notification itself
    if (e.target === e.currentTarget) {
      onDone();
    }
  };
  
  return (
    <div 
      style={{
        position: "fixed", 
        top: 0, 
        left: 0, 
        right: 0,
        bottom: 0,
        background: "rgba(0, 0, 0, 0.4)",
        zIndex: 1000, 
        animation: "fadeIn .3s both",
        display: "flex",
        alignItems: "center",
        justifyContent: "center"
      }}
      onClick={handleBackdropClick}
    >
      <div style={{
        background: "linear-gradient(135deg, #D4AF37 0%, #B8860B 100%)", 
        border: "3px solid #FFD700", 
        padding: "32px 40px", 
        animation: "fadeUp .5s both",
        minWidth: 320,
        maxWidth: 400,
        borderRadius: "8px",
        boxShadow: "0 8px 32px rgba(212, 175, 55, 0.3)",
        textAlign: "center",
        position: "relative"
      }}>
        {/* Vintage decorative elements */}
        <div style={{
          position: "absolute",
          top: "8px",
          left: "8px",
          right: "8px",
          bottom: "8px",
          border: "1px solid rgba(255, 255, 255, 0.3)",
          borderRadius: "4px",
          pointerEvents: "none"
        }} />
        
        {/* Main headline with vintage styling */}
        <div style={{
          fontFamily: "'Playfair Display', serif", 
          fontSize: "24px", 
          color: "#FFFFFF", 
          fontWeight: 900, 
          lineHeight: 1.2,
          marginBottom: "12px",
          textShadow: "2px 2px 4px rgba(0, 0, 0, 0.3)",
          letterSpacing: "1px"
        }}>
          {isSignUp ? "Welcome to CA Arena" : "Welcome Back! Mr.CA"}
        </div>
        
        {/* Subtitle */}
        <div style={{
          fontFamily: "'IBM Plex Sans', sans-serif", 
          fontSize: "14px", 
          color: "#FFFFFF", 
          fontWeight: 400,
          opacity: 0.9,
          lineHeight: 1.4,
          marginBottom: "16px",
          textShadow: "1px 1px 2px rgba(0, 0, 0, 0.2)"
        }}>
          {isSignUp ? "You have been registered in CA Arena database" : "Business world awaits your insights"}
        </div>
        
        {/* Vintage decorative separator */}
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          margin: "16px 0"
        }}>
          <div style={{
            flex: 1,
            height: "1px",
            background: "rgba(255, 255, 255, 0.3)",
            marginRight: "12px"
          }} />
          <div style={{
            fontSize: "12px",
            color: "#FFFFFF",
            opacity: 0.7,
            fontFamily: "'IBM Plex Mono', monospace"
          }}>✦</div>
          <div style={{
            flex: 1,
            height: "1px",
            background: "rgba(255, 255, 255, 0.3)",
            marginLeft: "12px"
          }} />
        </div>
        
        {/* User XP and Level Display */}
        <div style={{
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: "12px", 
          color: "#FFFFFF", 
          opacity: 0.9,
          letterSpacing: "1px",
          textTransform: "uppercase",
          marginBottom: "8px"
        }}>
          <div style={{ marginBottom: "4px" }}>
            <span style={{ opacity: 0.7 }}>CURRENT XP:</span> {userXp.toLocaleString()}
          </div>
          <div>
            <span style={{ opacity: 0.7 }}>LEVEL:</span> {userLevel} · <span style={{ color: DC[userRank] }}>{userRank}</span>
          </div>
        </div>
        
        {/* Dismiss hint */}
        <div style={{
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: "9px", 
          color: "#FFFFFF", 
          opacity: 0.5,
          letterSpacing: "1px",
          textTransform: "uppercase"
        }}>
          Click outside to dismiss
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   XP TOAST — shown after completing a case
═══════════════════════════════════════════════════════════════════ */
function XPToast({xp, rank, prevRank, onDone, isRepeat, improvement}){
  useEffect(()=>{ const t=setTimeout(onDone, 4000); return()=>clearTimeout(t); },[]);
  const promoted = rank!==prevRank;
  return(
    <div style={{position:"fixed",bottom:28,right:28,background:T.surf,border:`2px solid ${T.gold}`,padding:"18px 22px",zIndex:500,animation:"fadeUp .3s both",minWidth:240}}>
      <div style={{fontFamily:T.mono,fontSize:8,color:T.gold,letterSpacing:3,marginBottom:6}}>{isRepeat?"▸ REPEAT BONUS":"▸ XP EARNED"}</div>
      <div style={{fontFamily:T.serif,fontSize:28,color:T.gold,fontWeight:900,lineHeight:1}}>+{xp} XP</div>
      {isRepeat&&improvement>0&&<div style={{fontFamily:T.mono,fontSize:9,color:T.green,marginTop:4,letterSpacing:1}}>↑ +{Math.round(improvement)}% improvement bonus</div>}
      {isRepeat&&!improvement&&<div style={{fontFamily:T.mono,fontSize:9,color:T.dim,marginTop:4,letterSpacing:1}}>guaranteed repeat XP</div>}
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
  const [leaderboard,setLeaderboard] = useState(()=>{
    try{
      const cached = JSON.parse(localStorage.getItem("ca_leaderboard")||"[]");
      return Array.isArray(cached) ? cached : [];
    }catch{
      return [];
    }
  });
  const [leaderboardLoading,setLeaderboardLoading] = useState(false);
  const [feed,setFeed]               = useState([]);
  const [caseList,setCaseList]       = useState(CASE_LIST_FALLBACK);
  const [attempts,setAttempts]       = useState([]);

  /* XP toast */
  const [xpToast,setXpToast] = useState(null); // {xp, rank, prevRank}
  
  /* Auth notification */
  const [authNotification,setAuthNotification] = useState(null); // {type: "signup"|"signin"}

  /* ── Restore session on mount + fetch live data ── */
  useEffect(()=>{
    // Validate stored token
    if(token){
      supabase.auth.getUser(token)
        .then(u=>{ if(u.error){ clearSession(); } })
        .catch(()=>clearSession());
    }
    fetchLiveData();
    // Refresh leaderboard every 60s with latest auth context
    const iv = setInterval(()=>fetchLeaderboard({ silent:true }), 60000);
    return ()=>clearInterval(iv);
  },[token]);

  async function fetchLiveData(){
    await Promise.all([fetchLeaderboard(), fetchFeed(), fetchCaseList()]);
  }

  async function fetchUserAttempts(){
    if(!user?.id || !token) return;
    try{
      const data = await supabase.from("user_attempts",{
        select:"case_id,score,max_score,ending_type,completed_at",
        eq:{ user_id:user.id },
        order:"completed_at.desc",
        limit:200,
      }, token);
      if(Array.isArray(data)) setAttempts(data);
    }catch(e){
      console.warn("Attempts fetch failed:", e.message);
    }
  }

  async function fetchLeaderboard({ silent=false } = {}){
    try{
      if(!silent) setLeaderboardLoading(true);
      const data = await supabase.from("profiles",{
        select:"id,username,xp,rank,cases_completed,xp_gained_today,commission",
        order:"xp.desc",
        limit:10,
      }, token||undefined);
      if(Array.isArray(data)){
        const normalized = data.map(p=>({ ...p, rank:xpToRank(p.xp) }));
        setLeaderboard(normalized);
        localStorage.setItem("ca_leaderboard", JSON.stringify(normalized));
      }
    }catch(e){ console.warn("Leaderboard fetch failed:", e.message); }
    finally{
      if(!silent) setLeaderboardLoading(false);
    }
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
  function handleAuth({token:t, user:u, authType}){
    setToken(t); setUser(u);
    localStorage.setItem("ca_token", t);
    localStorage.setItem("ca_user", JSON.stringify(u));
    setShowAuth(false);
    fetchLeaderboard();
    
    // Show auth notification
    if (authType) {
      setAuthNotification({ type: authType });
    }
  }

  useEffect(()=>{
    if(user?.id && token) fetchUserAttempts();
  },[screen, user?.id, token]);

  async function handleSignOut(){
    if(token) await supabase.auth.signOut(token).catch(()=>{});
    clearSession();
  }

  function clearSession(){
    setToken(null); setUser(null);
    localStorage.removeItem("ca_token");
    localStorage.removeItem("ca_user");
  }

  function normalizeAttemptScore(scoreData){
    const maxScore = Math.max(1, Number(scoreData?.maxScore) || 100);
    let score = Number(scoreData?.score);
    if(!Number.isFinite(score)){
      const endingScore = {
        perfect: 100,
        good: 85,
        warn: 60,
        bad: 30,
      };
      score = endingScore[scoreData?.endingType] ?? 0;
    }
    score = Math.max(0, Math.min(score, maxScore));
    return { score, maxScore };
  }

  /* ── XP award for decisions ── */
  async function awardDecisionXP(baseXp, month){
    if(!user||!token) return;
    
    // Month multiplier: earlier decisions matter more
    const monthMultiplier = month <= 2 ? 1.3 : month <= 4 ? 1.0 : 0.8;
    const gained = Math.round(baseXp * monthMultiplier);
    const newXp = (user.xp||0) + gained;
    const prevRank = xpToRank(user.xp||0);
    const newRank = xpToRank(newXp);
    
    const updated = {
      ...user,
      xp:newXp,
      rank:newRank,
      xp_gained_today:(user.xp_gained_today||0)+gained
    };

    // Optimistic update
    setUser(updated);
    localStorage.setItem("ca_user", JSON.stringify(updated));

    // Update Supabase
    await supabase.patch("profiles",
      { xp:newXp, rank:newRank, xp_gained_today:updated.xp_gained_today },
      { id:user.id }, token
    );

    // Show small toast for decision XP
    setXpToast({ xp:gained, rank:newRank, prevRank, isRepeat:false, improvement:0 });
  }

  /* ── XP award — called after any case completion ── */
  async function awardXP(diff, caseId, scoreData){
    if(!user||!token) return;
    const fullReward = XP_REWARD[diff]||50;
    const attempt = normalizeAttemptScore(scoreData);
    const currentPct = (attempt.score/attempt.maxScore)*100;

    try{
      // Check for previous attempts on this case
      const prevAttempts = attempts.filter(a=>a.case_id===caseId);
      const bestPrevScore = prevAttempts.length>0
        ? Math.max(...prevAttempts.map(a=>(Number(a.score)||0)/(Number(a.max_score)||1)*100))
        : 0;
      const isRepeat = prevAttempts.length>0;

      // Score-based multiplier for first attempt
      const xpMultiplier =
        currentPct>=95 ? 1 :
        currentPct>=85 ? 0.85 :
        currentPct>=70 ? 0.7 :
        currentPct>=55 ? 0.55 :
        currentPct>=40 ? 0.4 :
        currentPct>0 ? 0.25 : 0;

      // Base XP from score performance
      let gained = Math.round(fullReward * xpMultiplier);

      // Repeat: guaranteed minimum XP (25% of full reward) + improvement bonus
      if(isRepeat){
        const guaranteedXP = Math.round(fullReward * 0.25); // 25% minimum on repeats
        const improvement = Math.max(0, currentPct - bestPrevScore);
        // Improvement bonus: up to extra 50% of full reward for 100% improvement
        const improvementBonus = Math.round(fullReward * Math.min(0.5, improvement/200));
        gained = Math.max(guaranteedXP, gained) + improvementBonus;
      }

      const completedCount = (user.cases_completed||0)+1;

      // Log attempt (always)
      await supabase.insert("user_attempts",{
        user_id: user.id,
        case_id: caseId,
        score:   attempt.score,
        max_score: attempt.maxScore,
        ending_type: scoreData?.endingType||null,
        completed_at: new Date().toISOString(),
      }, token);

      // Refresh attempts after logging
      fetchUserAttempts();

      // Always award XP (minimum 10 XP even for 0% scores)
      gained = Math.max(10, gained);
      const newXp  = (user.xp||0) + gained;
      const prevRank = xpToRank(user.xp||0);
      const newRank  = xpToRank(newXp);
      const updated  = {
        ...user,
        xp:newXp,
        rank:newRank,
        cases_completed:completedCount,
        xp_gained_today:(user.xp_gained_today||0)+gained
      };
      // Optimistic update
      setUser(updated);
      localStorage.setItem("ca_user", JSON.stringify(updated));
      setXpToast({ xp:gained, rank:newRank, prevRank, isRepeat, improvement: isRepeat ? Math.max(0, currentPct - bestPrevScore) : 0 });
      await supabase.patch("profiles",
        { xp:newXp, rank:newRank, cases_completed:updated.cases_completed, xp_gained_today:updated.xp_gained_today },
        { id:user.id }, token
      );
      
      // Add concepts to Grimoire from case completion
      const concepts = CASE_CONCEPTS[caseId] || [];
      await upsertGrimoireFromCase(supabase, user.id, caseId, caseNameById(caseId), concepts, newXp, token);
      
      const actionText = isRepeat
        ? `repeated ${caseId} (${Math.round(currentPct)}%) — +${gained} XP · ${newRank}${Math.max(0, currentPct - bestPrevScore)>0 ? ' · ↑'+Math.round(Math.max(0, currentPct - bestPrevScore))+'%' : ''}`
        : `completed ${caseId} (${Math.round(currentPct)}%) — +${gained} XP · ${newRank}`;
      await supabase.insert("activity_feed",{
        username: user.username,
        action_text: actionText,
        type: "score",
        created_at: new Date().toISOString(),
        time_ago: "just now",
      }, token).catch(()=>{});
      fetchLeaderboard();
    }catch(e){ console.warn("XP save failed:", e.message); }
  }

  /* ── Navigation ── */
  function nav(s){
    if(s.startsWith("sim-")){
      const id = s.replace("sim-","");
      setActiveCaseId(id);
      setScreen("freshmart-sim");
    } else if(s.startsWith("play-")||s.startsWith("case-")){
      const id = s.replace("play-","").replace("case-","");
      setActiveCaseId(id);
      setScreen("sim");
    } else if(s==="storymode"){
      setScreen("storymode");
    } else {
      setScreen(s);
    }
  }

  function handleSimComplete(result){
    setSimResult(result);
    setScreen("sim-results");
    // Award XP for simulation completion — was missing, breaking progress/Grimoire/XP
    const endingType = result?.endingType || "failure";
    const scoreMap = { success:90, perfect:100, good:75, survival:60, warn:60, bad:30, failure:20 };
    const syntheticScore = scoreMap[endingType] ?? 30;
    awardXP("SEED", result?.caseId || "freshmart-sim", {
      score: syntheticScore,
      maxScore: 100,
      endingType,
    }).then(()=>fetchUserAttempts()).catch(()=>{});
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
          {["Rankings","Progress","Story","Boardroom"].map(x=>(
            <span key={x} style={{fontFamily:T.mono,fontSize:10,color:T.dim,cursor:"pointer",letterSpacing:1.5,transition:"color .15s"}}
              onMouseEnter={e=>e.currentTarget.style.color=T.gold}
              onMouseLeave={e=>e.currentTarget.style.color=T.dim}
              onClick={()=>{
                if(x==="Boardroom") setScreen("boardroom");
                if(x==="Progress") setScreen("progress");
                if(x==="Rankings") setScreen("lobby");
                if(x==="Story") setScreen("storymode");
              }}>
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
  const sidebarProps = { user, leaderboard, leaderboardLoading, feed };
  const caseNameById = (id)=>{
    const fromList = caseList.find(c=>c.id===id)?.label;
    const fromAll = ALL_CASES[id]?.company;
    return fromList || fromAll || id;
  };
  const bestByCase = Object.values(
    (attempts||[]).reduce((acc,a)=>{
      const score = Number(a?.score)||0;
      const maxScore = Math.max(1, Number(a?.max_score)||100);
      const pct = Math.round((score/maxScore)*100);
      if(!acc[a.case_id] || pct>acc[a.case_id].pct){
        acc[a.case_id] = { caseId:a.case_id, pct, attempts:1, lastAt:a.completed_at };
      }else{
        acc[a.case_id].attempts += 1;
      }
      return acc;
    },{})
  ).sort((a,b)=>b.pct-a.pct);
  const attemptsWithType = (attempts||[]).map((a)=>{
    const t = ALL_CASES[a.case_id]?.type || caseList.find(c=>c.id===a.case_id)?.type || "scenario";
    const score = Number(a?.score)||0;
    const maxScore = Math.max(1, Number(a?.max_score)||100);
    const pct = Math.round((score/maxScore)*100);
    return { ...a, type:t, pct };
  });
  const avgPct = (arr)=>arr.length ? Math.round(arr.reduce((s,x)=>s+x.pct,0)/arr.length) : 0;
  const scenarioAttempts = attemptsWithType.filter(a=>a.type==="scenario");
  const financialAttempts = attemptsWithType.filter(a=>a.type==="financial");
  const businessAvg = avgPct(scenarioAttempts);
  const financialAvg = avgPct(financialAttempts);
  const allAvg = avgPct(attemptsWithType);
  const sortedByTime = [...attemptsWithType].reverse();
  const mid = Math.floor(sortedByTime.length/2);
  const earlyAvg = avgPct(sortedByTime.slice(0, mid||1));
  const recentAvg = avgPct(sortedByTime.slice(mid||0));
  const improvement = Math.max(0, recentAvg-earlyAvg);
  const consistency = attemptsWithType.length<2 ? 50 : Math.max(0, Math.round(100 - Math.sqrt(attemptsWithType.reduce((s,a)=>s+Math.pow(a.pct-allAvg,2),0)/attemptsWithType.length)));
  const coverage = caseList.length ? Math.round((bestByCase.length/caseList.length)*100) : 0;
  const bestAvg = bestByCase.length ? Math.round(bestByCase.reduce((s,c)=>s+c.pct,0)/bestByCase.length) : 0;
  const skillAxes = [
    { id:"financial", label:"Financial", value:financialAvg, color:T.blue },
    { id:"business", label:"Business", value:businessAvg, color:T.gold },
    { id:"consistency", label:"Consistency", value:consistency, color:T.green },
    { id:"improvement", label:"Improvement", value:improvement, color:T.green },
    { id:"coverage", label:"Coverage", value:coverage, color:T.goldM },
    { id:"quality", label:"Best-Case Quality", value:bestAvg, color:T.blue },
  ];
  const sortedAxes = [...skillAxes].sort((a,b)=>b.value-a.value);
  const strengths = sortedAxes.slice(0,2);
  const weakPoints = sortedAxes.slice(-2);
  const radarSize = 260;
  const radarCx = radarSize/2;
  const radarCy = radarSize/2;
  const radarR = 84;
  const radarPoints = skillAxes.map((axis, i)=>{
    const angle = (-Math.PI/2) + (i * (2*Math.PI/skillAxes.length));
    const r = (Math.max(0, Math.min(100, axis.value))/100) * radarR;
    return `${(radarCx + Math.cos(angle)*r).toFixed(1)},${(radarCy + Math.sin(angle)*r).toFixed(1)}`;
  }).join(" ");

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
          <FreshMartSim onBack={()=>setScreen("cases")} onComplete={handleSimComplete} onDecisionXP={awardDecisionXP} user={user}/>
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
        {screen==="boardroom"&&<Boardroomv onBack={()=>setScreen("lobby")}/>}
        {screen==="storymode"&&<StoryMode onBack={()=>setScreen("lobby")}/>}
        {screen==="progress"&&(
          <div style={{minHeight:"100vh",background:T.bg,display:"flex",flexDirection:"column"}}>
            <NavBar/>
            <div style={{padding:"28px 30px"}}>
              {!user&&(
                <div style={{background:T.surf,border:`1px solid ${T.border}`,padding:"20px 22px"}}>
                  <div style={{fontFamily:T.serif,fontSize:24,color:T.txt,fontWeight:800,marginBottom:8}}>Progress</div>
                  <div style={{fontFamily:T.sans,fontSize:13,color:T.dim,marginBottom:14}}>Sign in to view your profile, covered cases, and performance trend.</div>
                  <button onClick={()=>setShowAuth(true)} style={{border:`1px solid ${T.goldM}`,background:"transparent",padding:"7px 14px",fontFamily:T.mono,fontSize:10,color:T.gold,letterSpacing:1.5,cursor:"pointer"}}>SIGN IN / SIGN UP</button>
                </div>
              )}
              {user&&(
                <>
                  <div style={{fontFamily:T.mono,fontSize:8,color:T.muted,letterSpacing:2,marginBottom:10}}>XP STATS WINDOW</div>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:10,marginBottom:16}}>
                    <div style={{background:T.surf,border:`1px solid ${T.border}`,padding:"12px 14px"}}><div style={{fontFamily:T.mono,fontSize:8,color:T.dim}}>USER</div><div style={{fontFamily:T.serif,fontSize:18,color:T.gold,fontWeight:800}}>{user.username}</div></div>
                    <div style={{background:T.surf,border:`1px solid ${T.border}`,padding:"12px 14px"}}><div style={{fontFamily:T.mono,fontSize:8,color:T.dim}}>RANK</div><div style={{fontFamily:T.serif,fontSize:18,color:DC[xpToRank(user.xp)]||T.gold,fontWeight:800}}>{xpToRank(user.xp)}</div></div>
                    <div style={{background:T.surf,border:`1px solid ${T.border}`,padding:"12px 14px"}}><div style={{fontFamily:T.mono,fontSize:8,color:T.dim}}>TOTAL XP</div><div style={{fontFamily:T.serif,fontSize:18,color:T.txt,fontWeight:800}}>{(user.xp||0).toLocaleString()}</div></div>
                    <div style={{background:T.surf,border:`1px solid ${T.border}`,padding:"12px 14px"}}><div style={{fontFamily:T.mono,fontSize:8,color:T.dim}}>COMMISSION</div><div style={{fontFamily:T.serif,fontSize:18,color:T.green,fontWeight:800}}>{(user.commission||0).toLocaleString()}</div></div>
                    <div style={{background:T.surf,border:`1px solid ${T.border}`,padding:"12px 14px"}}><div style={{fontFamily:T.mono,fontSize:8,color:T.dim}}>CASES</div><div style={{fontFamily:T.serif,fontSize:18,color:T.txt,fontWeight:800}}>{bestByCase.length}</div></div>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(240px,1fr))",gap:10,marginBottom:16}}>
                    <div style={{background:T.surf,border:`1px solid ${T.border}`,padding:"12px 14px"}}>
                      <div style={{fontFamily:T.mono,fontSize:8,color:T.dim,marginBottom:8}}>ANALYSIS TRACKING</div>
                      {[{k:"Financial Analysis",v:financialAvg,c:T.blue},{k:"Business Analysis",v:businessAvg,c:T.gold}].map(row=>(
                        <div key={row.k} style={{marginBottom:10}}>
                          <div style={{display:"flex",justifyContent:"space-between",fontFamily:T.mono,fontSize:9,color:T.dim,marginBottom:4}}><span>{row.k}</span><span style={{color:row.c,fontWeight:700}}>{row.v}%</span></div>
                          <div style={{height:5,background:T.muted}}><div style={{height:"100%",width:`${row.v}%`,background:row.c,transition:"width .4s"}}/></div>
                        </div>
                      ))}
                    </div>
                    <div style={{background:T.surf,border:`1px solid ${T.border}`,padding:"12px 14px"}}>
                      <div style={{fontFamily:T.mono,fontSize:8,color:T.dim,marginBottom:8}}>STRENGTHS & WEAK POINTS</div>
                      <div style={{fontFamily:T.mono,fontSize:9,color:T.green,marginBottom:6}}>Strengths: {strengths.map(s=>`${s.label} (${s.value}%)`).join(" · ") || "—"}</div>
                      <div style={{fontFamily:T.mono,fontSize:9,color:T.red}}>Weak Points: {weakPoints.map(s=>`${s.label} (${s.value}%)`).join(" · ") || "—"}</div>
                    </div>
                  </div>
                  <div style={{background:T.surf,border:`1px solid ${T.border}`,padding:"16px 18px",marginBottom:16}}>
                    <div style={{fontFamily:T.mono,fontSize:8,color:T.muted,letterSpacing:2,marginBottom:12}}>HECTOGRAPH · PERFORMANCE SHAPE</div>
                    <div style={{display:"flex",gap:18,alignItems:"center",flexWrap:"wrap"}}>
                      <svg width={radarSize} height={radarSize} style={{background:T.surf2,border:`1px solid ${T.border}`}}>
                        {[0.25,0.5,0.75,1].map((lvl,i)=>(
                          <polygon key={i} points={skillAxes.map((_,idx)=>{const ang=(-Math.PI/2)+(idx*(2*Math.PI/skillAxes.length));const rr=radarR*lvl;return `${(radarCx+Math.cos(ang)*rr).toFixed(1)},${(radarCy+Math.sin(ang)*rr).toFixed(1)}`;}).join(" ")} fill="none" stroke={T.muted} strokeWidth="1" />
                        ))}
                        {skillAxes.map((ax,idx)=>{const ang=(-Math.PI/2)+(idx*(2*Math.PI/skillAxes.length));return <line key={ax.id} x1={radarCx} y1={radarCy} x2={radarCx+Math.cos(ang)*radarR} y2={radarCy+Math.sin(ang)*radarR} stroke={T.muted} strokeWidth="1" />;})}
                        <polygon points={radarPoints} fill={`${T.gold}22`} stroke={T.gold} strokeWidth="2"/>
                        {skillAxes.map((ax,idx)=>{const ang=(-Math.PI/2)+(idx*(2*Math.PI/skillAxes.length));const lx=radarCx+Math.cos(ang)*(radarR+18);const ly=radarCy+Math.sin(ang)*(radarR+18);return <text key={`${ax.id}-t`} x={lx} y={ly} fill={T.dim} fontSize="9" textAnchor="middle">{ax.label}</text>;})}
                      </svg>
                      <div style={{flex:1,minWidth:240}}>
                        {skillAxes.map(ax=>(
                          <div key={ax.id} style={{display:"flex",justifyContent:"space-between",padding:"4px 0",borderBottom:`1px solid ${T.muted}`}}>
                            <span style={{fontFamily:T.mono,fontSize:9,color:T.dim}}>{ax.label}</span>
                            <span style={{fontFamily:T.mono,fontSize:10,color:ax.color,fontWeight:700}}>{ax.value}%</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div style={{background:T.surf,border:`1px solid ${T.border}`,padding:"16px 18px"}}>
                    <div style={{fontFamily:T.mono,fontSize:8,color:T.muted,letterSpacing:2,marginBottom:10}}>BEST RESULTS BY CASE</div>
                    {bestByCase.length===0&&<div style={{fontFamily:T.sans,fontSize:13,color:T.dim}}>No attempts yet. Complete a case to start tracking progress.</div>}
                    {bestByCase.map((c)=>(
                      <div key={c.caseId} style={{display:"flex",justifyContent:"space-between",gap:12,padding:"9px 0",borderBottom:`1px solid ${T.muted}`}}>
                        <div>
                          <div style={{fontFamily:T.sans,fontSize:13,color:T.txt,fontWeight:600}}>{caseNameById(c.caseId)}</div>
                          <div style={{fontFamily:T.mono,fontSize:8,color:T.dim,letterSpacing:1}}>{c.attempts} attempts</div>
                        </div>
                        <div style={{textAlign:"right"}}>
                          <div style={{fontFamily:T.mono,fontSize:12,color:c.pct>=80?T.green:c.pct>=60?T.gold:T.red,fontWeight:700}}>{c.pct}%</div>
                          <div style={{fontFamily:T.mono,fontSize:8,color:T.dim}}>best score</div>
                        </div>
                      </div>
                    ))}
                  </div>
                   <Grimoire userId={user.id} token={token} supabase={supabase} />           
                </>
              )}
            </div>
          </div>
        )}{/* ── Grimoire lives inside progress, already rendered at line 4634 ── */}

      </div>{/* closes root <div style={{fontFamily...}}> line 4533 */}

      {/* Auth modal */}
      {showAuth&&<AuthModal onClose={()=>setShowAuth(false)} onAuth={handleAuth}/>}

      {/* XP toast */}
      {xpToast&&<XPToast {...xpToast} onDone={()=>setXpToast(null)}/>}

      {/* Auth notification */}
      {authNotification&&<AuthNotification type={authNotification.type} onDone={()=>setAuthNotification(null)} user={user}/>}

    </UserCtx.Provider>
  );
}