from datetime import datetime, date, time
from sqlalchemy import String, Text, DateTime, Date, Time, ForeignKey, Integer, Numeric, JSON, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .database import Base

class Client(Base):
    __tablename__ = "clients"
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(160), index=True)
    document: Mapped[str | None] = mapped_column(String(32), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(40), nullable=True)
    email: Mapped[str | None] = mapped_column(String(160), nullable=True)
    address: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

class Unit(Base):
    __tablename__ = "units"
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    client_id: Mapped[int] = mapped_column(ForeignKey("clients.id"), index=True)
    name: Mapped[str] = mapped_column(String(160), index=True)
    sigla: Mapped[str | None] = mapped_column(String(80), nullable=True, index=True)
    address: Mapped[str] = mapped_column(Text)
    contact_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(40), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    client: Mapped[Client] = relationship()

class Technician(Base):
    __tablename__ = "technicians"
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(160), index=True)
    phone: Mapped[str | None] = mapped_column(String(40), nullable=True)
    email: Mapped[str | None] = mapped_column(String(160), nullable=True)
    active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    screen_permissions: Mapped[list] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(160), index=True)
    email: Mapped[str] = mapped_column(String(160), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(256))
    role: Mapped[str] = mapped_column(String(24), default="admin")
    technician_id: Mapped[int | None] = mapped_column(ForeignKey("technicians.id", ondelete="SET NULL"), nullable=True)
    active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    screen_permissions: Mapped[list] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    technician: Mapped[Technician | None] = relationship()

class Supplier(Base):
    __tablename__ = "suppliers"
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(160), index=True)
    category: Mapped[str | None] = mapped_column(String(80), nullable=True, index=True)
    document: Mapped[str | None] = mapped_column(String(32), nullable=True)
    contact_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(40), nullable=True)
    email: Mapped[str | None] = mapped_column(String(160), nullable=True)
    address: Mapped[str | None] = mapped_column(Text, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

class UnitContact(Base):
    __tablename__ = "unit_contacts"
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    unit_id: Mapped[int] = mapped_column(ForeignKey("units.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(160), index=True)
    role: Mapped[str] = mapped_column(String(24), index=True)
    phone: Mapped[str | None] = mapped_column(String(40), nullable=True)
    email: Mapped[str | None] = mapped_column(String(160), nullable=True)
    active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    unit: Mapped[Unit] = relationship()

class Ticket(Base):
    __tablename__ = "tickets"
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    priority: Mapped[str] = mapped_column(String(20), default="normal")
    status: Mapped[str] = mapped_column(String(30), default="aberto")
    client_id: Mapped[int | None] = mapped_column(ForeignKey("clients.id"), nullable=True)
    unit_id: Mapped[int | None] = mapped_column(ForeignKey("units.id"), nullable=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    client: Mapped[Client | None] = relationship()
    unit: Mapped[Unit | None] = relationship()

class WorkOrder(Base):
    __tablename__ = "work_orders"
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(30), default="pendente")
    scheduled_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    scheduled_time: Mapped[time | None] = mapped_column(Time, nullable=True)
    service_type: Mapped[str | None] = mapped_column(String(30), nullable=True)
    address: Mapped[str | None] = mapped_column(Text, nullable=True)
    client_id: Mapped[int | None] = mapped_column(ForeignKey("clients.id"), nullable=True)
    unit_id: Mapped[int | None] = mapped_column(ForeignKey("units.id"), nullable=True, index=True)
    technician_id: Mapped[int | None] = mapped_column(ForeignKey("technicians.id", ondelete="SET NULL"), nullable=True, index=True)
    technician_ids: Mapped[list] = mapped_column(JSON, default=list)
    ticket_id: Mapped[int | None] = mapped_column(ForeignKey("tickets.id"), nullable=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    client: Mapped[Client | None] = relationship()
    unit: Mapped[Unit | None] = relationship()
    technician: Mapped[Technician | None] = relationship()
    ticket: Mapped[Ticket | None] = relationship()

class WorkOrderChecklist(Base):
    __tablename__ = "work_order_checklists"
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    work_order_id: Mapped[int] = mapped_column(ForeignKey("work_orders.id", ondelete="CASCADE"), unique=True, index=True)
    local: Mapped[str | None] = mapped_column(Text, nullable=True)
    sigla: Mapped[str | None] = mapped_column(String(80), nullable=True)
    technician: Mapped[str | None] = mapped_column(String(160), nullable=True)
    technician_id: Mapped[int | None] = mapped_column(ForeignKey("technicians.id", ondelete="SET NULL"), nullable=True)
    technician_ids: Mapped[list] = mapped_column(JSON, default=list)
    whatsapp: Mapped[str | None] = mapped_column(String(32), nullable=True)
    leader: Mapped[str | None] = mapped_column(String(160), nullable=True)
    collaborator: Mapped[str | None] = mapped_column(String(160), nullable=True)
    leader_contact_id: Mapped[int | None] = mapped_column(ForeignKey("unit_contacts.id", ondelete="SET NULL"), nullable=True)
    collaborator_contact_id: Mapped[int | None] = mapped_column(ForeignKey("unit_contacts.id", ondelete="SET NULL"), nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    result: Mapped[str] = mapped_column(String(24), default="pendente")
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    service_description: Mapped[str | None] = mapped_column(Text, nullable=True)
    material_needed: Mapped[str | None] = mapped_column(Text, nullable=True)
    photo_required: Mapped[bool] = mapped_column(Boolean, default=True)
    other_service: Mapped[str | None] = mapped_column(String(200), nullable=True)
    services: Mapped[list] = mapped_column(JSON, default=list)
    materials: Mapped[list] = mapped_column(JSON, default=list)
    photos: Mapped[list] = mapped_column(JSON, default=list)
    signatures: Mapped[dict] = mapped_column(JSON, default=dict)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    work_order: Mapped[WorkOrder] = relationship()

class Product(Base):
    __tablename__ = "products"
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(160), index=True)
    sku: Mapped[str | None] = mapped_column(String(64), nullable=True, unique=True)
    category: Mapped[str | None] = mapped_column(String(80), nullable=True)
    unit_measure: Mapped[str] = mapped_column(String(16), default="unidade", nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, default=0)
    minimum_quantity: Mapped[int] = mapped_column(Integer, default=0)
    unit_price: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    markup_percent: Mapped[float] = mapped_column(Numeric(6, 2), default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

class StockMovement(Base):
    __tablename__ = "stock_movements"
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"), index=True)
    movement_type: Mapped[str] = mapped_column(String(12))
    quantity: Mapped[int] = mapped_column(Integer)
    notes: Mapped[str | None] = mapped_column(String(240), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    product: Mapped[Product] = relationship()

class FinancialEntry(Base):
    __tablename__ = "financial_entries"
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    description: Mapped[str] = mapped_column(String(200))
    entry_type: Mapped[str] = mapped_column(String(12), index=True)
    category: Mapped[str | None] = mapped_column(String(80), nullable=True)
    amount: Mapped[float] = mapped_column(Numeric(12, 2))
    due_date: Mapped[date | None] = mapped_column(Date, nullable=True, index=True)
    paid_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    status: Mapped[str] = mapped_column(String(12), default="pendente", index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
