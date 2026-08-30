from pydantic import BaseModel, Field


class CaseAssignment(BaseModel):
    collector: str = Field(
        min_length=1,
        max_length=150,
    )

    actor: str = Field(
        min_length=1,
        max_length=150,
    )
