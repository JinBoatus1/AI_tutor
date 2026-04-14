"""
快速参考：如何使用题目分割模块

本文件展示了从 learning_resources.py 借鉴代码，
实现"将PDF/多图片裁剪成一题一页PDF"的完整路径。
"""

# ============================================================================
# 1. 快速开始（MVP 用法示例）
# ============================================================================

from AutoGrader.question_splitter import QuestionDetector, QuestionSplitter, DocumentSplitter
import asyncio

# 场景 A：启发式分割（快速，无需 LLM）
def split_pdf_heuristic(pdf_bytes: bytes) -> list:
    """按题号正则表达式分割 PDF"""
    # 假设 PDF 第1页有多个题
    text = "1. Solve x+2=5\n2. Calculate 3*4\n3. Find derivative"
    
    questions = QuestionDetector.detect_by_heuristic(text)
    # → [{"number": "1", ...}, {"number": "2", ...}, {"number": "3", ...}]
    
    question_pdfs = QuestionSplitter.extract_question_regions(
        pdf_bytes=pdf_bytes,
        page_num_1based=1,
        detected_questions=questions,
    )
    # → [pdf_for_q1, pdf_for_q2, pdf_for_q3]
    return question_pdfs

# 场景 B：LLM 辅助分割（准确但需要 API 调用）
async def split_pdf_with_llm(pdf_bytes: bytes) -> list:
    """用 LLM 视觉识别，分割 PDF"""
    question_pdfs = await DocumentSplitter.split_pdf_by_questions(
        pdf_bytes=pdf_bytes,
        detection_method="llm",
    )
    # → [pdf_for_q1, pdf_for_q2, ...]
    return question_pdfs

# 调用示例
# if __name__ == "__main__":
#     with open("student_paper.pdf", "rb") as f:
#         pdf_bytes = f.read()
#     
#     # 选择一种方法
#     result = split_pdf_heuristic(pdf_bytes)
#     # 或
#     result = asyncio.run(split_pdf_with_llm(pdf_bytes))
#     
#     for i, q_pdf in enumerate(result):
#         with open(f"question_{i+1}.pdf", "wb") as out:
#             out.write(q_pdf)


# ============================================================================
# 2. 从 learning_resources.py 借鉴的关键代码片段
# ============================================================================

"""
关键方法 #1：文本提取（OCR fallback）
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
使用场景：部分 PDF 包含扫描图像，需要 OCR 提取文本来检测题号

借鉴代码：
  - extract_pdf_text_safe(file_bytes) → 自动 fallback pytesseract OCR
  
改进：在 question_splitter.py 中复用了相同的 fitz.open() 和 pytesseract 组合


关键方法 #2：块合并（避免切碎段落）
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
使用场景：页面中有多个文本块，需要识别完整的段落/题目

借鉴代码：
  - 垂直间距阈值 PARAGRAPH_GAP_PT = 14.0
  - 合并相邻块的逻辑
  
改进：question_splitter.py 的 extract_question_regions() 使用 padding 实现类似的效果


关键方法 #3：图片裁剪和坐标计算
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
使用场景：根据 bbox 裁剪指定区域的图片

借鉴代码（learning_resources.py）：
  ```
  pix = page.get_pixmap(dpi=120, clip=rect)
  img_bytes = pix.tobytes("png")
  out_b64.append(base64.b64encode(img_bytes).decode("utf-8"))
  ```

复用场景（question_splitter.py）：
  - QuestionSplitter.extract_question_regions() 中的图片渲染
  - 支持 padding 扩展（防止题号被切掉）


关键方法 #4：LLM 视觉识别
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
使用场景：手写或复杂排版，正则无法识别

借鉴代码（learning_resources.py）：
  ```
  resp = create_chat_completion(
      model="gpt-5.2",
      messages=[
          {"role": "system", "content": "..."},
          {"role": "user", "content": [
              {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{img_b64}"}}
          ]}
      ],
      temperature=0.0,
  )
  ```

复用场景（question_splitter.py）：
  - QuestionDetector.detect_by_llm() 中的图片分析
  - 返回结构化 JSON 而不是自由文本
"""


# ============================================================================
# 3. 集成到 AutoGrader 的建议修改
# ============================================================================

"""
修改 1：在 AutoGrader/__init__.py 中导出新类
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
from .question_splitter import DocumentSplitter, QuestionDetector, QuestionSplitter

__all__ = [
    ...
    "DocumentSplitter",
    "QuestionDetector", 
    "QuestionSplitter",
]


修改 2：预处理阶段（新增 preprocessor.py）
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
from .question_splitter import DocumentSplitter
from .models import DocumentBundle, GradeTaskItem

async def preprocess_task_for_grading(task: GradeTaskItem) -> List[GradeTaskItem]:
    '''将原始任务分割成细粒度的题目任务'''
    
    # 1. 合并 bundle 的多个 source 为单个 PDF
    combined_pdf = combine_bundle_sources(task.student_bundle)
    
    # 2. 分割成题目级别的 PDF
    question_pdfs = await DocumentSplitter.split_pdf_by_questions(
        pdf_bytes=combined_pdf,
        detection_method="heuristic",  # 可配置
    )
    
    # 3. 为每个题目生成新的 task
    refined_tasks = []
    for i, q_pdf in enumerate(question_pdfs):
        q_bundle = DocumentBundle(
            bundle_id=f"{task.student_bundle.bundle_id}_q{i+1}",
            kind=task.student_bundle.kind,
            sources=[SourceItem(
                source_type=SourceType.PDF,
                uri=f"<binary-pdf-{i+1}>",
                mime_type="application/pdf",
            )],
        )
        refined_task = GradeTaskItem(
            paper_id=f"{task.paper_id}_q{i+1}",
            student_bundle=q_bundle,
            answer_bundle=task.answer_bundle,  # 保留原始答案卷
            metadata={**task.metadata, "question_index": i+1}
        )
        refined_tasks.append(refined_task)
    
    return refined_tasks


修改 3：在 inmemory.py 的 _run_job() 中使用预处理
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
async def _run_job(self, job_id: str, items: list[GradeTaskItem]) -> None:
    # ... existing code ...
    
    # 预处理：分割成题级别任务
    refined_items = []
    for item in items:
        refined = await preprocess_task_for_grading(item)
        refined_items.extend(refined)
    
    # 然后评分
    for item in refined_items:
        result = self._grade_one(item)
        # ...
"""


# ============================================================================
# 4. 常见问题 & 故障排除
# ============================================================================

"""
Q1: 如何处理没有题号的页面？
A1: detect_by_heuristic() 会返回空列表，此时保留整页作为一个"题"

Q2: 如何处理手写题号？
A2: 使用 detect_by_llm()，但需要 API 配额，考虑添加缓存

Q3: 如何处理多列排版？
A3: 当前版本基于纵坐标分割，多列时可能失效
    建议：
    - 方案 A：预处理时旋转/合并多列
    - 方案 B：使用 LLM 并增加 top_percent 精度

Q4: 如何验证分割结果？
A4: 保存每个 question_pdf，手动检查几份看看切割边界是否合理
    建议添加单元测试对比原始与分割后的内容

Q5: 性能问题？
A5: 启发式检测快速（正则匹配），LLM 需等待 API
    建议：缓存已分割的 PDF key，避免重复处理
"""


# ============================================================================
# 5. 下一步任务
# ============================================================================

"""
短期（已完成）：
  ✓ 设计文档 SPLITTING_DESIGN.md
  ✓ question_splitter.py 核心实现
  ✓ 两种检测方式（启发式 + LLM）

中期（建议）：
  → 单元测试：test_question_splitter.py
    覆盖：正常页面、多列、手写、无序号等
  
  → 集成测试：test_integration.py
    验证从原始 PDF → 分割 → 评分的完整流程
  
  → 预处理模块：preprocessor.py
    连接 DocumentSplitter 和 AutoGrader

长期（可选）：
  → 表格检测（tabula-py）
  → 页面方向检测和纠正（pytesseract + OpenCV）
  → 题目分组（检测"第一题"、"第二题"等分组）
"""
