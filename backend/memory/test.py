# AI_TUTOR/backend/memory/test.py
from __future__ import annotations

import os
import sys
import time
import shutil
import tempfile
from pathlib import Path
from typing import Any, Optional


# ----------- 确保能从项目根目录导入 backend.* -----------
THIS_FILE = Path(__file__).resolve()
PROJECT_ROOT = THIS_FILE.parents[2]  # .../AI_TUTOR
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from backend.memory import open_memory, Status  # noqa: E402


# ----------- 简单断言工具 -----------
class TestFailure(Exception):
    pass


def assert_true(cond: bool, msg: str) -> None:
    if not cond:
        raise TestFailure(msg)


def assert_eq(a: Any, b: Any, msg: str) -> None:
    if a != b:
        raise TestFailure(f"{msg} | got={a!r}, expected={b!r}")


def print_ok(name: str) -> None:
    print(f"[OK] {name}")


def main() -> int:
    keep = os.environ.get("MEMORY_TEST_KEEP", "0") == "1"
    tmp_root = Path(tempfile.mkdtemp(prefix="memory_test_")).resolve()
    book_id = "test_book"
    mem = open_memory(tmp_root, book_id=book_id)

    unit1 = "chapter_01/section_01/unit_01"
    unit2 = "chapter_01/section_01/unit_02"
    sum1 = unit1 + "/__summary__"

    try:
        # 0) 非法地址测试
        st = mem.write("../bad", "x")
        assert_eq(st, Status.INVALID_ADDRESS, "非法地址应返回 INVALID_ADDRESS")
        st, recs = mem.read("../bad")
        assert_eq(st, Status.INVALID_ADDRESS, "非法地址 read 应返回 INVALID_ADDRESS")
        print_ok("invalid address")

        # 1) write(events) & read(events) by address
        st = mem.write(unit1, "U1: user says hello")
        assert_eq(st, Status.OK, "write(unit1) should OK")
        st = mem.write(unit1, "U1: assistant replies hi")
        assert_eq(st, Status.OK, "write(unit1) should OK")
        st = mem.write(unit2, "U2: another unit message")
        assert_eq(st, Status.OK, "write(unit2) should OK")

        st, events_u1 = mem.read(unit1)
        assert_eq(st, Status.OK, "read(unit1) should OK")
        assert_true(len(events_u1) >= 2, "unit1 应至少 2 条记录")
        assert_true("id" in events_u1[-1], "记录应包含 id")
        assert_true("ts" in events_u1[-1], "记录应包含 ts")
        assert_true("content" in events_u1[-1], "记录应包含 content")
        print_ok("write/read events")

        # 拿到一些 id 作为后续 source_ids / get_by_id 的测试样本
        id1 = events_u1[-2]["id"]
        id2 = events_u1[-1]["id"]

        # 2) 写 summary：两种方式
        # 2.1 通过地址写（unit/__summary__）
        st = mem.write(sum1, "Summary v1: key points...")
        assert_eq(st, Status.OK, "write(summary via address) should OK")

        st, summaries = mem.read(sum1)
        assert_eq(st, Status.OK, "read(summary via address) should OK")
        assert_true(len(summaries) >= 1, "summary 至少 1 条")
        print_ok("summary via address")

        # 2.2 通过增强接口 write_summary（带 source_ids）
        if hasattr(mem, "write_summary"):
            st = mem.write_summary(unit1, "Summary v2: with sources", source_ids=[id1, id2])
            assert_eq(st, Status.OK, "write_summary should OK")

            st, summaries2 = mem.read(sum1)
            assert_eq(st, Status.OK, "read(summary) should OK after write_summary")
            last = summaries2[-1]
            assert_true(last.get("content") == "Summary v2: with sources", "latest summary content mismatch")
            assert_true("source_ids" in last and last["source_ids"] == [id1, id2], "source_ids mismatch")
            print_ok("write_summary with source_ids")
        else:
            print("[SKIP] write_summary not implemented on this backend")

        # 3) read_latest_summary
        if hasattr(mem, "read_latest_summary"):
            st, latest = mem.read_latest_summary(unit1)
            assert_eq(st, Status.OK, "read_latest_summary should OK")
            assert_true(latest is not None and "content" in latest, "latest summary should exist")
            print_ok("read_latest_summary")
        else:
            print("[SKIP] read_latest_summary not implemented on this backend")

        # 4) get_by_id（全局精确检索）
        if hasattr(mem, "get_by_id"):
            st, rec = mem.get_by_id(id2)
            assert_eq(st, Status.OK, "get_by_id should OK")
            assert_true(rec is not None and rec.get("id") == id2, "get_by_id returned wrong record")
            print_ok("get_by_id")
        else:
            print("[SKIP] get_by_id not implemented on this backend")

        # 5) query_by_time（全局/单元；events/summary）
        if hasattr(mem, "query_by_time"):
            now = int(time.time())
            t0, t1 = now - 60, now + 60

            # 5.1 全局：不限定 stream
            st, rs = mem.query_by_time(t0, t1, limit=100)
            assert_eq(st, Status.OK, "global query_by_time should OK")
            assert_true(len(rs) >= 3, "全局时间窗应包含至少 events 写入的记录")
            print_ok("query_by_time global")

            # 5.2 单元 events
            st, rs_u1 = mem.query_by_time(t0, t1, address=unit1, stream="events", limit=100)
            assert_eq(st, Status.OK, "unit events query_by_time should OK")
            assert_true(any(r.get("id") == id2 for r in rs_u1), "unit events time query missing expected record")
            print_ok("query_by_time unit events")

            # 5.3 单元 summary
            st, rs_sum = mem.query_by_time(t0, t1, address=unit1, stream="summary", limit=100)
            assert_eq(st, Status.OK, "unit summary query_by_time should OK")
            assert_true(len(rs_sum) >= 1, "unit summary time query should include summaries")
            print_ok("query_by_time unit summary")
        else:
            print("[SKIP] query_by_time not implemented on this backend")

        # 6) rebuild_unit_index（删除索引后重建）
        if hasattr(mem, "rebuild_unit_index"):
            # 找到索引文件路径：根据实现约定 events.index.jsonl / summary.index.jsonl
            base = tmp_root / book_id / unit1
            ev_idx = base / "events.index.jsonl"
            sm_idx = base / "summary.index.jsonl"
            if ev_idx.exists():
                ev_idx.unlink()
            if sm_idx.exists():
                sm_idx.unlink()

            st = mem.rebuild_unit_index(unit1, stream="events")
            assert_eq(st, Status.OK, "rebuild_unit_index(events) should OK")

            st = mem.rebuild_unit_index(unit1, stream="summary")
            # 若没有 summary 文件可能 NOT_FOUND；但我们之前写过 summary，应该 OK
            assert_eq(st, Status.OK, "rebuild_unit_index(summary) should OK")

            assert_true(ev_idx.exists(), "events.index.jsonl should exist after rebuild")
            assert_true(sm_idx.exists(), "summary.index.jsonl should exist after rebuild")
            print_ok("rebuild_unit_index")
        else:
            print("[SKIP] rebuild_unit_index not implemented on this backend")

        # 7) rebuild_global_index（删除后重建）
        if hasattr(mem, "rebuild_global_index") and hasattr(mem, "get_by_id"):
            gidx = tmp_root / book_id / "_global_index.jsonl"
            if gidx.exists():
                gidx.unlink()

            st = mem.rebuild_global_index()
            assert_eq(st, Status.OK, "rebuild_global_index should OK")
            assert_true(gidx.exists(), "_global_index.jsonl should exist after rebuild")

            # 重建后再按 id 查一次
            st, rec = mem.get_by_id(id2)
            assert_eq(st, Status.OK, "get_by_id should still OK after global rebuild")
            assert_true(rec is not None and rec.get("id") == id2, "record mismatch after rebuild_global_index")
            print_ok("rebuild_global_index + get_by_id")
        else:
            print("[SKIP] rebuild_global_index or get_by_id not implemented on this backend")

        print("\nALL TESTS PASSED ✅")
        return 0

    except TestFailure as e:
        print("\nTEST FAILED ❌")
        print("Reason:", e)
        print("Data dir kept at:", tmp_root)
        return 1

    except Exception as e:
        print("\nTEST ERROR ❌")
        print("Unexpected exception:", repr(e))
        print("Data dir kept at:", tmp_root)
        return 2

    finally:
        if not keep:
            # 只有在完全不需要保留测试数据时清理
            # 注意：如果失败，会提前 return，finally 仍会执行；所以我们在失败时默认不清理（见上面 return）
            # 这里通过 keep 环境变量控制；你也可以改成“成功才清理”
            shutil.rmtree(tmp_root, ignore_errors=True)


if __name__ == "__main__":
    # 默认：成功后也不自动删（便于你检查生成的 jsonl）
    # 想自动删：运行前设置 MEMORY_TEST_KEEP=0 并在 finally 里加清理逻辑
    exit_code = main()
    
    raise SystemExit(exit_code)