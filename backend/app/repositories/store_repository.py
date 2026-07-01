from __future__ import annotations

from typing import Any

from app.repositories.base import BaseRepository


class StoreRepository(BaseRepository):
    def __init__(self, db: Any | None) -> None:
        super().__init__(db, "stores")
