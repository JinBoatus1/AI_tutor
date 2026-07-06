// Shared grade types — the WIRE shape sent to / received from the backend.
// The server is authoritative for ALL grade math (standing, goal-seek); the client
// never computes grades. These types match backend/grades_serde.py's expected input
// and backend/grades_report.py's output.

export type Rule =
  | { kind: "uniform"; nSlots: number }
  | { kind: "dropLowest"; nSlots: number; k: number }
  | { kind: "rankWeights"; weights: number[] } // absolute per-slot points, assigned by SCORE RANK (legacy; not editor-exposed)
  | { kind: "fixedWeights" } // per-item fixed weights — the weight lives on each Item.weight (positional, not rank-based)
  | { kind: "replaceLowest" }; // per-item fixed weights + one Item.replacer=true; its score lifts the lowest other item if higher

// `weight` is only meaningful when the owning category's rule is `fixedWeights`; it is
// the item's fixed contribution in points-of-the-100-total (item weights should sum to
// the category weight). Matches backend/grades_math.py Item.weight.
export type Item = { id: string; name: string; score: number | null; maxScore: number; weight?: number; replacer?: boolean };
export type Category = { id: string; name: string; weight: number; rule: Rule; items: Item[] };
export type Cutoff = { letter: string; min: number };
// Alternate course-level weighting scheme; the grade is the MAX over the primary weights + these.
// `weights` is keyed by category id; a category omitted falls back to its own weight (backend).
export type WeightScheme = { name: string; weights: Record<string, number> };
export type Course = { name: string; term: string; categories: Category[]; cutoffs: Cutoff[]; weightings?: WeightScheme[] };

// ---- server-computed responses (POST /api/grades/standing) ----
export type GoalStatus = "ok" | "locked" | "unreachable";
export type LadderRow = { letter: string; status: GoalStatus; needed: number | null };
export type Standing = { percent: number | null; letter: string | null };

// ---- result transparency ("b"): read-only breakdown the server computes ----
export type CategoryStanding = { name: string; weight: number; percent: number | null; graded: boolean };
export type WinningScheme = { name: string | null; count: number }; // name === null → primary weights won
export type ReplaceBoost = { categoryName: string; replacer: string; lifted: string; deltaPct: number };
export type Breakdown = {
  categories: CategoryStanding[];
  winningScheme: WinningScheme | null;
  replaceBoosts: ReplaceBoost[];
};
// `breakdown` optional so an older server response still type-checks (UI hides all three then).
export type StandingResp = { standing: Standing; ladder: LadderRow[] | null; breakdown?: Breakdown };
