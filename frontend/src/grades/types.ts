// Shared grade types — the WIRE shape sent to / received from the backend.
// The server is authoritative for ALL grade math (standing, goal-seek); the client
// never computes grades. These types match backend/grades_serde.py's expected input
// and backend/grades_report.py's output.

export type Rule =
  | { kind: "uniform"; nSlots: number }
  | { kind: "dropLowest"; nSlots: number; k: number }
  | { kind: "rankWeights"; weights: number[] }; // absolute per-slot points

export type Item = { id: string; name: string; score: number | null; maxScore: number };
export type Category = { id: string; name: string; weight: number; rule: Rule; items: Item[] };
export type Cutoff = { letter: string; min: number };
export type Course = { name: string; term: string; categories: Category[]; cutoffs: Cutoff[] };

// ---- server-computed responses (POST /api/grades/standing) ----
export type GoalStatus = "ok" | "locked" | "unreachable";
export type LadderRow = { letter: string; status: GoalStatus; needed: number | null };
export type Standing = { percent: number | null; letter: string | null };
export type StandingResp = { standing: Standing; ladder: LadderRow[] | null };
