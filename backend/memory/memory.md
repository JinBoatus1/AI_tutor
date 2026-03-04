# Memory 模块对外接口规范（Usage Spec）

本文档说明 `backend.memory` 的标准使用方式。当前对外最小能力为：`open_memory`、`write`、`read`。

---

## 1. 导入与创建实例

### 函数签名

```python
open_memory(root: str | pathlib.Path, book_id: str) -> Memory
```

### 参数

- `root`：数据落盘根目录（建议使用项目内固定目录，如 `./backend/data/memory`）
- `book_id`：一本教材/书的唯一标识（如 `"calculus"`、`"ml_textbook"`）

### 返回

- `Memory` 实例（至少支持 `write/read`）

### 示例

```python
from backend.memory import open_memory

mem = open_memory("./backend/data/memory", book_id="calculus")
```

---

## 2. 写入（write）

### 函数签名

```python
Memory.write(address: str, content: str) -> int
```

### 参数

- `address`：教材目录相对路径，例如 `chapter_01/section_02/unit_03`
- `content`：要写入的纯文本（`str`）

### 返回值（状态码 `int`）

- `Status.OK == 1`：成功
- `Status.NOT_FOUND == 0`：一般不用于 `write`（保留）
- `Status.IO_ERROR == -1`：I/O 或未知错误
- `Status.INVALID_ADDRESS == -2`：`address` 不合法
- `Status.INVALID_PARAM == -3`：参数类型不合法（如 `content` 不是 `str`）

### 行为说明

- `write` 为追加写：每次调用都会在对应单元流追加一条 JSONL 记录
- 每条记录会自动生成 `id` 和时间字段
- `write` 仅返回状态码，不返回 `id`

### 示例

```python
from backend.memory import Status

unit = "chapter_01/section_02/unit_03"
st = mem.write(unit, "我不懂链式法则")
assert st == Status.OK
```

---

## 3. 读取（read）

### 函数签名

```python
Memory.read(address: str) -> tuple[int, list[dict]]
```

### 参数

- `address`：同 `write` 的地址规则

### 返回

- `status: int`：状态码（同上）
- `records: list[dict]`：该地址下全部记录（按写入顺序）

### `records` 最小字段保证（当前实现）

```python
{
  "id": str,        # 唯一记录 id（uuid4 hex）
  "ts": str,        # ISO UTC 时间，如 "2026-02-27T22:00:00Z"
  "t": int,         # epoch seconds（用于时间检索）
  "content": str    # 写入的纯文本
  # summary 记录可能额外包含 "source_ids": list[str]
}
```

### 示例

```python
from backend.memory import Status

st, events = mem.read("chapter_01/section_02/unit_03")
if st == Status.OK and events:
    print(events[-1]["id"], events[-1]["content"])
```

---

## 4. Summary 支持（仍然仅用 read/write）

### 地址约定（必须遵守）

- 写/读 summary：在单元地址后追加 `/__summary__`
- 例如：`chapter_01/section_02/unit_03/__summary__`

### 写入 summary

```python
sum_addr = unit + "/__summary__"
mem.write(sum_addr, "本节要点：链式法则用于复合函数求导。")
```

### 读取 summary

```python
from backend.memory import Status

st, summaries = mem.read(sum_addr)
latest = summaries[-1]["content"] if (st == Status.OK and summaries) else ""
```

### 说明

- summary 同样是追加写
- `read(sum_addr)` 返回的是 summary 历史版本列表
- 默认取最后一条作为最新 summary