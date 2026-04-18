# AutoGrader 对外接口说明（最简评分流程）

本文档说明外部代码如何调用 AutoGrader 完成一次最简评分流程：
输入题目与答案文件，返回按题号组织的评分结果。

## 1. 适用场景

- 输入一份题目卷（PDF 或图片）和一份答案卷（PDF 或图片）
- 自动进行题目/答案配对
- 通过一次 LLM 调用完成所有题目的评分
- 返回每题分数，并尽可能返回该题满分

## 2. 对外入口

推荐使用 `public_api.py` 中的统一入口：

- 请求模型：AutoGraderGradeRequest
- 响应模型：AutoGraderGradeResponse
- 调用函数：grade_paper_once(request)

对应文件：
- backend/AutoGrader/public_api.py

## 3. 请求参数

AutoGraderGradeRequest 字段说明：

- paper_id: string
  - 试卷唯一标识，用于追踪和日志
- question_source: string
  - 题目文件路径
  - 支持格式：.pdf / .jpg / .jpeg / .png
- answer_source: string
  - 答案文件路径
  - 支持格式：.pdf / .jpg / .jpeg / .png

## 4. 返回结构

AutoGraderGradeResponse 字段说明：

- paper_id: string
  - 与请求中的 paper_id 对应
- pair_count: int
  - 成功配对出的题目数量
- temp_dir: string | null
  - 临时裁剪文件目录（每题 question/answer 子 PDF 会保存在此）
- pairs: list[string]
  - 检测到的题号列表，例如 ["5", "6"]
- scores: dict[string, AutoGraderScoreItem]
  - 键：题号（标准化后）
  - 值：每题评分对象

AutoGraderScoreItem 字段说明：

- score: float
  - 分值（绝对分或百分比）
- mode: "absolute" | "percentage"
  - absolute: 返回绝对分
  - percentage: 返回百分比分（0-100）
- max_score: float | null
  - 仅在 mode=absolute 时有值

## 5. 评分规则（满分优先）

评分时会先检查题目与答案，尝试确定该题满分：

- 若识别到或可推断出该题满分：
  - mode = absolute
  - 返回 score 和 max_score
- 若无法确定该题满分：
  - mode = percentage
  - score 以 0-100 百分比返回
  - max_score 为 null

## 6. 具体示例（Python）

下面示例使用测试素材 Q5Q6.jpg 和 Answer.jpg：

```python
import asyncio
from AutoGrader.public_api import AutoGraderGradeRequest, grade_paper_once


async def main() -> None:
    request = AutoGraderGradeRequest(
        paper_id="demo-q5q6",
        question_source=r"h:\work_space\AI_tutor\backend\AutoGrader\test_pdfs\Q5Q6.jpg",
        answer_source=r"h:\work_space\AI_tutor\backend\AutoGrader\test_pdfs\Answer.jpg",
    )

    response = await grade_paper_once(request)

    print("paper_id:", response.paper_id)
    print("pair_count:", response.pair_count)
    print("pairs:", response.pairs)
    print("scores:")
    for qid, item in response.scores.items():
        if item.mode == "absolute" and item.max_score is not None:
            print(f"  Q{qid}: {item.score}/{item.max_score}")
        else:
            print(f"  Q{qid}: {item.score}%")


if __name__ == "__main__":
    asyncio.run(main())
```

## 7. 示例输出（示意）

```text
paper_id: demo-q5q6
pair_count: 2
pairs: ['5', '6']
scores:
  Q5: 14.0/16.0
  Q6: 2.0/14.0
```

说明：

- 上述分数仅为一次运行示例，实际结果会随识别与模型判断而变化
- 若某题无法确定满分，输出会类似 Q6: 82.0%

## 8. 外部集成建议

- 在服务层保留请求与响应原始 JSON 便于追溯
- 对 scores 字段做兼容处理：优先读取 mode，再决定展示为分数或百分比
- 如果需要稳定复现，建议固定输入图像质量与版式
