from datetime import datetime, date, time
from pydantic import BaseModel, ConfigDict, Field, model_validator
from decimal import Decimal
from typing import ClassVar, Literal

class AuthSetupIn(BaseModel):
    name: str = Field(min_length=2, max_length=160)
    email: str = Field(min_length=5, max_length=160, pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
    password: str = Field(min_length=10, max_length=128)

class AuthLoginIn(BaseModel):
    email: str = Field(min_length=5, max_length=160, pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
    password: str = Field(min_length=1, max_length=128)

class AuthTechnicianRegisterIn(BaseModel):
    email: str = Field(min_length=5, max_length=160, pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
    password: str = Field(min_length=10, max_length=128)

class AuthUserOut(BaseModel):
    id: int
    name: str
    email: str
    role: str
    technician_id: int | None
    active: bool
    screen_permissions: list[str]
    model_config = ConfigDict(from_attributes=True)

class StrictPatch(BaseModel):
    model_config = ConfigDict(extra="forbid")
    nullable_fields: ClassVar[frozenset[str]] = frozenset()

    @model_validator(mode="after")
    def reject_null_for_required_fields(self):
        for field_name in self.model_fields_set:
            if getattr(self, field_name) is None and field_name not in self.nullable_fields:
                raise ValueError(f"{field_name} não pode ser nulo")
        return self

class ClientIn(BaseModel):
    name: str = Field(min_length=2, max_length=160)
    document: str | None = None
    phone: str | None = None
    email: str | None = None
    address: str | None = None

class ClientOut(ClientIn):
    id: int
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

class UnitIn(BaseModel):
    name: str = Field(min_length=2, max_length=160)
    sigla: str | None = Field(default=None, max_length=80)
    address: str = Field(min_length=3)
    contact_name: str | None = Field(default=None, max_length=120)
    phone: str | None = Field(default=None, max_length=40)

class UnitOut(UnitIn):
    id: int
    client_id: int
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

class UnitPatch(StrictPatch):
    nullable_fields: ClassVar[frozenset[str]] = frozenset({"sigla", "contact_name", "phone"})
    name: str | None = Field(default=None, min_length=2, max_length=160)
    sigla: str | None = Field(default=None, max_length=80)
    address: str | None = Field(default=None, min_length=3)
    contact_name: str | None = Field(default=None, max_length=120)
    phone: str | None = Field(default=None, max_length=40)

class TechnicianIn(BaseModel):
    name: str = Field(min_length=2, max_length=160)
    phone: str | None = Field(default=None, max_length=40)
    email: str | None = Field(default=None, max_length=160)
    active: bool = True
    screen_permissions: list[str] = Field(default_factory=list)

class TechnicianOut(TechnicianIn):
    id: int
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

class TechnicianPatch(StrictPatch):
    nullable_fields: ClassVar[frozenset[str]] = frozenset({"phone", "email"})
    name: str | None = Field(default=None, min_length=2, max_length=160)
    phone: str | None = Field(default=None, max_length=40)
    email: str | None = Field(default=None, max_length=160)
    active: bool | None = None
    screen_permissions: list[str] | None = None

class SupplierIn(BaseModel):
    name: str = Field(min_length=2, max_length=160)
    category: str | None = Field(default=None, max_length=80)
    document: str | None = Field(default=None, max_length=32)
    contact_name: str | None = Field(default=None, max_length=120)
    phone: str | None = Field(default=None, max_length=40)
    email: str | None = Field(default=None, max_length=160)
    address: str | None = None
    notes: str | None = None
    active: bool = True

class SupplierOut(SupplierIn):
    id: int
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

class SupplierPatch(StrictPatch):
    nullable_fields: ClassVar[frozenset[str]] = frozenset({"category", "document", "contact_name", "phone", "email", "address", "notes"})
    name: str | None = Field(default=None, min_length=2, max_length=160)
    category: str | None = Field(default=None, max_length=80)
    document: str | None = Field(default=None, max_length=32)
    contact_name: str | None = Field(default=None, max_length=120)
    phone: str | None = Field(default=None, max_length=40)
    email: str | None = Field(default=None, max_length=160)
    address: str | None = None
    notes: str | None = None
    active: bool | None = None

class UnitContactIn(BaseModel):
    name: str = Field(min_length=2, max_length=160)
    role: str = Field(pattern="^(lider|gerente|colaborador)$")
    phone: str | None = Field(default=None, max_length=40)
    email: str | None = Field(default=None, max_length=160)
    active: bool = True

class UnitContactOut(UnitContactIn):
    id: int
    unit_id: int
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

class UnitContactPatch(StrictPatch):
    nullable_fields: ClassVar[frozenset[str]] = frozenset({"phone", "email"})
    name: str | None = Field(default=None, min_length=2, max_length=160)
    role: Literal["lider", "gerente", "colaborador"] | None = None
    phone: str | None = Field(default=None, max_length=40)
    email: str | None = Field(default=None, max_length=160)
    active: bool | None = None

class TicketIn(BaseModel):
    title: str = Field(min_length=3, max_length=200)
    description: str | None = None
    priority: Literal["baixa", "normal", "alta", "urgente"] = "normal"
    status: Literal["aberto", "em atendimento", "concluido"] = "aberto"
    client_id: int | None = None
    unit_id: int | None = None

class TicketOut(TicketIn):
    id: int
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

class TicketPatch(StrictPatch):
    nullable_fields: ClassVar[frozenset[str]] = frozenset({"description", "client_id", "unit_id"})
    title: str | None = Field(default=None, min_length=3, max_length=200)
    description: str | None = None
    priority: Literal["baixa", "normal", "alta", "urgente"] | None = None
    status: Literal["aberto", "em atendimento", "concluido"] | None = None
    client_id: int | None = None
    unit_id: int | None = None

class WorkOrderIn(BaseModel):
    title: str = Field(min_length=3, max_length=200)
    description: str | None = None
    status: Literal["pendente", "em atendimento", "concluida", "cancelada"] = "pendente"
    scheduled_date: date | None = None
    scheduled_time: time | None = None
    service_type: Literal["corretiva", "instalacao", "manutencao", "preventiva"] | None = None
    address: str | None = None
    client_id: int | None = None
    unit_id: int | None = None
    technician_id: int | None = None
    technician_ids: list[int] = Field(default_factory=list)

class WorkOrderOut(WorkOrderIn):
    id: int
    ticket_id: int | None = None
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

class WorkOrderPatch(StrictPatch):
    nullable_fields: ClassVar[frozenset[str]] = frozenset({"description", "scheduled_date", "scheduled_time", "service_type", "address", "client_id", "unit_id", "technician_id"})
    title: str | None = Field(default=None, min_length=3, max_length=200)
    description: str | None = None
    status: Literal["pendente", "em atendimento", "concluida", "cancelada"] | None = None
    scheduled_date: date | None = None
    scheduled_time: time | None = None
    service_type: Literal["corretiva", "instalacao", "manutencao", "preventiva"] | None = None
    address: str | None = None
    client_id: int | None = None
    unit_id: int | None = None
    technician_id: int | None = None
    technician_ids: list[int] | None = None

class TicketWorkOrderIn(BaseModel):
    scheduled_date: date | None = None
    scheduled_time: time | None = None
    address: str | None = None
    technician_id: int | None = None

class WorkOrderChecklistIn(BaseModel):
    local: str | None = None
    sigla: str | None = None
    technician: str | None = None
    technician_id: int | None = None
    technician_ids: list[int] = Field(default_factory=list)
    whatsapp: str | None = None
    leader: str | None = None
    collaborator: str | None = None
    leader_contact_id: int | None = None
    collaborator_contact_id: int | None = None
    started_at: datetime | None = None
    finished_at: datetime | None = None
    result: Literal["pendente", "sucesso", "nao_realizado"] = "pendente"
    reason: str | None = None
    service_description: str | None = None
    material_needed: str | None = None
    photo_required: bool = True
    other_service: str | None = None
    services: list[str] = Field(default_factory=list)
    materials: list[dict[str, str]] = Field(default_factory=list)
    photos: list[dict[str, str]] = Field(default_factory=list)
    signatures: dict[str, str] = Field(default_factory=dict)

class WorkOrderChecklistOut(WorkOrderChecklistIn):
    id: int
    work_order_id: int
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)

class ProductIn(BaseModel):
    name: str = Field(min_length=2, max_length=160)
    sku: str | None = Field(default=None, max_length=64)
    category: str | None = Field(default=None, max_length=80)
    unit_measure: Literal["unidade", "caixa", "pacote", "saco"] = "unidade"
    quantity: int = Field(default=0, ge=0)
    minimum_quantity: int = Field(default=0, ge=0)
    unit_price: Decimal = Field(default=Decimal("0"), ge=0, max_digits=12, decimal_places=2)
    markup_percent: Decimal = Field(default=Decimal("0"), ge=0, max_digits=6, decimal_places=2)

class ProductOut(ProductIn):
    id: int
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

class StockMovementIn(BaseModel):
    movement_type: str = Field(pattern="^(entrada|saida)$")
    quantity: int = Field(gt=0)
    notes: str | None = Field(default=None, max_length=240)

class StockMovementOut(StockMovementIn):
    id: int
    product_id: int
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

class FinancialEntryIn(BaseModel):
    description: str = Field(min_length=2, max_length=200)
    entry_type: str = Field(pattern="^(receita|despesa)$")
    category: str | None = Field(default=None, max_length=80)
    amount: Decimal = Field(gt=0, max_digits=12, decimal_places=2)
    due_date: date | None = None
    paid_date: date | None = None
    status: str = Field(default="pendente", pattern="^(pendente|pago)$")

class FinancialEntryOut(FinancialEntryIn):
    id: int
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)
