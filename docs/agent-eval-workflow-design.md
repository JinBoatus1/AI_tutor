# Agent Evaluation Workflow 设计

> **状态:** DRAFT  
> **日期:** 2026-07-21  
> **参考:** [ArkSim](https://github.com/arklexai/arksim) — 开源多轮对话模拟 + 评测框架  
> **目标:** 用合成学生 persona 对 AI Tutor 全系统做可重复的端到端评测，系统化收集改进意见并驱动迭代

---

## 1. 问题与目标

### 1.1 现状

AI Tutor 已有多个 LLM 驱动的功能模块，但评测分散：

| 模块 | 现有 API | 评测现状 |
|------|----------|----------|
| 学习辅导 Chat | `POST /api/chat` | 无自动化；confidence evaluator 仅内部使用 |
| 练习模式 Challenge | 复用 `/api/chat` + prompt envelope | T1 go/no-go eval **未实现** |
| AutoGrader | `POST /api/autograder/grade` | 有单元测试，无 LLM 行为 eval |
| 成绩 Goal-seek | `POST /api/grades/standing` | 数学逻辑有 pytest；chat 注入行为 = 手动 checklist |
| Syllabus 解析 | `POST /api/grades/parse_syllabus` | T10 eval **未实现** |
| Memory Tool | 内嵌于 `/api/chat` | 无测试覆盖 |

核心痛点：
- `/api/chat` 路由过于复杂（topic 匹配、bar 注入、DB 写入、memory 副作用），不适合直接做隔离 eval
- 缺少**合成用户**多轮对话模拟（单轮 fixture 测不出 context loss、前后矛盾等问题）
- 评测结果没有统一 schema，无法跨 run 对比、无法 CI gate

### 1.2 设计目标

1. **Function API 层** — 每个核心能力暴露一个 eval 专用 endpoint，输入/输出结构化、无副作用
2. **Simulation 层** — LLM 驱动的合成学生，按 persona + goal 与系统多轮交互（参考 ArkSim）
3. **Evaluation 层** — 对每轮/每会话打分，归类 failure pattern，生成可行动的改进清单
4. **Iteration 层** — eval → 失败聚类 → issue/task → 修复 → 回归 eval 的闭环

---

## 2. 整体架构

```
┌─────────────────────────────────────────────────────────────────┐
│                     Iteration Loop (人工 + CI)                    │
│   scenarios.json → simulate → evaluate → report → fix → re-run  │
└─────────────────────────────────────────────────────────────────┘
         ▲                              │
         │                              ▼
┌────────┴────────┐            ┌─────────────────┐
│  Scenario Bank  │            │  Eval Report    │
│  (personas +    │            │  evaluation.json│
│   goals +       │            │  focus/*.json   │
│   knowledge)    │            │  final_report   │
└────────┬────────┘            └─────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│              Simulation Engine (ArkSim 或自研 runner)             │
│   合成学生 LLM ←──multi-turn──→ Agent Adapter                     │
└─────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Function Eval API Layer                         │
│  /api/eval/tutor/chat    /api/eval/practice/grade               │
│  /api/eval/practice/hint /api/eval/autograder/grade             │
│  /api/eval/grades/*      /api/eval/memory/recall                │
└─────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│              Existing Business Logic (reuse)                      │
│  api_routes, AutoGrader, grades_*, memory, learning_resources   │
└─────────────────────────────────────────────────────────────────┘
```

### 2.1 与 ArkSim 的关系

**推荐策略：ArkSim 做 Simulation + Evaluation 编排，自研 Function Eval API 做 agent 适配。**

ArkSim 擅长：
- 合成用户 persona / goal / knowledge 驱动的多轮对话
- 内置 metrics（helpfulness, faithfulness, goal_completion, agent_behavior_failure）
- 输出 `simulation.json` + `evaluation.json` + focus files
- CI 集成（exit code 0/1/2/3）

ArkSim 不擅长（需我们补）：
- AI Tutor 特有的 eval 模式（practice grading verdict、proof-order、goal-seek 数字准确性）
- 隔离 topic 匹配 / DB 副作用
- 跨多个 function 的端到端 journey（chat → practice → grades）

因此采用 **混合架构**：
- **Phase 1:** ArkSim HTTP adapter 对接 `/api/eval/tutor/chat`（最快落地）
- **Phase 2:** 自研 `backend/evals/runner.py` 统一 orchestrate 全部 function evals
- **Phase 3:** 自定义 metrics（practice_verdict_accuracy, goal_seek_numeric_accuracy, rubric_field_f1）

---

## 3. Function Eval API 设计

### 3.1 设计原则

| 原则 | 说明 |
|------|------|
| **Eval-only 路由** | 前缀 `/api/eval/`，生产环境可通过 `EVAL_MODE=1` 或独立 port 启用 |
| **无副作用** | 不写 MongoDB、不更新 student_bar、不写 memory JSONL（或写入 `data/eval/` 隔离目录） |
| **显式上下文** | 调用方传入 `context` 块，不依赖 auth/session 隐式状态 |
| **结构化响应** | 除 LLM 回复外，返回 `metadata`（verdict、confidence、matched_topic、tool_calls 等） |
| **OpenAI 兼容** | tutor chat eval endpoint 同时支持 ArkSim `chat_completions` adapter |

### 3.2 API 清单

#### A. Tutor Chat — `POST /api/eval/tutor/chat`

**用途:** 学习模式辅导、成绩注入对话、通用 eval 对话

```json
// Request
{
  "messages": [{"role": "user", "content": "..."}],
  "context": {
    "textbook_id": "focs",
    "section_hint": "4.3 Proof by Contradiction",
    "skip_topic_matching": true,
    "inject_grades": false,
    "inject_student_bar": false,
    "memory_mode": "none"  // "none" | "read_only" | "isolated_write"
  },
  "eval_run_id": "uuid"
}

// Response
{
  "reply": "...",
  "metadata": {
    "confidence": 85,
    "matched_topic": null,
    "tool_calls": [],
    "memory_events_used": 0,
    "latency_ms": 1234
  }
}
```

**ArkSim adapter:** 将此 endpoint 包装为 OpenAI Chat Completions 兼容格式，供 `agent_config.agent_type: chat_completions` 直接调用。

---

#### B. Practice Grading — `POST /api/eval/practice/grade`

**用途:** Challenge 模式 AI 评分（T1 go/no-go eval 的核心）

```json
// Request
{
  "problem_id": "ch4-proof-contradiction-1",
  "student_attempt": "...",
  "hint_rung": 0,
  "expected_verdict": "CORRECT"  // 仅 fixture 模式；live eval 不传
}

// Response
{
  "verdict": "CORRECT",  // CORRECT | INCORRECT | INCOMPLETE
  "feedback": "...",
  "raw_reply": "..."
}
```

**T1 fixtures:** 5 种 Ch.4 证明尝试（correct / subtly-wrong / hand-wavy / off-topic / blank）

---

#### C. Practice Hint — `POST /api/eval/practice/hint`

**用途:** Hint ladder L0-L6 逐级提示

```json
{
  "problem_id": "ch4-proof-contradiction-1",
  "student_attempt": "...",
  "hint_rung": 3,
  "conversation_history": []
}
```

**Eval metrics:** leak guard（L4 前不泄露答案）、rung 递进合理性

---

#### D. AutoGrader — `POST /api/eval/autograder/grade`

**用途:** 试卷自动评分（已有 `grade_paper_once`，加 eval wrapper）

```json
{
  "paper_pdf_base64": "...",
  "answer_key_pdf_base64": "...",
  "rubric_override": null
}
```

**Eval metrics:** 逐题分数 MAE、rubric adherence

---

#### E. Grades Standing — `POST /api/eval/grades/standing`

**用途:** Goal-seek 数字准确性 + chat 注入行为

```json
{
  "course_fixture_id": "cs201-spring26",
  "target_letter": "A",
  "future_item": "Final Exam"
}
```

**Eval metrics:** needed_score 与 hand-computed 期望值 ±0.5%

---

#### F. Syllabus Parse — `POST /api/eval/grades/parse_syllabus`

**用途:** Rubric 提取（T10 eval）

```json
{
  "syllabus_fixture_id": "syllabus-cs201",
  "syllabus_text": "..."  // 或 PDF base64
}
```

**Eval metrics:** category weights F1、cutoff 字段 accuracy、weight sum = 100

---

#### G. Memory Recall — `POST /api/eval/memory/recall`

**用途:** 测试 memory tool 是否在需要时调用、是否召回正确内容

```json
{
  "subtopic_id": "focs/4.3",
  "seed_events": [{"q": "...", "a": "..."}],
  "follow_up_question": "你上次说的那个反证法例子是什么？"
}
```

**Eval metrics:** tool_call 触发率、召回内容相关性

---

#### H. Orchestration — `POST /api/eval/run` + `GET /api/eval/runs/{id}`

**用途:** 触发一次完整 eval run，异步执行，返回 run 状态

```json
// POST /api/eval/run
{
  "suite": "tutor_smoke",       // 或 "practice_t1", "full_system"
  "scenarios_file": "scenarios/tutor_smoke.json",
  "num_conversations_per_scenario": 3,
  "max_turns": 8
}

// Response
{"run_id": "uuid", "status": "queued"}
```

---

### 3.3 文件布局

```
backend/
├── eval_routes.py              # FastAPI router，挂载 /api/eval/*
├── evals/
│   ├── __init__.py
│   ├── runner.py               # 统一 eval orchestrator
│   ├── adapters/
│   │   ├── arksim_adapter.py   # OpenAI-compatible wrapper for ArkSim
│   │   └── http_client.py      # 调用 /api/eval/* 的 client
│   ├── metrics/
│   │   ├── practice_verdict.py
│   │   ├── goal_seek_accuracy.py
│   │   ├── rubric_extraction.py
│   │   └── tutor_behavior.py   # 内置 + 自定义 qualitative metrics
│   ├── fixtures/
│   │   ├── practice_ch4_proofs.jsonl
│   │   ├── syllabi_rubrics.json
│   │   └── grades_courses.json
│   └── scenarios/
│       ├── scenarios.json      # ArkSim 兼容格式
│       ├── tutor_smoke.json
│       ├── practice_journey.json
│       └── grades_anxious_student.json
├── eval_config.yaml            # ArkSim config 入口
└── data/eval/                  # 隔离的 eval 运行产物
    └── runs/{run_id}/
        ├── simulation.json
        ├── evaluation.json
        └── final_report.html
```

---

## 4. 合成学生 Persona 设计

参考 ArkSim `scenarios.json` schema，为 AI Tutor 定义以下 archetype：

### 4.1 Persona 矩阵

| ID | Persona | 知识水平 | 典型 Goal | 覆盖模块 |
|----|---------|----------|-----------|----------|
| `P01` | 迷茫大一新生 | 低 | "帮我理解什么是反证法" | Tutor Chat |
| `P02` | 进阶学生 | 高 | "证明 √2 无理，用反证法" | Tutor + Practice |
| `P03` | 成绩焦虑型 | 中 | "期末要考多少才能拿 A？" | Grades + Tutor |
| `P04` | 练习模式学生 | 中 | "我在做 Ch.4 证明题，卡在第 3 步" | Practice Hint + Grade |
| `P05` | 跑题/捣乱型 | 低 | 连续 off-topic，测试 tutor 边界 | Tutor Chat |
| `P06` | Returning 学生 | 中 | "上次我们讨论的内容你还记得吗？" | Memory |
| `P07` | 上传 syllabus 新生 | 低 | "帮我看看这门课评分怎么算" | Syllabus Parse + Grades |
| `P08` | 交卷学生 | 中 | "帮我改这份期中试卷" | AutoGrader |

### 4.2 Scenario 示例（ArkSim 兼容）

```json
{
  "schema_version": "v1",
  "scenarios": [
    {
      "scenario_id": "tutor-contradiction-basics",
      "user_id": "P01-confused-freshman",
      "goal": "你想搞懂反证法的基本思路，并且能用它证明一个简单命题。",
      "agent_context": "AI Tutor 是一个大学数学辅导助手，当前教材是 FOCS，学生正在学习第 4 章证明方法。",
      "user_profile": "你是一名大一新生，第一次接触形式化证明，对逻辑术语不熟悉，容易把'假设结论成立'和'假设前提成立'搞混。",
      "knowledge": [
        {"content": "你刚读完 FOCS 4.3 节，知道反证法的大致步骤是：假设结论不成立，推导矛盾。"}
      ]
    },
    {
      "scenario_id": "grades-final-anxiety",
      "user_id": "P03-grade-anxious",
      "goal": "你想知道期末考试需要考多少分才能拿到 A，并且希望 tutor 推荐应该复习哪些弱项。",
      "agent_context": "AI Tutor 已接入你的 CS201 课程成绩数据：Homework 85%, Midterm 78%, Final 未考。Rubric: HW 30%, Midterm 30%, Final 40%。A cutoff = 93%。",
      "user_profile": "你是一名大三学生，对成绩很焦虑，会反复确认数字，如果 tutor 给出的数字前后不一致会立刻追问。",
      "knowledge": [
        {"content": "你的当前加权成绩约为 81.9%，Final 占 40%。"}
      ]
    },
    {
      "scenario_id": "practice-subtle-wrong-proof",
      "user_id": "P04-practice-student",
      "goal": "你正在做 Ch.4 反证法练习题，已经写了一个证明草稿，想提交给 AI 评分并获取提示。",
      "agent_context": "AI Tutor 练习模式：当前题目要求用反证法证明'若 n² 是偶数则 n 是偶数'。",
      "user_profile": "你是有基础的学生，证明思路大致正确但在关键步骤有 subtle error（把'假设 n 是奇数'写成了'假设 n 是偶数'）。",
      "knowledge": [
        {"content": "你的草稿：假设 n 是偶数，则 n=2k，n²=4k² 是偶数，矛盾。所以 n 是偶数。"}
      ]
    }
  ]
}
```

### 4.3 Journey Scenarios（跨模块端到端）

除单功能 scenario 外，定义 **user journey** 模拟完整学习路径：

```
Journey: "新学期 onboarding"
  1. 上传 syllabus → parse rubric
  2. 确认 rubric → 录入 midterm 成绩
  3. 问 tutor "我需要 final 考多少"
  4. 进入 Ch.4 练习 → hint ladder → submit proof
  5. 回到 chat 问弱项复习建议
```

Journey eval 用自研 runner 顺序调用多个 `/api/eval/*` endpoint，而非 ArkSim 单 agent 多轮。

---

## 5. Evaluation Metrics

### 5.1 内置 Metrics（ArkSim 提供）

| Metric | 适用 | 阈值建议 |
|--------|------|----------|
| `goal_completion` | 所有 tutor scenario | ≥ 0.7 |
| `helpfulness` | Tutor / Practice hint | ≥ 3.5 / 5 |
| `faithfulness` | Tutor（教材 grounding） | ≥ 3.5 / 5 |
| `agent_behavior_failure` | 全部 | 零容忍：false information, disobey user request |
| `coherence` | 多轮 tutor | ≥ 3.5 / 5 |

### 5.2 自定义 Metrics（AI Tutor 专用）

| Metric | 模块 | 计算方式 |
|--------|------|----------|
| `practice_verdict_accuracy` | Practice | verdict == expected（T1 fixtures） |
| `hint_leak_score` | Practice | L<4 时回复是否含完整答案（regex + LLM judge） |
| `goal_seek_numeric_accuracy` | Grades | \|computed - expected\| ≤ 0.5% |
| `rubric_weight_sum_valid` | Syllabus | weights sum == 100 ± 1 |
| `rubric_category_f1` | Syllabus | category name + weight F1 vs hand-extracted |
| `memory_tool_recall_rate` | Memory | 需要历史时是否调用 tool |
| `confidence_calibration` | Tutor | confidence 与 evaluator 一致性 |

### 5.3 Failure 分类（系统化改进意见）

参考 ArkSim `unique_errors` schema，定义 AI Tutor 专用 failure taxonomy：

| Category | 示例 | 优先级 |
|----------|------|--------|
| `F01-factual-error` | 数学事实错误、定理误用 | Critical |
| `F02-pedagogy-leak` | 练习模式过早泄露答案 | High |
| `F03-verdict-wrong` | 正确证明判错 / 错误证明判对 | Critical |
| `F04-goal-seek-wrong` | 成绩计算数字错误 | High |
| `F05-context-loss` | 多轮后忘记之前说的内容 | High |
| `F06-rubric-parse-error` | Syllabus 解析权重严重偏差 | Medium |
| `F07-off-topic-failure` | 未能引导跑题学生回正轨 | Medium |
| `F08-memory-miss` | 应召回历史但未调用 tool | Medium |
| `F09-contradiction` | 与同会话早期回复矛盾 | High |
| `F10-verbosity` | 回复过长/过短影响学习体验 | Low |

每个 failure 自动映射到：
- **受影响模块** → 对应代码文件
- **建议 fix 类型** → prompt / logic / fixture / UI
- **回归 scenario** → focus file 中的 scenario 子集

---

## 6. Iteration Workflow

### 6.1 日常开发流程

```
开发者修改 prompt/logic
        │
        ▼
  pytest (确定性)  ←── 快速，无 API key
        │
        ▼
  eval smoke suite  ←── 3-5 个 scenario，~2 min，需 API key
        │
        ├── PASS → merge
        └── FAIL → 查看 evaluation.json + focus/*.json
                      │
                      ▼
                 创建 fix task（自动或手动）
                      │
                      ▼
                 修复 → 重新 eval
```

### 6.2 CI 集成

```yaml
# .github/workflows/eval.yml
name: Agent Eval
on:
  pull_request:
    paths: ['backend/**', 'frontend/src/practice/**']
  schedule:
    - cron: '0 6 * * 1'  # 每周一完整 eval

jobs:
  unit:
    runs-on: ubuntu-latest
    steps:
      - run: pytest backend/test_*.py backend/evals/test_*.py

  eval-smoke:
    runs-on: ubuntu-latest
    if: github.event_name == 'pull_request'
    steps:
      - run: arksim simulate-evaluate backend/eval_config.yaml --max-turns 5
        env:
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
          EVAL_MODE: "1"
      - uses: actions/upload-artifact@v4
        with:
          name: eval-report
          path: backend/data/eval/runs/

  eval-full:
    runs-on: ubuntu-latest
    if: github.event_name == 'schedule'
    steps:
      - run: python -m evals.runner --suite full_system
```

### 6.3 报告 → 改进意见收集

Eval run 产出三类 artifact：

1. **`evaluation.json`** — 结构化分数 + failure labels（机器可读）
2. **`focus/error_N.json`** — 触发特定 failure 的 scenario 子集（用于 targeted 修复）
3. **`final_report.html`** — 人可读报告：per-scenario 分数、失败 turn 高亮、对话 transcript

**改进意见工作流：**

```
evaluation.json
    │
    ├─ unique_errors[] ──→ 自动开 GitHub Issue（label: eval-failure）
    │                        模板含：category, severity, affected turns, suggested fix
    │
    ├─ scenario_scores[] ──→ Dashboard（可选：ArkSim UI 或自建）
    │
    └─ compare with baseline ──→ 回归检测（新 failure / 分数下降 > 10%）
```

---

## 7. 实施计划

### Phase 1 — 基础（1-2 周）

| Task | 产出 | 优先级 |
|------|------|--------|
| T-E1 | `eval_routes.py` + `POST /api/eval/tutor/chat`（无副作用 wrapper） | P0 |
| T-E2 | `POST /api/eval/practice/grade` + T1 fixtures (5 cases) | P0 |
| T-E3 | `backend/evals/scenarios/scenarios.json`（8 persona × 1 scenario） | P0 |
| T-E4 | `eval_config.yaml` + ArkSim 对接 tutor chat | P0 |
| T-E5 | `practice_verdict_accuracy` custom metric | P0 |

**Go/no-go:** T1 eval 5/5 verdict 正确 + ArkSim smoke 3 scenario goal_completion ≥ 0.7

### Phase 2 — 扩展（2-3 周）

| Task | 产出 |
|------|------|
| T-E6 | Grades eval APIs + goal_seek_numeric_accuracy metric |
| T-E7 | Syllabus parse eval (T10) + 3 fixture syllabi |
| T-E8 | Memory recall eval |
| T-E9 | Journey scenario runner（跨模块） |
| T-E10 | `POST /api/eval/run` 异步 orchestration |

### Phase 3 — 闭环（持续）

| Task | 产出 |
|------|------|
| T-E11 | CI workflow + baseline comparison |
| T-E12 | 自动 GitHub Issue 从 unique_errors |
| T-E13 | Eval dashboard（或 ArkSim UI 集成） |
| T-E14 | AutoGrader LLM eval fixtures |

---

## 8. ArkSim 快速启动

### 8.1 安装

```bash
pip install arksim
```

### 8.2 配置文件

见 `backend/eval_config.yaml`（随 repo 提供模板）

### 8.3 运行

```bash
# 启动 backend（eval mode）
EVAL_MODE=1 uvicorn main:app --port 8000

# 运行 simulate + evaluate
arksim simulate-evaluate backend/eval_config.yaml

# 查看报告
arksim-ui  # 或打开 backend/data/eval/runs/latest/final_report.html
```

### 8.4 Agent Adapter 要点

ArkSim 通过 `chat_completions` 调用 agent。我们需要一个 **OpenAI-compatible adapter endpoint**：

```
POST /api/eval/tutor/chat/completions   # OpenAI 格式
  ← ArkSim 发送 messages[]
  → 返回 choices[].message.content
```

或在 `eval_config.yaml` 中直接指向 wrapper：

```yaml
agent_config:
  agent_type: chat_completions
  agent_name: ai-tutor-eval
  api_config:
    endpoint: http://localhost:8000/api/eval/tutor/chat/completions
    headers:
      Content-Type: application/json
    body:
      model: gpt-5.2
      messages: []  # ArkSim 运行时注入
```

---

## 9. 与现有设计文档的衔接

| 现有 Spec | 本设计对应 |
|-----------|-----------|
| Practice T1 go/no-go eval | `POST /api/eval/practice/grade` + fixtures |
| Grade T10 rubric eval | `POST /api/eval/grades/parse_syllabus` + fixtures |
| Grade tracker chat checklist | `P03-grade-anxious` scenario + goal_seek metric |
| AutoGrader DESIGN.md (EvaluatorBase) | `POST /api/eval/autograder/grade` |
| `backend/evals/**`（规划中） | 本设计的 `backend/evals/` 目录 |

---

## 10. 开放问题

1. **Eval mode 部署隔离** — 独立 Render service vs 同实例 `EVAL_MODE` flag？
2. **LLM 非确定性** — 每个 scenario 跑 N 次取 majority vote？阈值如何定？
3. **成本控制** — full system eval 预估 ~$5-15/run；smoke suite 限制 scenario 数量
4. **Frontend practice eval** — hint ladder 逻辑在 frontend；是否 port 到 Python 或在 Node 侧跑 vitest integration eval？
5. **Auth mock** — grades/sessions eval 是否需要 mock Firebase token？

---

## 附录 A：Eval API OpenAI Adapter 伪代码

```python
# backend/eval_routes.py (sketch)

@router.post("/api/eval/tutor/chat/completions")
async def eval_tutor_chat_completions(body: OpenAIChatRequest):
    """OpenAI-compatible endpoint for ArkSim integration."""
    user_messages = [m for m in body.messages if m.role == "user"]
    last_user = user_messages[-1].content if user_messages else ""

    result = await _eval_tutor_chat_internal(
        messages=body.messages,
        context=EvalContext(
            skip_topic_matching=True,
            inject_grades=False,
            inject_student_bar=False,
            memory_mode="none",
        ),
    )
    return {
        "choices": [{
            "message": {"role": "assistant", "content": result.reply},
            "finish_reason": "stop",
        }],
        "model": body.model,
    }
```

## 附录 B：T1 Fixture 示例

```jsonl
{"id": "t1-correct", "problem_id": "ch4-contradiction-sqrt2", "attempt": "Assume sqrt(2) is rational...", "expected_verdict": "CORRECT"}
{"id": "t1-subtle-wrong", "problem_id": "ch4-contradiction-sqrt2", "attempt": "Assume sqrt(2) is rational. Then sqrt(2) = p/q in lowest terms. So p and q are both even...", "expected_verdict": "INCORRECT"}
{"id": "t1-hand-wavy", "problem_id": "ch4-contradiction-sqrt2", "attempt": "It's obvious that sqrt(2) can't be a fraction because fractions repeat.", "expected_verdict": "INCOMPLETE"}
{"id": "t1-off-topic", "problem_id": "ch4-contradiction-sqrt2", "attempt": "The weather today is nice.", "expected_verdict": "INCORRECT"}
{"id": "t1-blank", "problem_id": "ch4-contradiction-sqrt2", "attempt": "", "expected_verdict": "INCOMPLETE"}
```
