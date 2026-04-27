from __future__ import annotations

from enum import IntEnum
from pathlib import Path
from typing import List, Optional, Protocol, Tuple, TypedDict, Union


class Status(IntEnum):
    OK = 1
    NOT_FOUND = 0
    IO_ERROR = -1
    INVALID_ADDRESS = -2
    INVALID_PARAM = -3


class DeleteMode(IntEnum):
    PATH = 1
    NON_SUMMARY_JSON = 2


class MemoryRecord(TypedDict):
    id: Optional[str]
    time: Union[str, int, None]
    content: Optional[str]


class Memory(Protocol):
    """Public contract for read/write/delete operations."""

    def write(self, address: str, content: str) -> int:
        ...

    def read(self, address: str) -> Tuple[int, List[MemoryRecord]]:
        ...

    def delete(self, address: str, mode: Union[str, DeleteMode] = DeleteMode.PATH) -> int:
        ...


def open_memory(root: Union[str, Path], book_id: str):
    """
    Factory function: lets us swap the storage backend later without changing upper layers.
    """
    from .stores.jsonl_store import JsonlMemoryStore  # Lazy import to avoid circular dependencies
    return JsonlMemoryStore(root=root, book_id=book_id)