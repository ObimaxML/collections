from datetime import date

from pydantic import BaseModel, Field


class ContactAttemptCreate(BaseModel):
    collector: str = Field(
        min_length=1,
        max_length=150,
    )

    channel: str = Field(
        min_length=1,
        max_length=50,
    )

    outcome: str = Field(
        min_length=1,
        max_length=100,
    )

    notes: str | None = None

    next_action_date: date | None = None

    contacted: bool = False
