// T7 — thin I/O wrapper over the existing /api/chat for the hint ladder + grading.
// Defensive (eng-review D2): sends our rung-constrained prompt and IGNORES the
// server's matched_topic / reference_* fields so stray textbook pages never leak
// into the practice UI. Self-contained (not the shared client — see TODO T16).
import { apiUrl } from "../apiBase";
import {
  buildHintPrompt,
  buildGradePrompt,
  parseVerdict,
  type Rung,
  type GradeVerdict,
} from "./hintLadder";
import type { ChallengeProblem } from "./types";

interface ChatResponse {
  reply?: string;
  // matched_topic / reference_* are intentionally NOT read.
  detail?: string;
  error?: string;
}

/** Pure: take only the tutor text, dropping every matching/reference field. */
export function extractReply(data: ChatResponse): string {
  return (data.reply ?? data.detail ?? data.error ?? "").trim();
}

async function postChat(message: string, token?: string | null): Promise<string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const resp = await fetch(apiUrl("/api/chat"), {
    method: "POST",
    headers,
    body: JSON.stringify({ message, history: [], textbook_id: "focs" }),
  });
  const data = (await resp.json().catch(() => ({}))) as ChatResponse;
  if (!resp.ok) throw new Error(data.detail || data.error || `chat ${resp.status}`);
  return extractReply(data);
}

/** Fetch the hint for the current rung. Solution is only in the prompt at L4+ (leak guard). */
export function fetchHint(
  rung: Rung,
  problem: ChallengeProblem,
  attempt: string,
  token?: string | null,
): Promise<string> {
  return postChat(buildHintPrompt(rung, problem, attempt), token);
}

/** Grade a free-response attempt → verdict (correct / incorrect / incomplete). */
export async function gradeChallenge(
  problem: ChallengeProblem,
  attempt: string,
  token?: string | null,
): Promise<GradeVerdict> {
  const reply = await postChat(buildGradePrompt(problem, attempt), token);
  return parseVerdict(reply);
}
