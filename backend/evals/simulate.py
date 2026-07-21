"""Multi-turn conversation simulation (ArkSim-compatible output)."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any, Callable

from deps import create_chat_completion
from evals.config import EvalPipelineConfig
from evals.config import load_scenarios
from evals.tutor_agent import ChatTurn, TutorContext, call_tutor_agent

SIMULATOR_VERSION = "ai-tutor-evals-v1"
STOP_TOKEN = "###STOP###"

SIMULATED_USER_TEMPLATE = """You are a user interacting with an agent through multiple turns.
The agent is supplied by the following conversation context:
{agent_context}

Your profile is:
{user_profile}

You have the following goal when interacting with this agent:
{goal}

{knowledge_block}
Rules:
- Do not give away all the instruction at once. Only provide the information necessary for the current step.
- Do not hallucinate information that is not provided in the instruction.
- If the instruction goal is satisfied, generate '{stop_token}' as a standalone message without anything else.
- Do not repeat the exact instruction in the conversation.
- Avoid using bullet points or lists.
- Keep responses brief and under 50 words.
- You are the user and the agent is the assistant. Do not flip the roles.
"""


def _utc_now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _knowledge_block(scenario: dict[str, Any]) -> str:
    items = scenario.get("knowledge") or []
    if not items:
        return ""
    if len(items) == 1:
        return (
            "Here is the content that you might be interested in and might have questions about:\n"
            f"{items[0].get('content', '')}\n"
        )
    joined = "\n".join(f"- {it.get('content', '')}" for it in items)
    return f"Background knowledge you may reference:\n{joined}\n"


def build_simulated_user_system_prompt(scenario: dict[str, Any]) -> str:
    return SIMULATED_USER_TEMPLATE.format(
        agent_context=scenario.get("agent_context", ""),
        user_profile=scenario.get("user_profile", ""),
        goal=scenario.get("goal", ""),
        knowledge_block=_knowledge_block(scenario),
        stop_token=STOP_TOKEN,
    )


def _format_history_for_sim_user(history: list[dict[str, Any]]) -> str:
    lines: list[str] = []
    for msg in history:
        role = msg.get("role")
        content = (msg.get("content") or "").strip()
        if not content:
            continue
        label = "You" if role == "simulated_user" else "Agent"
        lines.append(f"{label}: {content}")
    return "\n".join(lines) if lines else "(conversation just started)"


def default_simulated_user_fn(scenario: dict[str, Any], model: str = "gpt-5.2") -> Callable[[list[dict[str, Any]]], str]:
    system_prompt = build_simulated_user_system_prompt(scenario)

    def generate(history: list[dict[str, Any]]) -> str:
        transcript = _format_history_for_sim_user(history)
        resp = create_chat_completion(
            model=model,
            messages=[
                {"role": "system", "content": system_prompt},
                {
                    "role": "user",
                    "content": (
                        "Continue the conversation as the simulated user.\n\n"
                        f"Conversation so far:\n{transcript}\n\nYour next message:"
                    ),
                },
            ],
            temperature=0.7,
        )
        return (resp.choices[0].message.content or "").strip()

    return generate


def run_simulation(
    config: EvalPipelineConfig,
    *,
    scenario_ids: list[str] | None = None,
    tutor_fn: Callable[[list[ChatTurn], TutorContext], tuple[str, dict[str, Any]]] | None = None,
    user_fn_factory: Callable[[dict[str, Any]], Callable[[list[dict[str, Any]]], str]] | None = None,
) -> dict[str, Any]:
    """Run multi-turn simulations and return ArkSim-compatible simulation.json payload."""
    scenarios_doc = load_scenarios(config.scenario_file_path)
    all_scenarios = scenarios_doc.get("scenarios", [])
    if scenario_ids:
        allowed = set(scenario_ids)
        all_scenarios = [s for s in all_scenarios if s.get("scenario_id") in allowed]

    tutor = tutor_fn or (lambda turns, ctx: call_tutor_agent(turns, ctx))
    user_factory = user_fn_factory or (lambda sc: default_simulated_user_fn(sc, config.model))

    simulation_id = str(uuid.uuid4())
    conversations: list[dict[str, Any]] = []

    for scenario in all_scenarios:
        scenario_id = scenario["scenario_id"]
        user_fn = user_factory(scenario)
        for _ in range(config.num_conversations_per_scenario):
            conversation_id = str(uuid.uuid4())
            history: list[dict[str, Any]] = []
            tutor_turns: list[ChatTurn] = []

            for turn_id in range(config.max_turns):
                user_msg = user_fn(history)
                if STOP_TOKEN in user_msg:
                    break
                history.append(
                    {
                        "turn_id": turn_id,
                        "message_id": str(uuid.uuid4()),
                        "role": "simulated_user",
                        "content": user_msg,
                    }
                )
                tutor_turns.append(ChatTurn(role="user", content=user_msg))
                assistant_reply, _meta = tutor(tutor_turns, TutorContext())
                tutor_turns.append(ChatTurn(role="assistant", content=assistant_reply))
                history.append(
                    {
                        "turn_id": turn_id,
                        "message_id": str(uuid.uuid4()),
                        "role": "assistant",
                        "content": assistant_reply,
                    }
                )

            conversations.append(
                {
                    "conversation_id": conversation_id,
                    "scenario_id": scenario_id,
                    "conversation_history": history,
                    "simulated_user_prompt": {
                        "simulated_user_prompt_template": SIMULATED_USER_TEMPLATE,
                        "variables": {
                            "scenario.agent_context": scenario.get("agent_context", ""),
                            "scenario.goal": scenario.get("goal", ""),
                            "scenario.knowledge": [k.get("content", "") for k in scenario.get("knowledge", [])],
                            "scenario.user_profile": scenario.get("user_profile", ""),
                        },
                    },
                }
            )

    return {
        "schema_version": "v1",
        "simulator_version": SIMULATOR_VERSION,
        "simulation_id": simulation_id,
        "generated_at": _utc_now(),
        "conversations": conversations,
    }
