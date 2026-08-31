from pydantic import BaseModel


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
