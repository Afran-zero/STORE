from __future__ import annotations

from fastapi import APIRouter, status

from app.services.attendance_service import AttendanceService


router = APIRouter(prefix="/attendance", tags=["attendance"])
service = AttendanceService()


@router.post("/clock-in", status_code=status.HTTP_201_CREATED)
async def clock_in():
    return await service.placeholder({}, message="Clock-in scaffold")


@router.post("/clock-out", status_code=status.HTTP_201_CREATED)
async def clock_out():
    return await service.placeholder({}, message="Clock-out scaffold")


@router.get("")
async def list_attendance(userId: str | None = None, storeId: str | None = None, date: str | None = None):
    return await service.placeholder([], message="Attendance list scaffold")


@router.get("/{user_id}/history")
async def history(user_id: str):
    return await service.placeholder({"userId": user_id}, message="Attendance history scaffold")


@router.post("/leave-request", status_code=status.HTTP_201_CREATED)
async def leave_request():
    return await service.placeholder({}, message="Leave request scaffold")


@router.patch("/leave-request/{request_id}/approve")
async def approve_leave(request_id: str):
    return await service.placeholder({"requestId": request_id}, message="Leave approval scaffold")


@router.get("/employees/{employee_id}/performance")
async def employee_performance(employee_id: str):
    return await service.placeholder({"employeeId": employee_id}, message="Employee performance scaffold")


@router.get("/employees/{employee_id}/daily-target")
async def employee_daily_target(employee_id: str):
    return await service.placeholder({"employeeId": employee_id}, message="Employee target scaffold")


@router.put("/employees/{employee_id}/daily-target")
async def update_employee_daily_target(employee_id: str):
    return await service.placeholder({"employeeId": employee_id}, message="Update employee target scaffold")


@router.patch("/employees/{employee_id}/assign-store")
async def assign_employee_store(employee_id: str):
    return await service.placeholder({"employeeId": employee_id}, message="Assign employee store scaffold")
