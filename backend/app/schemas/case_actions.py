from pydantic import BaseModel, Field


class CaseTransitionRequest(BaseModel):
    new_status: str = Field(
        min_length=1,
        max_length=50,
    )

    actor: str = Field(
        min_length=1,
        max_length=150,
    )

    reason: str | None = Field(
        default=None,
        max_length=1000,
    )
