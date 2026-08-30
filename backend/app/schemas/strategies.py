from pydantic import BaseModel


class StrategyResponse(BaseModel):
    code: str
    name: str
    description: str
    recommended_actions: list[str]
    follow_up_days: int
    escalation_days: int
