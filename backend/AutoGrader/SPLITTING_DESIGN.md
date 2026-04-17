"""
AutoGrader PDF/Image Processing Strategy

基于现有 learning_resources.py 的关键方法，设计"将输入PDF或多张图片裁剪成一道题一页PDF"的流程。
"""

# ============================================================================
# 现有代码可复用的关键方法
# ============================================================================

"""
FROM learning_resources.py:

1. render_pdf_page_to_base64(pdf_bytes, page_num_1based, dpi)
   - 将PDF指定页转为PNG base64
   - 用途：获取页面底层像素数据
   - 关键：支持 dpi=120 渲染

2. extract_pdf_pages_text(pdf_bytes, start_page, end_page, max_chars)
   - 提取PDF页码范围的文本（OCR fallback）
   - 用途：获取页面文本内容用于题目检测
   - 关键：支持 pytesseract OCR fallback

3. page.get_text("blocks", sort=True)
   - 获取页面的块信息（段落、文本框）
   - 返回：[(x0,y0,x1,y1,text,block_type,...), ...]
   - 用途：定位文本和题目边界

4. page.get_pixmap(dpi=120, clip=rect)
   - 根据 rect(x0,y0,x1,y1) 裁剪页面区域为图片
   - 用途：提取指定区域的图片内容
   - 关键：padding 扩展 + 坐标计算

5. 段落合并逻辑（PARAGRAPH_GAP_PT）
   - 垂直间距 < 14pt 的块视为同一段
   - 用途：避免题目被切碎
"""

# ============================================================================
# 新设计：题目分割 & 裁剪流程
# ============================================================================

"""
目标：输入 PDF 或 多张图片 → 输出 后处理的 PDF 集合（一题一页）

步骤 1：输入规范化
  - PDF 直接保留原样
  - 多张图片：合并成临时 PDF（PIL Image → PDF）
  → 返回标准化的 PDF bytes + 原始元数据

步骤 2：题目检测 & 分割
  方案 A（启发式）：
    - 使用 OCR 获取每页文本
    - 按题号正则匹配（"1.", "2.", "(1)", etc）找分割点
    - 按纵坐标 y0 排序，划分题目区域
    
  方案 B（LLM 辅助）：
    - 将页面渲染为图片
    - 送给 LLM "这个页面有几个题目？分别在哪里？"
    - LLM 返回题目数量和大致位置

步骤 3：区域裁剪 & 重组
  - 对每个检测到的题目区域：
    - 提取 bbox（x0, y0, x1, y1）
    - 使用 page.get_pixmap(clip=rect) 裁剪
    - 转换为 PDF 页面
  - 汇总成新 PDF：1 题 = 1 页

步骤 4：输出
  - DocumentBundle 中的 sources 变为细粒度 PDF list
  - 每个 SourceItem 对应一个题目页面
"""

# ============================================================================
# 实现框架建议
# ============================================================================

"""
AutoGrader/question_splitter.py（新增模块）

关键类与方法：

class QuestionDetector:
    '''检测页面中的题目'''
    def detect_questions_heuristic(page, text) -> List[Tuple[str, float]]
        # 返回 [(题号, y0_坐标), ...]
    
    def detect_questions_llm(page_image) -> List[Dict]
        # 返回 [{title, bbox}, ...]

class QuestionSplitter:
    '''负责裁剪和重组'''
    def split_pdf_by_questions(pdf_bytes) -> List[bytes]
        # 返回：[pdf_page_for_q1, pdf_page_for_q2, ...]
    
    def combine_images_to_pdf(image_list) -> bytes
        # 返回：合并后的单页 PDF

class DocumentSplitter:
    '''顶层：处理 DocumentBundle 的输入/输出'''
    async def split_bundle(bundle: DocumentBundle) -> List[DocumentBundle]
        # 输入：学生答卷 bundle
        # 返回：[题目1的bundle, 题目2的bundle, ...]
        #      每个 bundle 的 sources 中只有一个 SourceItem（一题一页PDF）
"""

# ============================================================================
# 代码示例：LLM 辅助题目检测
# ============================================================================

"""
def detect_questions_with_llm(page_image_b64: str, prompt_override: str = "") -> Dict[str, Any]:
    '''将页面图片送给LLM，让它识别题目数量和位置'''
    from deps import create_chat_completion
    
    system_msg = (
        "You are analyzing a test/exam paper. Count the number of questions on this page "
        "and estimate their vertical positions (top to bottom). "
        "Return a JSON: {\"count\": int, \"questions\": [{\"number\": str, \"top_percent\": 0-100}]}"
    )
    
    user_msg = prompt_override or (
        "How many questions are on this page? List their approximate vertical positions (0=top, 100=bottom)."
    )
    
    resp = create_chat_completion(
        model="gpt-5.2",
        messages=[
            {"role": "system", "content": system_msg},
            {"role": "user", "content": [
                {"type": "text", "text": user_msg},
                {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{page_image_b64}"}}
            ]},
        ],
        temperature=0.0,
    )
    
    raw = resp.choices[0].message.content
    # 解析 JSON...
    return parsed_result

"""

# ============================================================================
# 集成到 AutoGrader 的建议修改点
# ============================================================================

"""
1. 预处理阶段（在 grader.py 或新的 preprocessor.py）：
   输入：GradeTaskItem（bundle 中有原始 PDF/图片）
      ↓
   question_splitter.split_bundle(task.student_bundle)
      ↓
   输出：细化的 tasks 列表，每个 task 对应一道题
        [
          GradeTaskItem(paper_id="paper-001_q1", student_bundle=...),
          GradeTaskItem(paper_id="paper-001_q2", student_bundle=...),
          ...
        ]

2. 后续评分流程基于细化后的 tasks 进行

3. 可选：在 _grade_one() 中增加细粒度检测
   - 检查 bundle 的 sources 是否已是"一题一页"格式
   - 若否，自动调用 splitter
"""

# ============================================================================
# 优先级建议
# ============================================================================

"""
短期（MVP）：
  ✓ 保留现有 MVP（固定分数评分）
  → 新增 question_splitter.py（启发式题号检测）
  → 连接到 AutoGrader 流程

中期（Enhanced）：
  → LLM 辅助题目检测
  → 支持图像-文本混合页面
  → 边界处理和异常恢复

长期（Production）：
  → 多语言题号识别
  → 复杂表格/图表检测
  → 题目关联性处理（多选题组等）
"""
