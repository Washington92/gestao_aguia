from datetime import date, datetime, timedelta, timezone
import base64, hashlib, hmac, json, secrets
import os
from fastapi import FastAPI, Depends, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import select, func, inspect, text
from .database import Base, engine, get_db, SessionLocal
from .models import Client, Unit, UnitContact, Technician, User, Supplier, Ticket, WorkOrder, WorkOrderChecklist, Product, StockMovement, FinancialEntry
from .schemas import (ClientIn, ClientOut, UnitIn, UnitOut, UnitPatch, UnitContactIn, UnitContactOut, TechnicianIn, TechnicianOut, SupplierIn, SupplierOut, TicketIn, TicketOut, WorkOrderIn, WorkOrderOut,
                      ProductIn, ProductOut, StockMovementIn, StockMovementOut,
                      FinancialEntryIn, FinancialEntryOut, TicketWorkOrderIn,
                      WorkOrderChecklistIn, WorkOrderChecklistOut, TechnicianPatch, SupplierPatch,
                      UnitContactPatch, TicketPatch, WorkOrderPatch, AuthSetupIn, AuthLoginIn, AuthTechnicianRegisterIn, AuthUserOut)

Base.metadata.create_all(bind=engine)
with engine.begin() as connection:
    work_order_columns = {column["name"] for column in inspect(connection).get_columns("work_orders")}
    if "ticket_id" not in work_order_columns:
        connection.execute(text("ALTER TABLE work_orders ADD COLUMN ticket_id INTEGER REFERENCES tickets(id)"))
    if "scheduled_time" not in work_order_columns:
        connection.execute(text("ALTER TABLE work_orders ADD COLUMN scheduled_time TIME"))
    if "service_type" not in work_order_columns:
        connection.execute(text("ALTER TABLE work_orders ADD COLUMN service_type VARCHAR(30)"))
    if "technician_id" not in work_order_columns:
        connection.execute(text("ALTER TABLE work_orders ADD COLUMN technician_id INTEGER REFERENCES technicians(id) ON DELETE SET NULL"))
    if "technician_ids" not in work_order_columns:
        connection.execute(text("ALTER TABLE work_orders ADD COLUMN technician_ids JSON NOT NULL DEFAULT '[]'"))
    technician_columns = {column["name"] for column in inspect(connection).get_columns("technicians")}
    if "screen_permissions" not in technician_columns:
        connection.execute(text("ALTER TABLE technicians ADD COLUMN screen_permissions JSON NOT NULL DEFAULT '[]'"))
    for table_name in ("tickets", "work_orders"):
        columns = {column["name"] for column in inspect(connection).get_columns(table_name)}
        if "unit_id" not in columns:
            connection.execute(text(f"ALTER TABLE {table_name} ADD COLUMN unit_id INTEGER REFERENCES units(id)"))
    unit_columns = {column["name"] for column in inspect(connection).get_columns("units")}
    if "sigla" not in unit_columns:
        connection.execute(text("ALTER TABLE units ADD COLUMN sigla VARCHAR(80)"))
    checklist_columns = {column["name"] for column in inspect(connection).get_columns("work_order_checklists")}
    for column_name, column_type in {"local":"TEXT", "sigla":"VARCHAR(80)", "material_needed":"TEXT", "technician_id":"INTEGER REFERENCES technicians(id)", "technician_ids":"JSON NOT NULL DEFAULT '[]'", "leader_contact_id":"INTEGER REFERENCES unit_contacts(id)", "collaborator_contact_id":"INTEGER REFERENCES unit_contacts(id)"}.items():
        if column_name not in checklist_columns:
            connection.execute(text(f"ALTER TABLE work_order_checklists ADD COLUMN {column_name} {column_type}"))
    product_columns = {column["name"] for column in inspect(connection).get_columns("products")}
    if "markup_percent" not in product_columns:
        connection.execute(text("ALTER TABLE products ADD COLUMN markup_percent NUMERIC(6, 2) NOT NULL DEFAULT 0"))
    if "unit_measure" not in product_columns:
        connection.execute(text("ALTER TABLE products ADD COLUMN unit_measure VARCHAR(16) NOT NULL DEFAULT 'unidade'"))

app = FastAPI(title="Águia Gestão API", version="0.1.0",
              description="Protótipo inicial para gestão operacional.")
AUTH_SECRET = os.getenv("AGUIA_AUTH_SECRET") or secrets.token_urlsafe(48)
TOKEN_TTL = timedelta(hours=12)

def _b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode().rstrip("=")

def _password_hash(password: str, salt: bytes | None = None) -> str:
    salt = salt or secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 310_000)
    return f"{_b64(salt)}.{_b64(digest)}"

def _password_matches(password: str, stored: str) -> bool:
    try:
        salt_text, digest_text = stored.split(".", 1)
        salt = base64.urlsafe_b64decode(salt_text + "=" * (-len(salt_text) % 4))
        expected = base64.urlsafe_b64decode(digest_text + "=" * (-len(digest_text) % 4))
        actual = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 310_000)
        return hmac.compare_digest(actual, expected)
    except (ValueError, TypeError):
        return False

def _issue_token(user: User) -> str:
    payload = _b64(json.dumps({"sub": user.id, "exp": int((datetime.now(timezone.utc) + TOKEN_TTL).timestamp())}, separators=(",", ":")).encode())
    signature = _b64(hmac.new(AUTH_SECRET.encode(), payload.encode(), hashlib.sha256).digest())
    return f"{payload}.{signature}"

def _token_user_id(token: str) -> int | None:
    try:
        payload, signature = token.split(".", 1)
        expected = _b64(hmac.new(AUTH_SECRET.encode(), payload.encode(), hashlib.sha256).digest())
        if not hmac.compare_digest(signature, expected): return None
        data = json.loads(base64.urlsafe_b64decode(payload + "=" * (-len(payload) % 4)))
        if int(data["exp"]) <= int(datetime.now(timezone.utc).timestamp()): return None
        return int(data["sub"])
    except (ValueError, KeyError, TypeError, json.JSONDecodeError):
        return None

@app.middleware("http")
async def require_login(request: Request, call_next):
    path = request.url.path
    public_paths = {"/api/health", "/api/auth/setup-status", "/api/auth/setup", "/api/auth/login", "/api/auth/register-technician"}
    if request.method != "OPTIONS" and path.startswith("/api/") and path not in public_paths:
        header = request.headers.get("authorization", "")
        user_id = _token_user_id(header[7:]) if header.lower().startswith("bearer ") else None
        if user_id is None:
            from starlette.responses import JSONResponse
            return JSONResponse({"detail": "Sessão inválida ou expirada. Entre novamente."}, status_code=401)
        with SessionLocal() as db:
            user = db.get(User, user_id)
            if not user or not user.active:
                from starlette.responses import JSONResponse
                return JSONResponse({"detail": "Usuário inativo ou não encontrado."}, status_code=401)
    return await call_next(request)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in os.getenv("CORS_ORIGINS", "").split(",") if origin.strip()],
    allow_origin_regex=None if os.getenv("CORS_ORIGINS") else r"http://(localhost|127\.0\.0\.1|192\.168\.\d{1,3}\.\d{1,3}):517\d+",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def resolve_client_id(db: Session, client_id: int | None, unit_id: int | None) -> int | None:
    if not unit_id:
        return client_id
    unit = db.get(Unit, unit_id)
    if not unit:
        raise HTTPException(404, "Unidade não encontrada")
    if client_id is not None and unit.client_id != client_id:
        raise HTTPException(422, "A unidade selecionada não pertence a este cliente")
    return unit.client_id

def validate_technician(db: Session, technician_id: int | None) -> None:
    if technician_id is None:
        return
    technician = db.get(Technician, technician_id)
    if not technician:
        raise HTTPException(404, "Técnico não encontrado")
    if not technician.active:
        raise HTTPException(422, "Não é possível atribuir uma ordem a um técnico inativo")

def validate_technicians(db: Session, technician_ids: list[int] | None) -> list[int]:
    ids = list(dict.fromkeys(technician_ids or []))
    for technician_id in ids:
        validate_technician(db, technician_id)
    return ids

@app.get("/api/health")
def health():
    return {"status": "ok", "service": "aguia-gestao-api"}

@app.get("/api/auth/setup-status")
def auth_setup_status(db: Session = Depends(get_db)):
    return {"needs_setup": db.scalar(select(func.count()).select_from(User)) == 0}

@app.post("/api/auth/setup")
def auth_setup(payload: AuthSetupIn, db: Session = Depends(get_db)):
    if db.scalar(select(func.count()).select_from(User)):
        raise HTTPException(409, "A configuração inicial já foi concluída.")
    user = User(name=payload.name.strip(), email=payload.email.strip().lower(), password_hash=_password_hash(payload.password), role="admin", screen_permissions=["*"])
    db.add(user); db.commit(); db.refresh(user)
    return {"access_token": _issue_token(user), "token_type": "bearer", "user": AuthUserOut.model_validate(user)}

@app.post("/api/auth/login")
def auth_login(payload: AuthLoginIn, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.email == payload.email.strip().lower()))
    if not user or not user.active or not _password_matches(payload.password, user.password_hash):
        raise HTTPException(401, "E-mail ou senha incorretos.")
    return {"access_token": _issue_token(user), "token_type": "bearer", "user": AuthUserOut.model_validate(user)}

@app.post("/api/auth/register-technician", status_code=201)
def auth_register_technician(payload: AuthTechnicianRegisterIn, db: Session = Depends(get_db)):
    email = payload.email.strip().lower()
    technician = db.scalar(select(Technician).where(func.lower(Technician.email) == email, Technician.active.is_(True)))
    if not technician:
        raise HTTPException(403, "NÃ£o encontramos um tÃ©cnico ativo com esse e-mail. PeÃ§a ao administrador para cadastrÃ¡-lo em TÃ©cnicos.")
    if db.scalar(select(User).where(func.lower(User.email) == email)):
        raise HTTPException(409, "JÃ¡ existe uma conta com esse e-mail. Entre com sua senha ou peÃ§a ajuda ao administrador.")
    if db.scalar(select(User).where(User.technician_id == technician.id)):
        raise HTTPException(409, "Esse tÃ©cnico jÃ¡ possui uma conta de acesso. PeÃ§a ajuda ao administrador.")
    user = User(name=technician.name, email=email, password_hash=_password_hash(payload.password), role="technician", technician_id=technician.id, active=True, screen_permissions=list(technician.screen_permissions or []))
    db.add(user); db.commit(); db.refresh(user)
    return {"access_token": _issue_token(user), "token_type": "bearer", "user": AuthUserOut.model_validate(user)}

@app.get("/api/auth/me", response_model=AuthUserOut)
def auth_me(request: Request, db: Session = Depends(get_db)):
    token = request.headers.get("authorization", "")[7:]
    user_id = _token_user_id(token)
    user = db.get(User, user_id) if user_id else None
    if not user or not user.active: raise HTTPException(401, "Sessão expirada.")
    return user

@app.get("/api/dashboard")
def dashboard(db: Session = Depends(get_db)):
    return {
        "clients": db.scalar(select(func.count()).select_from(Client)) or 0,
        "open_tickets": db.scalar(select(func.count()).select_from(Ticket).where(Ticket.status != "concluido")) or 0,
        "work_orders": db.scalar(select(func.count()).select_from(WorkOrder)) or 0,
        "pending_work_orders": db.scalar(select(func.count()).select_from(WorkOrder).where(WorkOrder.status != "concluida")) or 0,
    }

@app.get("/api/clients", response_model=list[ClientOut])
def list_clients(db: Session = Depends(get_db)):
    return db.scalars(select(Client).order_by(Client.id.desc())).all()

@app.post("/api/clients", response_model=ClientOut, status_code=201)
def create_client(payload: ClientIn, db: Session = Depends(get_db)):
    obj = Client(**payload.model_dump())
    db.add(obj); db.commit(); db.refresh(obj)
    return obj

@app.get("/api/units", response_model=list[UnitOut])
def list_units(db: Session = Depends(get_db)):
    return db.scalars(select(Unit).order_by(Unit.client_id, Unit.name)).all()

@app.get("/api/clients/{client_id}/units", response_model=list[UnitOut])
def list_client_units(client_id: int, db: Session = Depends(get_db)):
    if not db.get(Client, client_id):
        raise HTTPException(404, "Cliente não encontrado")
    return db.scalars(select(Unit).where(Unit.client_id == client_id).order_by(Unit.name)).all()

@app.post("/api/clients/{client_id}/units", response_model=UnitOut, status_code=201)
def create_client_unit(client_id: int, payload: UnitIn, db: Session = Depends(get_db)):
    if not db.get(Client, client_id):
        raise HTTPException(404, "Cliente não encontrado")
    obj = Unit(client_id=client_id, **payload.model_dump())
    db.add(obj); db.commit(); db.refresh(obj)
    return obj

@app.patch("/api/units/{unit_id}", response_model=UnitOut)
def update_unit(unit_id: int, payload: UnitPatch, db: Session = Depends(get_db)):
    obj = db.get(Unit, unit_id)
    if not obj:
        raise HTTPException(404, "Unidade não encontrada")
    for key, value in payload.model_dump(exclude_unset=True).items():
        if key == "sigla" and isinstance(value, str):
            value = value.strip() or None
        setattr(obj, key, value)
    db.commit(); db.refresh(obj)
    return obj

@app.get("/api/technicians", response_model=list[TechnicianOut])
def list_technicians(active: bool | None = None, db: Session = Depends(get_db)):
    query = select(Technician)
    if active is not None:
        query = query.where(Technician.active == active)
    return db.scalars(query.order_by(Technician.active.desc(), Technician.name)).all()

@app.post("/api/technicians", response_model=TechnicianOut, status_code=201)
def create_technician(payload: TechnicianIn, db: Session = Depends(get_db)):
    obj = Technician(**payload.model_dump())
    db.add(obj); db.commit(); db.refresh(obj)
    return obj

@app.patch("/api/technicians/{technician_id}", response_model=TechnicianOut)
def update_technician(technician_id: int, payload: TechnicianPatch, db: Session = Depends(get_db)):
    obj = db.get(Technician, technician_id)
    if not obj:
        raise HTTPException(404, "Técnico não encontrado")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(obj, key, value)
    db.commit(); db.refresh(obj)
    return obj

@app.get("/api/suppliers", response_model=list[SupplierOut])
def list_suppliers(active: bool | None = None, db: Session = Depends(get_db)):
    query = select(Supplier)
    if active is not None:
        query = query.where(Supplier.active == active)
    return db.scalars(query.order_by(Supplier.active.desc(), Supplier.name)).all()

@app.post("/api/suppliers", response_model=SupplierOut, status_code=201)
def create_supplier(payload: SupplierIn, db: Session = Depends(get_db)):
    obj = Supplier(**payload.model_dump())
    db.add(obj); db.commit(); db.refresh(obj)
    return obj

@app.patch("/api/suppliers/{supplier_id}", response_model=SupplierOut)
def update_supplier(supplier_id: int, payload: SupplierPatch, db: Session = Depends(get_db)):
    obj = db.get(Supplier, supplier_id)
    if not obj:
        raise HTTPException(404, "Fornecedor não encontrado")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(obj, key, value)
    db.commit(); db.refresh(obj)
    return obj

@app.get("/api/unit-contacts", response_model=list[UnitContactOut])
def list_unit_contacts(active: bool | None = None, db: Session = Depends(get_db)):
    query = select(UnitContact)
    if active is not None:
        query = query.where(UnitContact.active == active)
    return db.scalars(query.order_by(UnitContact.unit_id, UnitContact.role, UnitContact.name)).all()

@app.get("/api/units/{unit_id}/contacts", response_model=list[UnitContactOut])
def list_unit_contacts_for_unit(unit_id: int, active: bool | None = True, db: Session = Depends(get_db)):
    if not db.get(Unit, unit_id):
        raise HTTPException(404, "Unidade não encontrada")
    query = select(UnitContact).where(UnitContact.unit_id == unit_id)
    if active is not None:
        query = query.where(UnitContact.active == active)
    return db.scalars(query.order_by(UnitContact.role, UnitContact.name)).all()

@app.post("/api/units/{unit_id}/contacts", response_model=UnitContactOut, status_code=201)
def create_unit_contact(unit_id: int, payload: UnitContactIn, db: Session = Depends(get_db)):
    if not db.get(Unit, unit_id):
        raise HTTPException(404, "Unidade não encontrada")
    obj = UnitContact(unit_id=unit_id, **payload.model_dump())
    db.add(obj); db.commit(); db.refresh(obj)
    return obj

@app.patch("/api/unit-contacts/{contact_id}", response_model=UnitContactOut)
def update_unit_contact(contact_id: int, payload: UnitContactPatch, db: Session = Depends(get_db)):
    obj = db.get(UnitContact, contact_id)
    if not obj:
        raise HTTPException(404, "Contato da unidade não encontrado")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(obj, key, value)
    db.commit(); db.refresh(obj)
    return obj

@app.get("/api/tickets", response_model=list[TicketOut])
def list_tickets(db: Session = Depends(get_db)):
    return db.scalars(select(Ticket).order_by(Ticket.id.desc())).all()

@app.post("/api/tickets", response_model=TicketOut, status_code=201)
def create_ticket(payload: TicketIn, db: Session = Depends(get_db)):
    client_id = resolve_client_id(db, payload.client_id, payload.unit_id)
    if client_id and not db.get(Client, client_id):
        raise HTTPException(404, "Cliente não encontrado")
    data = payload.model_dump()
    data["client_id"] = client_id
    obj = Ticket(**data)
    db.add(obj); db.commit(); db.refresh(obj)
    return obj

@app.patch("/api/tickets/{ticket_id}", response_model=TicketOut)
def update_ticket(ticket_id: int, payload: TicketPatch, db: Session = Depends(get_db)):
    obj = db.get(Ticket, ticket_id)
    if not obj:
        raise HTTPException(404, "Chamado não encontrado")
    data = payload.model_dump(exclude_unset=True)
    if "unit_id" in data or "client_id" in data:
        obj.client_id = resolve_client_id(db, data.get("client_id", obj.client_id), data.get("unit_id", obj.unit_id))
        if obj.client_id is not None and not db.get(Client, obj.client_id):
            raise HTTPException(404, "Cliente não encontrado")
        obj.unit_id = data.get("unit_id", obj.unit_id)
    for key, value in data.items():
        if key not in {"client_id", "unit_id"}:
            setattr(obj, key, value)
    db.commit(); db.refresh(obj)
    return obj

@app.get("/api/work-orders", response_model=list[WorkOrderOut])
def list_work_orders(db: Session = Depends(get_db)):
    return db.scalars(select(WorkOrder).order_by(WorkOrder.id.desc())).all()

@app.post("/api/work-orders", response_model=WorkOrderOut, status_code=201)
def create_work_order(payload: WorkOrderIn, db: Session = Depends(get_db)):
    client_id = resolve_client_id(db, payload.client_id, payload.unit_id)
    technician_ids = validate_technicians(db, payload.technician_ids or ([payload.technician_id] if payload.technician_id else []))
    if client_id and not db.get(Client, client_id):
        raise HTTPException(404, "Cliente não encontrado")
    data = payload.model_dump()
    data["technician_ids"] = technician_ids
    data["technician_id"] = technician_ids[0] if technician_ids else None
    data["client_id"] = client_id
    if payload.unit_id and not data.get("address"):
        data["address"] = db.get(Unit, payload.unit_id).address
    obj = WorkOrder(**data)
    db.add(obj); db.commit(); db.refresh(obj)
    return obj

@app.post("/api/tickets/{ticket_id}/work-order", response_model=WorkOrderOut, status_code=201)
def create_work_order_from_ticket(ticket_id: int, payload: TicketWorkOrderIn, db: Session = Depends(get_db)):
    ticket = db.get(Ticket, ticket_id)
    if not ticket:
        raise HTTPException(404, "Chamado não encontrado")
    if ticket.status == "concluido":
        raise HTTPException(409, "Um chamado concluído não pode gerar uma nova ordem")
    existing = db.scalar(select(WorkOrder).where(WorkOrder.ticket_id == ticket_id))
    if existing:
        raise HTTPException(409, "Este chamado já possui uma ordem de serviço vinculada")
    validate_technician(db, payload.technician_id)
    client = db.get(Client, ticket.client_id) if ticket.client_id else None
    order = WorkOrder(
        title=ticket.title,
        description=ticket.description,
        status="pendente",
        scheduled_date=payload.scheduled_date,
        scheduled_time=payload.scheduled_time,
        address=payload.address or (ticket.unit.address if ticket.unit else None) or (client.address if client else None),
        technician_id=payload.technician_id,
        client_id=ticket.client_id,
        unit_id=ticket.unit_id,
        ticket_id=ticket.id,
    )
    ticket.status = "em atendimento"
    db.add(order); db.commit(); db.refresh(order)
    return order

@app.get("/api/agenda", response_model=list[WorkOrderOut])
def list_agenda(from_date: date | None = None, to_date: date | None = None, db: Session = Depends(get_db)):
    query = select(WorkOrder).where(WorkOrder.scheduled_date.is_not(None))
    if from_date:
        query = query.where(WorkOrder.scheduled_date >= from_date)
    if to_date:
        query = query.where(WorkOrder.scheduled_date <= to_date)
    return db.scalars(query.order_by(WorkOrder.scheduled_date, WorkOrder.id)).all()

@app.patch("/api/work-orders/{order_id}", response_model=WorkOrderOut)
def update_work_order(order_id: int, payload: WorkOrderPatch, db: Session = Depends(get_db)):
    obj = db.get(WorkOrder, order_id)
    if not obj:
        raise HTTPException(404, "Ordem de serviço não encontrada")
    data = payload.model_dump(exclude_unset=True)
    if "technician_ids" in data:
        data["technician_ids"] = validate_technicians(db, data["technician_ids"])
        data["technician_id"] = data["technician_ids"][0] if data["technician_ids"] else None
    elif "technician_id" in data:
        validate_technician(db, data["technician_id"])
        data["technician_ids"] = [data["technician_id"]] if data["technician_id"] else []
    if "unit_id" in data or "client_id" in data:
        obj.client_id = resolve_client_id(db, data.get("client_id", obj.client_id), data.get("unit_id", obj.unit_id))
        if obj.client_id is not None and not db.get(Client, obj.client_id):
            raise HTTPException(404, "Cliente não encontrado")
        obj.unit_id = data.get("unit_id", obj.unit_id)
    for key, value in data.items():
        if key not in {"client_id", "unit_id"}:
            setattr(obj, key, value)
    if "technician_ids" in data:
        checklist = db.scalar(select(WorkOrderChecklist).where(WorkOrderChecklist.work_order_id == order_id))
        if checklist:
            checklist.technician_ids = data["technician_ids"]
            checklist.technician_id = data["technician_ids"][0] if data["technician_ids"] else None
            checklist.technician = ", ".join(db.get(Technician, tech_id).name for tech_id in data["technician_ids"])
    db.commit(); db.refresh(obj)
    return obj

@app.get("/api/work-orders/{order_id}/checklist", response_model=WorkOrderChecklistOut)
def get_work_order_checklist(order_id: int, db: Session = Depends(get_db)):
    if not db.get(WorkOrder, order_id):
        raise HTTPException(404, "Atendimento não encontrado")
    checklist = db.scalar(select(WorkOrderChecklist).where(WorkOrderChecklist.work_order_id == order_id))
    if not checklist:
        checklist = WorkOrderChecklist(work_order_id=order_id)
        db.add(checklist); db.commit(); db.refresh(checklist)
    return checklist

@app.put("/api/work-orders/{order_id}/checklist", response_model=WorkOrderChecklistOut)
def save_work_order_checklist(order_id: int, payload: WorkOrderChecklistIn, db: Session = Depends(get_db)):
    if not db.get(WorkOrder, order_id):
        raise HTTPException(404, "Atendimento não encontrado")
    checklist = db.scalar(select(WorkOrderChecklist).where(WorkOrderChecklist.work_order_id == order_id))
    if not checklist:
        checklist = WorkOrderChecklist(work_order_id=order_id)
        db.add(checklist)
    data = payload.model_dump()
    data["technician_ids"] = validate_technicians(db, data.get("technician_ids"))
    data["technician_id"] = data["technician_ids"][0] if data["technician_ids"] else None
    order = db.get(WorkOrder, order_id)
    order.technician_ids = data["technician_ids"]
    order.technician_id = data["technician_id"]
    for key, value in data.items():
        setattr(checklist, key, value)
    db.commit(); db.refresh(checklist)
    return checklist

@app.get("/api/products", response_model=list[ProductOut])
def list_products(db: Session = Depends(get_db)):
    return db.scalars(select(Product).order_by(Product.name)).all()

@app.post("/api/products", response_model=ProductOut, status_code=201)
def create_product(payload: ProductIn, db: Session = Depends(get_db)):
    obj = Product(**payload.model_dump())
    db.add(obj)
    try:
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(409, "Já existe um produto com este código SKU")
    db.refresh(obj)
    return obj

@app.patch("/api/products/{product_id}", response_model=ProductOut)
def update_product(product_id: int, payload: dict, db: Session = Depends(get_db)):
    obj = db.get(Product, product_id)
    if not obj:
        raise HTTPException(404, "Produto não encontrado")
    allowed = {"name", "sku", "category", "unit_measure", "quantity", "minimum_quantity", "unit_price", "markup_percent"}
    data = {key: value for key, value in payload.items() if key in allowed}
    merged = {"name": obj.name, "sku": obj.sku, "category": obj.category, "unit_measure": obj.unit_measure,
              "quantity": obj.quantity, "minimum_quantity": obj.minimum_quantity,
              "unit_price": obj.unit_price, "markup_percent": obj.markup_percent}
    merged.update(data)
    validated = ProductIn.model_validate(merged)
    for key, value in validated.model_dump().items():
        setattr(obj, key, value)
    try:
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(409, "Já existe um produto com este código SKU")
    db.refresh(obj)
    return obj

@app.get("/api/products/{product_id}/movements", response_model=list[StockMovementOut])
def list_stock_movements(product_id: int, db: Session = Depends(get_db)):
    if not db.get(Product, product_id):
        raise HTTPException(404, "Produto não encontrado")
    return db.scalars(select(StockMovement).where(StockMovement.product_id == product_id)
                      .order_by(StockMovement.id.desc())).all()

@app.post("/api/products/{product_id}/movements", response_model=StockMovementOut, status_code=201)
def create_stock_movement(product_id: int, payload: StockMovementIn, db: Session = Depends(get_db)):
    product = db.get(Product, product_id)
    if not product:
        raise HTTPException(404, "Produto não encontrado")
    delta = payload.quantity if payload.movement_type == "entrada" else -payload.quantity
    if product.quantity + delta < 0:
        raise HTTPException(422, "A saída excede o saldo disponível")
    product.quantity += delta
    movement = StockMovement(product_id=product_id, **payload.model_dump())
    db.add(movement); db.commit(); db.refresh(movement)
    return movement

@app.get("/api/financial-entries", response_model=list[FinancialEntryOut])
def list_financial_entries(db: Session = Depends(get_db)):
    return db.scalars(select(FinancialEntry).order_by(FinancialEntry.due_date, FinancialEntry.id.desc())).all()

@app.post("/api/financial-entries", response_model=FinancialEntryOut, status_code=201)
def create_financial_entry(payload: FinancialEntryIn, db: Session = Depends(get_db)):
    data = payload.model_dump()
    if data["status"] == "pago" and not data["paid_date"]:
        data["paid_date"] = date.today()
    obj = FinancialEntry(**data)
    db.add(obj); db.commit(); db.refresh(obj)
    return obj

@app.patch("/api/financial-entries/{entry_id}", response_model=FinancialEntryOut)
def update_financial_entry(entry_id: int, payload: dict, db: Session = Depends(get_db)):
    obj = db.get(FinancialEntry, entry_id)
    if not obj:
        raise HTTPException(404, "Lançamento não encontrado")
    status = payload.get("status")
    if status is not None and status not in {"pendente", "pago"}:
        raise HTTPException(422, "Status inválido")
    if status:
        obj.status = status
        paid_date = payload.get("paid_date")
        obj.paid_date = date.fromisoformat(paid_date) if isinstance(paid_date, str) else paid_date
        if status == "pago" and not obj.paid_date:
            obj.paid_date = date.today()
        elif status == "pendente":
            obj.paid_date = None
    db.commit(); db.refresh(obj)
    return obj
