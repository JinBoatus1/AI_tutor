from __future__ import annotations

import json
import os
import re
import time
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple, Union

from ..memory import Status


# =============== 约定 ===============
SUMMARY_SEG = "__summary__"  # address 后缀：/<unit>/__summary__ 代表 summary 流
_ALLOWED_ADDR = re.compile(r"^[A-Za-z0-9_\-/]+$")


def _iso_utc_now() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


def _to_epoch_seconds(x: Union[int, float, str, datetime]) -> int:
    """
    支持：
    - int/float: epoch seconds
    - str: ISO8601（支持 Z）
    - datetime: naive 视为 UTC
    """
    if isinstance(x, (int, float)):
        return int(x)

    if isinstance(x, datetime):
        dt = x
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return int(dt.timestamp())

    if isinstance(x, str):
        s = x.strip()
        if s.endswith("Z"):
            s = s[:-1] + "+00:00"
        # 允许只给日期
        try:
            dt = datetime.fromisoformat(s)
        except ValueError:
            dt = datetime.fromisoformat(s + "T00:00:00+00:00")
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return int(dt.timestamp())

    raise TypeError(f"Unsupported time type: {type(x)}")


@dataclass(frozen=True)
class _Loc:
    address: str
    stream: str     # "events" | "summary"
    offset: int
    length: int


class JsonlMemoryStore:
    """
    纯文本 JSONL 记忆存储（含临时索引）：

    每个 unit 目录：
      events.jsonl
      summary.jsonl
      events.index.jsonl
      summary.index.jsonl

    book 根目录：
      _global_index.jsonl   # 全局索引：支持按 id/time 查询

    对外：只要求 read/write，但本类额外提供增强检索方法：
      - get_by_id(record_id)
      - query_by_time(start, end, address=None, stream=None, limit=None)
      - write_summary(unit_address, summary_text, source_ids=None)
      - rebuild_unit_index(unit_address, stream)
      - rebuild_global_index()
    """

    def __init__(self, root: Union[str, Path], book_id: str, fsync: bool = False):
        self.root = Path(root).expanduser().resolve()
        self.base = (self.root / book_id).resolve()
        self.base.mkdir(parents=True, exist_ok=True)

        self._fsync = fsync
        self._id_cache: Dict[str, _Loc] = {}
        self._id_cache_loaded = False

    # ---------------------------
    # Address / Path
    # ---------------------------
    def _validate_address(self, address: str) -> Optional[str]:
        address = address.strip().strip("/")
        if not address:
            return None
        if not _ALLOWED_ADDR.match(address):
            return None
        parts = address.split("/")
        if any(p in ("..", ".", "") for p in parts):
            return None
        return address

    def _split_stream(self, address: str) -> Tuple[str, str]:
        """
        返回 (unit_address, stream)：
          - address=unit => ("unit","events")
          - address=unit/__summary__ => ("unit","summary")
        """
        addr = address.strip().strip("/")
        if addr == SUMMARY_SEG:
            raise ValueError("summary must belong to a unit address")
        if addr.endswith("/" + SUMMARY_SEG):
            unit = addr[: -len(SUMMARY_SEG)].rstrip("/")
            if not unit:
                raise ValueError("summary must belong to a unit address")
            return unit, "summary"
        return addr, "events"

    def _unit_dir(self, unit_address: str) -> Path:
        p = (self.base / unit_address).resolve()
        if p != self.base and self.base not in p.parents:
            raise ValueError("path traversal detected")
        p.mkdir(parents=True, exist_ok=True)
        return p

    def _data_path(self, unit_address: str, stream: str) -> Path:
        d = self._unit_dir(unit_address)
        if stream == "events":
            return d / "events.jsonl"
        if stream == "summary":
            return d / "summary.jsonl"
        raise ValueError("unknown stream")

    def _index_path(self, unit_address: str, stream: str) -> Path:
        d = self._unit_dir(unit_address)
        if stream == "events":
            return d / "events.index.jsonl"
        if stream == "summary":
            return d / "summary.index.jsonl"
        raise ValueError("unknown stream")

    def _global_index_path(self) -> Path:
        return (self.base / "_global_index.jsonl").resolve()

    # ---------------------------
    # Low-level IO helpers
    # ---------------------------
    def _append_bytes(self, path: Path, payload: bytes) -> Tuple[int, int]:
        """
        以二进制追加写，返回 (offset, length)。
        """
        path.parent.mkdir(parents=True, exist_ok=True)
        with path.open("ab") as f:
            offset = f.tell()
            f.write(payload)
            f.flush()
            if self._fsync:
                os.fsync(f.fileno())
        return offset, len(payload)

    def _read_at(self, unit_address: str, stream: str, offset: int, length: int) -> Optional[Dict[str, Any]]:
        p = self._data_path(unit_address, stream)
        if not p.exists():
            return None
        with p.open("rb") as f:
            f.seek(offset)
            raw = f.read(length)
        try:
            return json.loads(raw.decode("utf-8"))
        except Exception:
            return None

    # ---------------------------
    # Public API: ONLY read/write
    # ---------------------------
    def write(self, address: str, content: str) -> int:
        """
        写入一条记录（events 或 summary），同时维护：
        - unit stream index
        - global index
        """
        addr = self._validate_address(address)
        if addr is None:
            return Status.INVALID_ADDRESS
        if not isinstance(content, str):
            return Status.INVALID_PARAM

        try:
            unit, stream = self._split_stream(addr)

            rec: Dict[str, Any] = {
                "id": uuid.uuid4().hex,
                "ts": _iso_utc_now(),
                "t": int(time.time()),  # epoch seconds for time query
                "content": content,
            }
            line = (json.dumps(rec, ensure_ascii=False) + "\n").encode("utf-8")

            data_path = self._data_path(unit, stream)
            offset, length = self._append_bytes(data_path, line)

            # unit index
            uidx = {"id": rec["id"], "t": rec["t"], "offset": offset, "len": length}
            self._append_bytes(self._index_path(unit, stream),
                               (json.dumps(uidx, ensure_ascii=False) + "\n").encode("utf-8"))

            # global index
            gidx = {
                "id": rec["id"],
                "t": rec["t"],
                "address": unit,     # 注意：这里存 unit 地址，不带 __summary__
                "stream": stream,
                "offset": offset,
                "len": length,
            }
            self._append_bytes(self._global_index_path(),
                               (json.dumps(gidx, ensure_ascii=False) + "\n").encode("utf-8"))

            # 更新内存 cache（写入后立刻可按 id 查）
            self._id_cache[rec["id"]] = _Loc(unit, stream, offset, length)
            return Status.OK

        except Exception:
            return Status.IO_ERROR

    def read(self, address: str) -> Tuple[int, List[Dict[str, Any]]]:
        """
        按 address 读取全部记录：
          - unit => events.jsonl
          - unit/__summary__ => summary.jsonl
        """
        addr = self._validate_address(address)
        if addr is None:
            return (Status.INVALID_ADDRESS, [])

        try:
            unit, stream = self._split_stream(addr)
            path = self._data_path(unit, stream)
            if not path.exists():
                return (Status.NOT_FOUND, [])

            out: List[Dict[str, Any]] = []
            with path.open("r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        out.append(json.loads(line))
                    except json.JSONDecodeError:
                        continue

            return (Status.OK, out)

        except Exception:
            return (Status.IO_ERROR, [])

    # ---------------------------
    # Enhanced: summary with source_ids (future-proof)
    # ---------------------------
    def write_summary(self, unit_address: str, summary_text: str, source_ids: Optional[List[str]] = None) -> int:
        """
        summary 的增强写入：允许附带 source_ids
        仍然写到 unit/__summary__ 流里（summary.jsonl）。
        """
        addr = self._validate_address(unit_address)
        if addr is None:
            return Status.INVALID_ADDRESS
        if not isinstance(summary_text, str):
            return Status.INVALID_PARAM

        # 手动组装记录，然后走同样的写入逻辑
        try:
            unit = addr
            stream = "summary"
            rec: Dict[str, Any] = {
                "id": uuid.uuid4().hex,
                "ts": _iso_utc_now(),
                "t": int(time.time()),
                "content": summary_text,
            }
            if source_ids:
                rec["source_ids"] = list(source_ids)

            line = (json.dumps(rec, ensure_ascii=False) + "\n").encode("utf-8")

            data_path = self._data_path(unit, stream)
            offset, length = self._append_bytes(data_path, line)

            uidx = {"id": rec["id"], "t": rec["t"], "offset": offset, "len": length}
            self._append_bytes(self._index_path(unit, stream),
                               (json.dumps(uidx, ensure_ascii=False) + "\n").encode("utf-8"))

            gidx = {"id": rec["id"], "t": rec["t"], "address": unit, "stream": stream, "offset": offset, "len": length}
            self._append_bytes(self._global_index_path(),
                               (json.dumps(gidx, ensure_ascii=False) + "\n").encode("utf-8"))

            self._id_cache[rec["id"]] = _Loc(unit, stream, offset, length)
            return Status.OK
        except Exception:
            return Status.IO_ERROR

    def read_latest_summary(self, unit_address: str) -> Tuple[int, Optional[Dict[str, Any]]]:
        """
        读某单元最新 summary（最后一条）。
        """
        st, summaries = self.read(unit_address.strip().strip("/") + "/__summary__")
        if st != Status.OK or not summaries:
            return (st, None)
        return (Status.OK, summaries[-1])

    # ---------------------------
    # Enhanced: ID / Time search
    # ---------------------------
    def _load_id_cache_once(self) -> None:
        if self._id_cache_loaded:
            return
        self._id_cache_loaded = True

        p = self._global_index_path()
        if not p.exists():
            return

        try:
            with p.open("r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        obj = json.loads(line)
                        rid = obj.get("id")
                        addr = obj.get("address")
                        stream = obj.get("stream")
                        off = obj.get("offset")
                        ln = obj.get("len")
                        if (
                            isinstance(rid, str)
                            and isinstance(addr, str)
                            and stream in ("events", "summary")
                            and isinstance(off, int)
                            and isinstance(ln, int)
                        ):
                            self._id_cache[rid] = _Loc(addr, stream, off, ln)
                    except json.JSONDecodeError:
                        continue
        except Exception:
            # best-effort
            return

    def get_by_id(self, record_id: str) -> Tuple[int, Optional[Dict[str, Any]]]:
        """
        全局按 id 精确检索（依赖 _global_index.jsonl）。
        """
        if not isinstance(record_id, str) or not record_id.strip():
            return (Status.INVALID_PARAM, None)

        self._load_id_cache_once()
        loc = self._id_cache.get(record_id)
        if not loc:
            return (Status.NOT_FOUND, None)

        rec = self._read_at(loc.address, loc.stream, loc.offset, loc.length)
        if rec is None:
            return (Status.IO_ERROR, None)
        return (Status.OK, rec)

    def query_by_time(
        self,
        start: Union[int, float, str, datetime],
        end: Union[int, float, str, datetime],
        *,
        address: Optional[str] = None,
        stream: Optional[str] = None,  # None / "events" / "summary"
        limit: Optional[int] = None,
    ) -> Tuple[int, List[Dict[str, Any]]]:
        """
        按时间窗查询：
        - address=None: 扫全局索引 _global_index.jsonl
        - address=unit: 扫单元 stream 索引 events.index.jsonl / summary.index.jsonl
        - stream=None: 全局查询时不过滤；单元查询时默认 events
        """
        try:
            t0 = _to_epoch_seconds(start)
            t1 = _to_epoch_seconds(end)
        except Exception:
            return (Status.INVALID_PARAM, [])
        if t1 < t0:
            t0, t1 = t1, t0
        if limit is not None and (not isinstance(limit, int) or limit <= 0):
            return (Status.INVALID_PARAM, [])
        if stream is not None and stream not in ("events", "summary"):
            return (Status.INVALID_PARAM, [])

        out: List[Dict[str, Any]] = []

        # 选择索引文件
        if address is None:
            idx_path = self._global_index_path()
            if not idx_path.exists():
                return (Status.NOT_FOUND, [])
            try:
                with idx_path.open("r", encoding="utf-8") as f:
                    for line in f:
                        line = line.strip()
                        if not line:
                            continue
                        try:
                            obj = json.loads(line)
                        except json.JSONDecodeError:
                            continue

                        t = obj.get("t")
                        if not isinstance(t, int) or t < t0 or t > t1:
                            continue

                        s = obj.get("stream")
                        if stream is not None and s != stream:
                            continue

                        addr = obj.get("address")
                        off = obj.get("offset")
                        ln = obj.get("len")
                        if not (isinstance(addr, str) and s in ("events", "summary") and isinstance(off, int) and isinstance(ln, int)):
                            continue

                        rec = self._read_at(addr, s, off, ln)
                        if rec is not None:
                            out.append(rec)
                            if limit is not None and len(out) >= limit:
                                break

                return (Status.OK, out)
            except Exception:
                return (Status.IO_ERROR, [])

        # 单元内查询
        unit = self._validate_address(address)
        if unit is None:
            return (Status.INVALID_ADDRESS, [])
        s = stream or "events"
        idx_path = self._index_path(unit, s)
        if not idx_path.exists():
            return (Status.NOT_FOUND, [])

        try:
            with idx_path.open("r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        obj = json.loads(line)
                    except json.JSONDecodeError:
                        continue
                    t = obj.get("t")
                    if not isinstance(t, int) or t < t0 or t > t1:
                        continue
                    off = obj.get("offset")
                    ln = obj.get("len")
                    if not (isinstance(off, int) and isinstance(ln, int)):
                        continue
                    rec = self._read_at(unit, s, off, ln)
                    if rec is not None:
                        out.append(rec)
                        if limit is not None and len(out) >= limit:
                            break

            return (Status.OK, out)
        except Exception:
            return (Status.IO_ERROR, [])

    # ---------------------------
    # Index maintenance (临时索引可重建)
    # ---------------------------
    def rebuild_unit_index(self, unit_address: str, stream: str = "events") -> int:
        """
        从 events.jsonl / summary.jsonl 重建对应的 *.index.jsonl
        """
        unit = self._validate_address(unit_address)
        if unit is None:
            return Status.INVALID_ADDRESS
        if stream not in ("events", "summary"):
            return Status.INVALID_PARAM

        data = self._data_path(unit, stream)
        if not data.exists():
            return Status.NOT_FOUND

        idx = self._index_path(unit, stream)
        tmp = idx.with_suffix(".tmp")

        try:
            with data.open("rb") as fd, tmp.open("wb") as fi:
                while True:
                    offset = fd.tell()
                    line = fd.readline()
                    if not line:
                        break
                    length = len(line)
                    try:
                        obj = json.loads(line.decode("utf-8"))
                        rid = obj.get("id")
                        t = obj.get("t")
                        if not isinstance(rid, str):
                            continue
                        if not isinstance(t, int):
                            t = int(time.time())
                        rec = {"id": rid, "t": int(t), "offset": offset, "len": length}
                        fi.write((json.dumps(rec, ensure_ascii=False) + "\n").encode("utf-8"))
                    except Exception:
                        continue

            os.replace(tmp, idx)
            return Status.OK
        except Exception:
            try:
                if tmp.exists():
                    tmp.unlink()
            except Exception:
                pass
            return Status.IO_ERROR

    def rebuild_global_index(self) -> int:
        """
        重建 _global_index.jsonl：遍历所有 unit 下的 events.jsonl/summary.jsonl
        """
        g = self._global_index_path()
        tmp = g.with_suffix(".tmp")

        try:
            with tmp.open("wb") as fg:
                for data_file in self.base.rglob("*.jsonl"):
                    # 仅关心 events.jsonl / summary.jsonl
                    name = data_file.name
                    if name not in ("events.jsonl", "summary.jsonl"):
                        continue

                    stream = "events" if name == "events.jsonl" else "summary"
                    unit_dir = data_file.parent
                    try:
                        unit = str(unit_dir.relative_to(self.base)).replace("\\", "/")
                        if self._validate_address(unit) is None:
                            continue
                    except Exception:
                        continue

                    with data_file.open("rb") as fd:
                        while True:
                            offset = fd.tell()
                            line = fd.readline()
                            if not line:
                                break
                            length = len(line)
                            try:
                                obj = json.loads(line.decode("utf-8"))
                                rid = obj.get("id")
                                t = obj.get("t")
                                if not isinstance(rid, str):
                                    continue
                                if not isinstance(t, int):
                                    t = int(time.time())
                                gidx = {"id": rid, "t": int(t), "address": unit, "stream": stream, "offset": offset, "len": length}
                                fg.write((json.dumps(gidx, ensure_ascii=False) + "\n").encode("utf-8"))
                            except Exception:
                                continue

            os.replace(tmp, g)
            self._id_cache.clear()
            self._id_cache_loaded = False
            return Status.OK
        except Exception:
            try:
                if tmp.exists():
                    tmp.unlink()
            except Exception:
                pass
            return Status.IO_ERROR