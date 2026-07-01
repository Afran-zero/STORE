from __future__ import annotations

from typing import Any

from app.services.base import BaseService


class AssignmentService(BaseService):
    async def placeholder(self, data: Any = None, *, message: str = "Assignment module placeholder") -> dict[str, Any]:
        return await super().placeholder(data, message=message)
