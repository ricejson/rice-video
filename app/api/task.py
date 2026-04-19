from fastapi import APIRouter

router = APIRouter(prefix="/api/task", tags=["task"])


@router.get("/list")
async def list_tasks():
    """获取任务列表（预留）"""
    return {"code": 0, "message": "success", "data": []}
