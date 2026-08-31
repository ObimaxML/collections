from pydantic import BaseModel, Field


class PaymentImportMapping(BaseModel):
    tenant_id: str | None = None
    account_number: str | None = None
    amount: str | None = None
    payment_date: str | None = None
    external_reference: str | None = None


class PaymentImportMappingRequest(BaseModel):
    mapping: PaymentImportMapping


class PaymentImportMappingResponse(BaseModel):
    filename: str
    rows: int
    columns: list[str]
    suggested_mapping: dict[str, str]
    mapping_details: list[dict] | None = None
    unmapped_columns: list[str]
    available_targets: list[str]


class PaymentImportApproval(BaseModel):
    approved: bool = Field(
        ...,
        description="Explicit operator approval",
    )

    approved_by: str = Field(
        min_length=1,
        max_length=150,
    )

    confirmation: str = Field(
        min_length=1,
        max_length=100,
    )
