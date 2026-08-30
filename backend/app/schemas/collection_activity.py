from datetime import date

from pydantic import BaseModel, Field


class CollectionActivityCreate(BaseModel):
    actor: str = Field(
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

    successful: bool = False

    notes: str | None = Field(
        default=None,
        max_length=5000,
    )

    next_action: str | None = Field(
        default=None,
        max_length=150,
    )

    next_action_date: date | None = None
