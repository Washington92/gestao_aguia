import { useEffect, useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import {
  Activity, ArrowDownLeft, ArrowUpRight, BarChart3, Bell, Building2, CalendarDays, Check, ChevronLeft,
  ChevronRight, ClipboardList, CreditCard, FileText, LayoutDashboard, LogOut, MapPin, Menu, Navigation, Package, Pencil, Plus, Search,
  Moon, Sun, Ticket, Truck, Users, Wallet, Wrench, X, ShieldCheck, Save,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import ChecklistModal from "./ChecklistModal";
import LoginScreen from "./LoginScreen";

const API = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? "http://127.0.0.1:8003/api" : "/api");
let pendingWhatsAppWindow:Window|null=null;
type Client = { id:number; name:string; phone?:string|null; email?:string|null; address?:string|null };
type AuthUser = {id:number;name:string;email:string;role:string;technician_id:number|null;active:boolean;screen_permissions:string[]};
type Unit = { id:number; client_id:number; name:string; sigla?:string|null; address:string; contact_name?:string|null; phone?:string|null };
type Technician = {id:number;name:string;phone?:string|null;email?:string|null;active:boolean;screen_permissions?:string[]};
type Supplier = {id:number;name:string;category?:string|null;document?:string|null;contact_name?:string|null;phone?:string|null;email?:string|null;address?:string|null;notes?:string|null;active:boolean};
type UnitContact = {id:number;unit_id:number;name:string;role:"lider"|"gerente"|"colaborador";phone?:string|null;email?:string|null;active:boolean};
type TicketRow = { id:number; title:string; description?:string|null; status:string; priority:string; client_id?:number|null; unit_id?:number|null; created_at?:string };
type WorkOrder = { id:number; title:string; status:string; scheduled_date?:string|null; scheduled_time?:string|null; service_type?:string|null; technician_id?:number|null; technician_ids?:number[]; address?:string|null; description?:string|null; ticket_id?:number|null; client_id?:number|null; unit_id?:number|null; created_at?:string };
type Product = { id:number; name:string; sku?:string|null; category?:string|null; unit_measure:"unidade"|"caixa"|"pacote"|"saco"; quantity:number; minimum_quantity:number; unit_price:number; markup_percent:number };
type Movement = { id:number; product_id:number; movement_type:string; quantity:number; notes?:string|null; created_at:string };
type Entry = { id:number; description:string; entry_type:"receita"|"despesa"; category?:string|null; amount:number; due_date?:string|null; paid_date?:string|null; status:"pendente"|"pago" };
type Stats = { clients:number; open_tickets:number; work_orders:number; pending_work_orders:number };
type FormMode = "ticket"|"order"|"edit-order"|"client"|"unit"|"edit-unit"|"unit-contact"|"technician"|"supplier"|"edit-supplier"|"product"|"edit-product"|"movement"|"entry"|"convert";
type NavItem = { label:string; icon:LucideIcon; page?:string; children?:NavItem[] };
type NavGroup = { label:string; icon:LucideIcon; items:NavItem[] };
const nav:NavItem[] = [
  {label:"Dashboard",icon:LayoutDashboard},
];
const navAfterGroups:NavItem[] = [{label:"Financeiro",icon:Wallet}];
const navGroups:NavGroup[] = [
  {label:"Opera\u00e7\u00e3o",icon:Activity,items:[
    {label:"Ordens de Servi\u00e7o",page:"Ordens de servi\u00e7o",icon:ClipboardList},
    {label:"Agenda",icon:CalendarDays},
  ]},
  {label:"Cadastros",icon:Users,items:[
    {label:"Clientes",page:"Clientes e endere\u00e7os",icon:Building2},
    {label:"T\u00e9cnicos",icon:Wrench},
    {label:"Fornecedores",icon:Truck},
  ]},
  {label:"Recursos",icon:Package,items:[{label:"Estoque",icon:Package}]},
];
const navEnd:NavItem[] = [{label:"Relat\u00f3rios",icon:BarChart3},{label:"Permissões",icon:ShieldCheck}];
const placeholders:Record<string,string> = {
  "Relat\u00f3rios":"Indicadores consolidados de ordens de serviço e resultados financeiros.",
};
const permissionScreens=[
  {key:"Dashboard",label:"Dashboard",description:"Indicadores e resumo da operação",icon:LayoutDashboard},
  {key:"Ordens de servi\u00e7o",label:"Ordens de Serviço",description:"Abertura, acompanhamento e edição de OS",icon:ClipboardList},
  {key:"Agenda",label:"Agenda",description:"Calendário e atendimentos agendados",icon:CalendarDays},
  {key:"Clientes e endere\u00e7os",label:"Clientes",description:"Clientes, unidades e endereços",icon:Building2},
  {key:"T\u00e9cnicos",label:"Técnicos",description:"Cadastro e gestão da equipe técnica",icon:Wrench},
  {key:"Fornecedores",label:"Fornecedores",description:"Cadastro de fornecedores",icon:Truck},
  {key:"Estoque",label:"Estoque",description:"Produtos e movimentações de estoque",icon:Package},
  {key:"Financeiro",label:"Financeiro",description:"Cobranças, despesas e orçamentos",icon:Wallet},
  {key:"Relat\u00f3rios",label:"Relatórios",description:"Indicadores e resultados consolidados",icon:BarChart3},
];
const today = () => { const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; };
const assignedTechnicianNames = (order:WorkOrder, technicians:Technician[]) => (order.technician_ids?.length?order.technician_ids:(order.technician_id?[order.technician_id]:[])).map(id=>technicians.find(t=>t.id===id)?.name).filter(Boolean).join(", ");
const serviceTypeLabels:Record<string,string>={instalacao:"Instalação",manutencao:"Manutenção",preventiva:"Preventiva",corretiva:"Correção"};
const serviceTypeLabel=(value?:string|null)=>value?serviceTypeLabels[value]||value:"Atendimento";
const money = (value:number) => new Intl.NumberFormat("pt-BR", { style:"currency", currency:"BRL" }).format(Number(value||0));
const dateLabel = (value?:string|null) => value ? new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR", { day:"2-digit", month:"short", year:"numeric" }) : "Sem data";

export default function App() {
  const [page,setPage] = useState(nav[0].label);
  const [stats,setStats] = useState<Stats>({clients:0,open_tickets:0,work_orders:0,pending_work_orders:0});
  const [clients,setClients] = useState<Client[]>([]);
  const [clientSearch,setClientSearch] = useState("");
  const [units,setUnits] = useState<Unit[]>([]);
  const [technicians,setTechnicians] = useState<Technician[]>([]);
  const [suppliers,setSuppliers] = useState<Supplier[]>([]);
  const [selectedSupplier,setSelectedSupplier] = useState<Supplier|null>(null);
  const [supplierSearch,setSupplierSearch] = useState("");
  const [supplierCategory,setSupplierCategory] = useState("todas");
  const [supplierStatus,setSupplierStatus] = useState("ativos");
  const [unitContacts,setUnitContacts] = useState<UnitContact[]>([]);
  const [tickets,setTickets] = useState<TicketRow[]>([]);
  const [orders,setOrders] = useState<WorkOrder[]>([]);
  const [products,setProducts] = useState<Product[]>([]);
  const [entries,setEntries] = useState<Entry[]>([]);
  const [error,setError] = useState("");
  const [busy,setBusy] = useState(false);
  const [form,setForm] = useState<FormMode|null>(null);
  const [menuOpen,setMenuOpen] = useState(false);
  const [sidebarCollapsed,setSidebarCollapsed] = useState(false);
  const [theme,setTheme] = useState<"light"|"dark">(()=>{try{return localStorage.getItem("aguia-theme")==="light"?"light":"dark"}catch{return "dark"}});
  const [navSearch,setNavSearch] = useState("");
  const [collapsedGroups,setCollapsedGroups] = useState<Record<string,boolean>>({});
  const [selectedProduct,setSelectedProduct] = useState<Product|null>(null);
  const [selectedTicket,setSelectedTicket] = useState<TicketRow|null>(null);
  const [selectedOrder,setSelectedOrder] = useState<WorkOrder|null>(null);
  const [checklistOrder,setChecklistOrder] = useState<WorkOrder|null>(null);
  const [checklistAction,setChecklistAction] = useState<"start"|"finish"|null>(null);
  const [unitParent,setUnitParent] = useState<Client|null>(null);
  const [selectedUnit,setSelectedUnit] = useState<Unit|null>(null);
  const [contactUnit,setContactUnit] = useState<Unit|null>(null);
  const [historyProduct,setHistoryProduct] = useState<Product|null>(null);
  const [movements,setMovements] = useState<Movement[]>([]);
  const [movementType,setMovementType] = useState<"entrada"|"saida">("entrada");
  const [agendaDay,setAgendaDay] = useState(today());
  const [agendaView,setAgendaView] = useState<"dia"|"semana"|"mes">("mes");
  const [agendaStatusFilter,setAgendaStatusFilter] = useState("todos");
  const [agendaSearch,setAgendaSearch] = useState("");
  const [ticketView,setTicketView] = useState<"kanban"|"lista">("kanban");
  const [ticketSearch,setTicketSearch] = useState("");
  const [ticketPriority,setTicketPriority] = useState("todas");
  const [ticketFocusId,setTicketFocusId] = useState<number|null>(null);
  const [orderFocusId,setOrderFocusId] = useState<number|null>(null);
  const [orderSearch,setOrderSearch] = useState("");
  const [orderStatusFilter,setOrderStatusFilter] = useState("todos");
  const [orderView,setOrderView] = useState<"lista"|"kanban">("lista");
  const [financeView,setFinanceView] = useState<"cobrancas"|"despesas"|"orcamentos">("cobrancas");
  const [newEntryType,setNewEntryType] = useState<"receita"|"despesa">("receita");
  const [permissionTechnicianId,setPermissionTechnicianId] = useState<number|null>(null);
  const [permissionDraft,setPermissionDraft] = useState<string[]>([]);
  const [permissionSaving,setPermissionSaving] = useState(false);
  const [authUser,setAuthUser] = useState<AuthUser|null>(null);
  const [authReady,setAuthReady] = useState(false);
  const [setupNeeded,setSetupNeeded] = useState(false);
  const [authBusy,setAuthBusy] = useState(false);
  const [authError,setAuthError] = useState("");
  const selectedPermissionTechnician=technicians.find(technician=>technician.id===permissionTechnicianId)||null;

  useEffect(()=>{
    if(permissionTechnicianId===null&&technicians.length){
      const first=technicians.find(technician=>technician.active)||technicians[0];
      setPermissionTechnicianId(first.id);
      setPermissionDraft(first.screen_permissions||[]);
    }
  },[technicians,permissionTechnicianId]);

  async function saveTechnicianPermissions(){
    if(!selectedPermissionTechnician)return;
    setPermissionSaving(true);setError("");
    try{
      const updated=await request<Technician>(`/technicians/${selectedPermissionTechnician.id}`,{method:"PATCH",body:JSON.stringify({screen_permissions:permissionDraft})});
      setTechnicians(current=>current.map(technician=>technician.id===updated.id?updated:technician));
    }catch(error){setError(error instanceof Error?error.message:"Não foi possível salvar as permissões.");}
    finally{setPermissionSaving(false);}
  }

  function matchesPage(item:NavItem, target:string):boolean {
    return (item.page||item.label)===target||!!item.children?.some(child=>matchesPage(child,target));
  }
  function navigate(label:string,targetPage=label) {
    const route=targetPage;
    setPage(route); setMenuOpen(false); setForm(null);
    if(route==="Financeiro") setFinanceView("cobrancas");
    const expanded:Record<string,boolean>={};
    function expandPath(items:NavItem[],prefix:string):boolean {
      for(const item of items) {
        const key=`${prefix}/${item.label}`;
        if((item.page||item.label)===route) { if(item.children?.length) expanded[key]=false; return true; }
        if(item.children&&expandPath(item.children,key)) { expanded[key]=false; return true; }
      }
      return false;
    }
    for(const group of navGroups) if(group.items.some(item=>matchesPage(item,route))) {
      expanded[group.label]=false;
      expandPath(group.items,group.label);
    }
    setCollapsedGroups(current=>({...current,...expanded}));
  }

  async function request<T>(path:string, init?:RequestInit):Promise<T> {
    const token=localStorage.getItem("aguia-access-token");
    const response = await fetch(`${API}${path}`, { ...init, headers:{"Content-Type":"application/json",...(token?{Authorization:`Bearer ${token}`}:{ }), ...init?.headers} });
    if (!response.ok) {
      if(response.status===401&&!path.startsWith("/auth/login")&&!path.startsWith("/auth/setup")){localStorage.removeItem("aguia-access-token");setAuthUser(null)}
      const body = await response.json().catch(()=>null);
      const detail=body?.detail;
      const message=typeof detail==="string"?detail:Array.isArray(detail)?detail.map(item=>typeof item==="string"?item:item?.msg||JSON.stringify(item)).join(" · "):detail&&typeof detail==="object"?JSON.stringify(detail):"Não foi possível concluir a operação.";
      throw new Error(message);
    }
    return response.status === 204 ? undefined as T : response.json();
  }
  async function load() {
    try {
      const [s,c,u,t,o,p,f,tech,contacts] = await Promise.all([
        request<Stats>("/dashboard"), request<Client[]>("/clients"), request<Unit[]>("/units"), request<TicketRow[]>("/tickets"),
        request<WorkOrder[]>("/work-orders"), request<Product[]>("/products"), request<Entry[]>("/financial-entries"),
        request<Technician[]>("/technicians"), request<UnitContact[]>("/unit-contacts"),
      ]);
      let supplierRows:Supplier[]=[];
      try { supplierRows=await request<Supplier[]>("/suppliers"); } catch (e) { if (!(e instanceof Error) || e.message !== "Not Found") throw e; }
      setStats(s); setClients(c); setUnits(u); setTickets(t); setOrders(o); setProducts(p); setEntries(f); setTechnicians(tech); setUnitContacts(contacts); setSuppliers(supplierRows); setError("");
    } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível conectar à API. Inicie o backend e atualize a página."); }
  }
  async function authenticate(data:{name:string;email:string;password:string}) {
    setAuthBusy(true);setAuthError("");
    try{
      const result=await request<{access_token:string;user:AuthUser}>(setupNeeded?"/auth/setup":"/auth/login",{method:"POST",body:JSON.stringify(data)});
      localStorage.setItem("aguia-access-token",result.access_token);setSetupNeeded(false);setAuthUser(result.user);await load();
    }catch(error){setAuthError(error instanceof Error?error.message:"Não foi possível entrar no portal.")}
    finally{setAuthBusy(false)}
  }
  async function registerTechnician(data:{email:string;password:string}) {
    setAuthBusy(true);setAuthError("");
    try{
      const result=await request<{access_token:string;user:AuthUser}>("/auth/register-technician",{method:"POST",body:JSON.stringify(data)});
      localStorage.setItem("aguia-access-token",result.access_token);setAuthUser(result.user);await load();
    }catch(error){setAuthError(error instanceof Error?error.message:"NÃ£o foi possÃ­vel criar o acesso.")}
    finally{setAuthBusy(false)}
  }
  useEffect(()=>{let active=true;void (async()=>{try{const status=await request<{needs_setup:boolean}>("/auth/setup-status");if(!active)return;setSetupNeeded(status.needs_setup);const token=localStorage.getItem("aguia-access-token");if(token&&!status.needs_setup){try{const user=await request<AuthUser>("/auth/me");if(!active)return;setAuthUser(user);await load()}catch{localStorage.removeItem("aguia-access-token")}}}catch(error){if(active){const message=error instanceof Error?error.message:"Não foi possível conectar à API.";setAuthError(message==="Not Found"?"A API ativa ainda não carregou o login. Reinicie o backend na pasta backend e recarregue esta página.":message)}}finally{if(active)setAuthReady(true)}})();return()=>{active=false}},[]);

  async function submit(e:FormEvent<HTMLFormElement>) {
    e.preventDefault(); if (!form) return;
    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries([...formData.entries()].map(([key,value])=>[key,String(value).trim()||null])) as Record<string,any>;
    if (form === "order" || form === "edit-order") {
      data.technician_ids = formData.getAll("technician_ids").map(Number);
      data.technician_id = data.technician_ids[0] ?? null;
    }
    const submitter=(e.nativeEvent as SubmitEvent).submitter;
    const action=(submitter instanceof HTMLButtonElement?submitter.dataset.action:null)||String(formData.get("order_action")||"");
    const actionAt=String(formData.get("order_action_at")||"");
    delete data.order_action;
    delete data.order_action_at;
    const continueToChecklist=action==="start"||action==="finish";
    let orderForChecklist:WorkOrder|null=null;
    setBusy(true); setError("");
    try {
      if (form === "edit-order" && selectedOrder) {
        orderForChecklist=await request<WorkOrder>(`/work-orders/${selectedOrder.id}`, {method:"PATCH",body:JSON.stringify({...data,title:data.title||"Atendimento",client_id:data.client_id?Number(data.client_id):null,unit_id:data.unit_id?Number(data.unit_id):null})});
      } else if (form === "movement" && selectedProduct) {
        await request(`/products/${selectedProduct.id}/movements`, {method:"POST",body:JSON.stringify({...data,movement_type:movementType,quantity:Number(data.quantity)})});
      } else if (form === "convert" && selectedTicket) {
        await request(`/tickets/${selectedTicket.id}/work-order`, {method:"POST",body:JSON.stringify(data)});
      } else if (form === "ticket") {
        await request("/tickets", {method:"POST",body:JSON.stringify({...data,priority:data.priority||"normal",status:"aberto",client_id:data.client_id?Number(data.client_id):null,unit_id:data.unit_id?Number(data.unit_id):null})});
      } else if (form === "order") {
        let resolvedClientId=data.client_id?Number(data.client_id):null;
        if (!resolvedClientId&&data.new_client_name) {
          const matched=clients.find(client=>client.name.trim().toLocaleLowerCase("pt-BR")===String(data.new_client_name).trim().toLocaleLowerCase("pt-BR"));
          const client=matched||await request<Client>("/clients",{method:"POST",body:JSON.stringify({name:data.new_client_name})});
          resolvedClientId=client.id;
        }
        if (!resolvedClientId) throw new Error("Selecione ou informe um cliente para a ordem.");
        let resolvedUnitId=data.unit_id?Number(data.unit_id):null;
        let resolvedAddress=String(data.address||"");
        if (data.new_unit_name) {
          const createdUnit=await request<Unit>(`/clients/${resolvedClientId}/units`,{method:"POST",body:JSON.stringify({name:data.new_unit_name,sigla:data.new_unit_sigla||null,address:data.new_unit_address,contact_name:data.new_unit_manager||null,phone:data.new_unit_phone||null})});
          resolvedUnitId=createdUnit.id; resolvedAddress=createdUnit.address;
          if (data.new_unit_manager) await request(`/units/${createdUnit.id}/contacts`,{method:"POST",body:JSON.stringify({name:data.new_unit_manager,role:"gerente",active:true})});
        }
        const orderPayload={...data,title:data.title||"Atendimento",status:"pendente",client_id:resolvedClientId,unit_id:resolvedUnitId,address:resolvedAddress};
        for (const key of ["new_client_name","new_unit_name","new_unit_sigla","new_unit_manager","new_unit_address","new_unit_phone"]) delete orderPayload[key];
        orderForChecklist=await request<WorkOrder>("/work-orders", {method:"POST",body:JSON.stringify(orderPayload)});
      } else if (form === "client") {
        await request("/clients", {method:"POST",body:JSON.stringify(data)});
      } else if (form === "unit" && unitParent) {
        await request(`/clients/${unitParent.id}/units`, {method:"POST",body:JSON.stringify(data)});
      } else if (form === "edit-unit" && selectedUnit) {
        await request(`/units/${selectedUnit.id}`, {method:"PATCH",body:JSON.stringify(data)});
      } else if (form === "unit-contact" && contactUnit) {
        await request(`/units/${contactUnit.id}/contacts`, {method:"POST",body:JSON.stringify(data)});
      } else if (form === "technician") {
        await request("/technicians", {method:"POST",body:JSON.stringify(data)});
      } else if (form === "supplier") {
        await request("/suppliers", {method:"POST",body:JSON.stringify({...data,active:true})});
      } else if (form === "edit-supplier" && selectedSupplier) {
        await request(`/suppliers/${selectedSupplier.id}`, {method:"PATCH",body:JSON.stringify({...data,active:data.active==="true"})});
      } else if (form === "product") {
        await request("/products", {method:"POST",body:JSON.stringify({...data,quantity:Number(data.quantity||0),minimum_quantity:Number(data.minimum_quantity||0),unit_price:Number(data.unit_price||0),markup_percent:Number(data.markup_percent||0)})});
      } else if (form === "edit-product" && selectedProduct) {
        await request(`/products/${selectedProduct.id}`, {method:"PATCH",body:JSON.stringify({...data,minimum_quantity:Number(data.minimum_quantity||0),unit_price:Number(data.unit_price||0),markup_percent:Number(data.markup_percent||0)})});
      } else if (form === "entry") {
        await request("/financial-entries", {method:"POST",body:JSON.stringify({...data,amount:Number(data.amount),status:"pendente"})});
      }
      if (action==="start"&&orderForChecklist) {
        const checklist=await request<any>(`/work-orders/${orderForChecklist.id}/checklist`);
        const ids=orderForChecklist.technician_ids?.length?orderForChecklist.technician_ids:(orderForChecklist.technician_id?[orderForChecklist.technician_id]:[]);
        const names=ids.map(id=>technicians.find(tech=>tech.id===id)?.name).filter(Boolean).join(", ");
        const startedAt=checklist.started_at||actionAt||new Date().toISOString();
        await request(`/work-orders/${orderForChecklist.id}/checklist`,{method:"PUT",body:JSON.stringify({...checklist,technician_ids:ids,technician_id:ids[0]||null,technician:names,started_at:startedAt})});
        orderForChecklist=await request<WorkOrder>(`/work-orders/${orderForChecklist.id}`,{method:"PATCH",body:JSON.stringify({status:"em atendimento"})});
        const unitName=units.find(unit=>unit.id===orderForChecklist?.unit_id)?.name||String(data.new_unit_name||"")||clients.find(client=>client.id===orderForChecklist?.client_id)?.name||"Unidade não informada";
        const entered=new Date(startedAt).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"});
        const message=`ðŸ“ TÉCNICO NO LOCAL · ATENDIMENTO INICIADO\nðŸ¢ Unidade: ${unitName}\nðŸ‘¤ Técnico(s): ${names||"Não informado"}\nðŸ“… Data: ${new Date(startedAt).toLocaleDateString("pt-BR")}\nâ° Entrada: ${entered}`;
        const phone=String(checklist.whatsapp||units.find(unit=>unit.id===orderForChecklist?.unit_id)?.phone||data.new_unit_phone||"").replace(/\D/g,"");
        const whatsappUrl=`https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
        const whatsappWindow=pendingWhatsAppWindow; pendingWhatsAppWindow=null;
        if(whatsappWindow&&!whatsappWindow.closed)whatsappWindow.location.href=whatsappUrl;
        else window.open(whatsappUrl,"_blank","noopener,noreferrer");
      }
      if (action==="finish"&&orderForChecklist) {
        const checklist=await request<any>(`/work-orders/${orderForChecklist.id}/checklist`);

        const startedAt=checklist.started_at||new Date().toISOString();
        if(!startedAt) throw new Error("Informe o horário de entrada ou agende a ordem antes de concluir o atendimento.");
        const finishedAt=checklist.finished_at||actionAt||new Date().toISOString();
        await request(`/work-orders/${orderForChecklist.id}/checklist`,{method:"PUT",body:JSON.stringify({...checklist,started_at:startedAt,finished_at:finishedAt})});
        const unitName=units.find(unit=>unit.id===orderForChecklist?.unit_id)?.name||clients.find(client=>client.id===orderForChecklist?.client_id)?.name||"Unidade não informada";
        const names=(orderForChecklist.technician_ids?.length?orderForChecklist.technician_ids:(orderForChecklist.technician_id?[orderForChecklist.technician_id]:[])).map(id=>technicians.find(tech=>tech.id===id)?.name).filter(Boolean).join(", ");
        const started=new Date(startedAt);const ended=new Date(finishedAt);const minutes=Math.max(0,Math.floor(ended.getTime()/60000)-Math.floor(started.getTime()/60000));
        const message=`âœ… ATENDIMENTO CONCLUÍDO\nðŸ¢ Unidade: ${unitName}\nðŸ‘¤ Técnico(s): ${names||"Não informado"}\nðŸ“… Data: ${ended.toLocaleDateString("pt-BR")}\nâ° Entrada: ${started.toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})} · Saída: ${ended.toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})}\nâ±ï¸ Tempo de chamado: ${Math.floor(minutes/60)}h ${String(minutes%60).padStart(2,"0")}min`;
        const phone=String(checklist.whatsapp||units.find(unit=>unit.id===orderForChecklist?.unit_id)?.phone||"").replace(/\D/g,"");
        const whatsappUrl=`https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
        const whatsappWindow=pendingWhatsAppWindow;pendingWhatsAppWindow=null;
        if(whatsappWindow&&!whatsappWindow.closed)whatsappWindow.location.href=whatsappUrl;
        else window.open(whatsappUrl,"_blank","noopener,noreferrer");
      }
      setForm(null); setSelectedProduct(null); setSelectedTicket(null); setSelectedOrder(null); setSelectedSupplier(null); setUnitParent(null); setSelectedUnit(null); await load(); if(continueToChecklist&&orderForChecklist){setChecklistAction(action as "start"|"finish");setChecklistOrder(orderForChecklist);}
    } catch(e) { setError(e instanceof Error ? e.message : "Não foi possível salvar o registro."); }
    finally { setBusy(false); }
  }
  async function markPaid(entry:Entry) {
    try { await request(`/financial-entries/${entry.id}`, {method:"PATCH",body:JSON.stringify({status:entry.status === "pago" ? "pendente" : "pago"})}); await load(); }
    catch(e) { setError(e instanceof Error ? e.message : "Falha ao atualizar lançamento."); }
  }
  async function markOrderDone(order:WorkOrder) {
    try { await request(`/work-orders/${order.id}`, {method:"PATCH",body:JSON.stringify({status:order.status === "concluida" ? "pendente" : "concluida"})}); await load(); }
    catch(e) { setError(e instanceof Error ? e.message : "Falha ao atualizar ordem."); }
  }
  async function changeOrderStatus(order:WorkOrder,status:string) {
    if(order.status===status) return;
    try { await request(`/work-orders/${order.id}`,{method:"PATCH",body:JSON.stringify({status})}); await load(); }
    catch(e) { setError(e instanceof Error?e.message:"Falha ao atualizar ordem."); }
  }
  function openOrder(order:WorkOrder) { setOrderFocusId(order.id);setOrderView("lista");navigate("Ordens de servi\u00e7o"); }
  async function changeTicketStatus(ticket:TicketRow,status:string) {
    if(ticket.status===status) return;
    try { await request(`/tickets/${ticket.id}`,{method:"PATCH",body:JSON.stringify({status})}); await load(); }
    catch(e) { setError(e instanceof Error ? e.message : "Falha ao atualizar chamado."); }
  }
  function editOrder(order:WorkOrder) { setSelectedOrder(order); setForm("edit-order"); }
  function openChecklist(order:WorkOrder) { setChecklistAction(null);setChecklistOrder(order); }
  async function showHistory(product:Product) {
    try { setMovements(await request<Movement[]>(`/products/${product.id}/movements`)); setHistoryProduct(product); }
    catch(e) { setError(e instanceof Error ? e.message : "Não foi possível carregar o histórico."); }
  }
  function shiftAgenda(direction:number) { const d=new Date(`${agendaDay}T12:00:00`); d.setDate(d.getDate()+direction*(agendaView==="mes"?new Date(d.getFullYear(),d.getMonth()+1,0).getDate():agendaView==="semana"?7:1)); setAgendaDay(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`); }
  const scheduledOrders = useMemo(()=>orders.filter(o=>o.scheduled_date).sort((a,b)=>(a.scheduled_date||"").localeCompare(b.scheduled_date||"")),[orders]);
  const agendaStatusKey=(status:string)=>status==="concluida"?"done":status==="cancelada"||status==="cancelado"?"cancelled":status==="em atendimento"||status==="em andamento"||status==="em_andamento"?"progress":"open";
  const agendaOrders=scheduledOrders.filter(order=>{const key=agendaStatusKey(order.status);const unit=units.find(u=>u.id===order.unit_id)?.name||"";const client=clients.find(c=>c.id===order.client_id)?.name||"";const query=agendaSearch.trim().toLocaleLowerCase("pt-BR");return (agendaStatusFilter==="todos"||agendaStatusFilter===key)&&(!query||`${client} ${unit} ${order.title}`.toLocaleLowerCase("pt-BR").includes(query));}).sort((a,b)=>(a.scheduled_date||"").localeCompare(b.scheduled_date||"")||(a.scheduled_time||"99:99").localeCompare(b.scheduled_time||"99:99"));
  const dayOrders = agendaOrders.filter(o=>o.scheduled_date===agendaDay);
  const agendaDate=new Date(`${agendaDay}T12:00:00`);
  const monthStart=new Date(agendaDate.getFullYear(),agendaDate.getMonth(),1,12);
  const calendarStart=new Date(monthStart);calendarStart.setDate(monthStart.getDate()-monthStart.getDay());
  const monthCellCount=Math.ceil((monthStart.getDay()+new Date(agendaDate.getFullYear(),agendaDate.getMonth()+1,0).getDate())/7)*7;
  const monthDays=Array.from({length:monthCellCount},(_,i)=>{const d=new Date(calendarStart);d.setDate(calendarStart.getDate()+i);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;});
  const weekStart=new Date(agendaDate);weekStart.setDate(agendaDate.getDate()-agendaDate.getDay());
  const weekDays=Array.from({length:7},(_,i)=>{const d=new Date(weekStart);d.setDate(weekStart.getDate()+i);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;});
  const agendaHeading=agendaView==="dia"?agendaDate.toLocaleDateString("pt-BR",{weekday:"long",day:"2-digit",month:"long",year:"numeric"}):agendaView==="semana"?`${new Date(`${weekDays[0]}T12:00:00`).toLocaleDateString("pt-BR",{day:"2-digit",month:"short"})} · ${new Date(`${weekDays[6]}T12:00:00`).toLocaleDateString("pt-BR",{day:"2-digit",month:"short",year:"numeric"})}`:agendaDate.toLocaleDateString("pt-BR",{month:"long",year:"numeric"});
  const lowStock = products.filter(p=>p.quantity<=p.minimum_quantity);
  const clientQuery=clientSearch.trim().toLocaleLowerCase("pt-BR");
  const visibleClients=clients.filter(client=>!clientQuery||`${client.name} ${client.phone||""} ${client.email||""} ${client.address||""}`.toLocaleLowerCase("pt-BR").includes(clientQuery)||units.some(unit=>unit.client_id===client.id&&`${unit.name} ${unit.sigla||""} ${unit.address} ${unit.contact_name||""} ${unit.phone||""}`.toLocaleLowerCase("pt-BR").includes(clientQuery)));
  const openTickets = tickets.filter(t=>t.status!=="concluido");
  const visibleTickets=tickets.filter(ticket=>{
    const unitName=units.find(unit=>unit.id===ticket.unit_id)?.name||"";
    const clientName=clients.find(client=>client.id===ticket.client_id)?.name||"";
    const query=ticketSearch.trim().toLocaleLowerCase("pt-BR");
    return (!query||`${ticket.id} ${ticket.title} ${ticket.description||""} ${unitName} ${clientName}`.toLocaleLowerCase("pt-BR").includes(query))&&(ticketPriority==="todas"||ticket.priority===ticketPriority);
  });
  const visibleOrders=orders.filter(order=>{
    const unitName=units.find(unit=>unit.id===order.unit_id)?.name||"";
    const clientName=clients.find(client=>client.id===order.client_id)?.name||"";
    const query=orderSearch.trim().toLocaleLowerCase("pt-BR");
    return (!query||`${order.id} ${order.title} ${order.description||""} ${unitName} ${clientName}`.toLocaleLowerCase("pt-BR").includes(query))&&(orderStatusFilter==="todos"||(orderStatusFilter==="abertas"?order.status!=="concluida"&&order.status!=="cancelada":orderStatusFilter==="concluidas"?order.status==="concluida":order.status==="cancelada"));
  });
  const openOrders = orders.filter(o=>o.status!=="concluida"&&o.status!=="cancelada");
  const todayOrders = scheduledOrders.filter(o=>o.scheduled_date===today()&&o.status!=="cancelada").sort((a,b)=>(a.scheduled_time||"99:99").localeCompare(b.scheduled_time||"99:99"));
  const overdueOrders = openOrders.filter(o=>!!o.scheduled_date&&o.scheduled_date<today());
  const unassignedOrders = openOrders.filter(o=>!o.technician_id);
  const financeEntries = entries.filter(entry=>entry.entry_type===(financeView==="despesas"?"despesa":"receita"));
  const activeSuppliers=suppliers.filter(supplier=>supplier.active);
  const supplierCategories=[...new Set(suppliers.map(supplier=>supplier.category).filter((category):category is string=>!!category))].sort((a,b)=>a.localeCompare(b,"pt-BR"));
  const visibleSuppliers=suppliers.filter(supplier=>{
    const query=supplierSearch.trim().toLocaleLowerCase("pt-BR");
    const matchesQuery=!query||`${supplier.name} ${supplier.category||""} ${supplier.document||""} ${supplier.contact_name||""} ${supplier.phone||""} ${supplier.email||""}`.toLocaleLowerCase("pt-BR").includes(query);
    return matchesQuery&&(supplierStatus==="todos"||(supplierStatus==="ativos"?supplier.active:!supplier.active))&&(supplierCategory==="todas"||supplier.category===supplierCategory);
  });
  const linkedTicketIds = new Set(orders.map(o=>o.ticket_id).filter((id):id is number=>typeof id==="number"));
  const stockValue = products.reduce((sum,p)=>sum+p.quantity*Number(p.unit_price),0);
  const paidIncome = entries.filter(e=>e.entry_type==="receita"&&e.status==="pago").reduce((s,e)=>s+Number(e.amount),0);
  const openIncome = entries.filter(e=>e.entry_type==="receita"&&e.status==="pendente").reduce((s,e)=>s+Number(e.amount),0);
  const openExpense = entries.filter(e=>e.entry_type==="despesa"&&e.status==="pendente").reduce((s,e)=>s+Number(e.amount),0);
  const paidExpense = entries.filter(e=>e.entry_type==="despesa"&&e.status==="pago").reduce((s,e)=>s+Number(e.amount),0);
  const dayKey=(date:Date)=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
  const weeklyActivity=Array.from({length:7},(_,index)=>{const date=new Date();date.setHours(12,0,0,0);date.setDate(date.getDate()-(6-index));const key=dayKey(date);return {key,label:date.toLocaleDateString("pt-BR",{day:"2-digit",month:"short"}),orders:orders.filter(o=>o.created_at?.slice(0,10)===key).length};});
  const activityMax=Math.max(1,...weeklyActivity.map(day=>day.orders));
  const chartPoint=(value:number,index:number)=>({x:24+index*112,y:132-(value/activityMax)*100});
  
  const orderPoints=weeklyActivity.map((day,index)=>chartPoint(day.orders,index));
  const totalPoints=weeklyActivity.map((day,index)=>chartPoint(day.orders,index));
  const activityLine=totalPoints.map(point=>`${point.x},${point.y}`).join(" ");
  const activityArea=`M ${totalPoints[0].x},132 L ${activityLine} L ${totalPoints[6].x},132 Z`;
  const navQuery=navSearch.trim().toLocaleLowerCase("pt-BR");
  const navMatches=(item:NavItem):boolean=>item.label.toLocaleLowerCase("pt-BR").includes(navQuery)||!!item.children?.some(navMatches);
  const visibleNav=nav.filter(navMatches);
  const visibleGroups=navGroups.map(group=>({...group,items:group.items.filter(navMatches)})).filter(group=>group.items.length>0);
  const visibleNavAfter=navAfterGroups.filter(navMatches);
  const visibleNavEnd=navEnd.filter(navMatches);

  function renderNavItem(item:NavItem,prefix:string):ReactNode {
    const Icon=item.icon;
    const key=`${prefix}/${item.label}`;
    if(item.children?.length) {
      const collapsed=!!collapsedGroups[key];
      const active=item.children.some(child=>matchesPage(child,page));
      return <div className={`nav-group nav-subgroup ${active?"group-active":""}`} key={key}>
        <div className="nav-subgroup-head"><button title={sidebarCollapsed?item.label:undefined} className={page===(item.page||item.label)?"nav-item nested selected":"nav-item nested"} onClick={()=>navigate(item.label,item.page||item.label)}><Icon size={17}/><span>{item.label}</span></button><button className="nav-subgroup-toggle" aria-label={`${collapsed?"Expandir":"Recolher"} ${item.label}`} aria-expanded={!collapsed} onClick={()=>setCollapsedGroups(current=>({...current,[key]:!current[key]}))}><ChevronRight className={collapsed?"group-chevron":"group-chevron expanded"} size={14}/></button></div>
        {!collapsed&&<div className="nav-group-items">{item.children.map(child=>renderNavItem(child,key))}</div>}
      </div>;
    }
    const route=item.page||item.label;
    return <button key={key} title={sidebarCollapsed?item.label:undefined} className={page===route?"nav-item nested selected":"nav-item nested"} onClick={()=>navigate(item.label,route)}><Icon size={17}/><span>{item.label}</span></button>;
  }

  if(!authReady)return <main className="login-screen"><div className="login-card">Carregando acesso seguro…</div></main>;
  if(!authUser)return <LoginScreen setupNeeded={setupNeeded} busy={authBusy} error={authError} onSubmit={data=>void authenticate(data)} onRegister={data=>void registerTechnician(data)}/>;
  return <div className={`shell theme-${theme} ${sidebarCollapsed?"sidebar-collapsed":""} ${page==="Dashboard"||page==="Agenda"?"dashboard-active":""}`}>
    <aside className={`sidebar ${menuOpen?"open":""}`}>
      <div className="brand"><div className="brand-identity"><div className="brand-mark"><img src="/aguia-sidebar.png" alt="Águia Gestão" /></div></div><button className="sidebar-collapse-btn" title={sidebarCollapsed?"Expandir menu":"Recolher menu"} aria-label={sidebarCollapsed?"Expandir menu":"Recolher menu"} onClick={()=>setSidebarCollapsed(!sidebarCollapsed)}>{sidebarCollapsed?<ChevronRight size={17}/>:<ChevronLeft size={17}/>}</button></div>
      <div className="workspace"><span className="status-dot"/><span>Ambiente de desenvolvimento</span></div>
      {sidebarCollapsed?<button className="sidebar-search-mini" title="Pesquisar abas" aria-label="Pesquisar abas" onClick={()=>setSidebarCollapsed(false)}><Search size={17}/></button>:<label className="sidebar-search"><Search size={16}/><input value={navSearch} onChange={e=>setNavSearch(e.target.value)} placeholder="Buscar no menu..."/>{navSearch&&<button type="button" onClick={()=>setNavSearch("")} aria-label="Limpar busca"><X size={13}/></button>}</label>}
      <nav className="sidebar-nav">
        {visibleNav.map(item=>{const Icon=item.icon;return <button key={item.label} title={sidebarCollapsed?item.label:undefined} className={page===(item.page||item.label)?"nav-item selected":"nav-item"} onClick={()=>navigate(item.label,item.page||item.label)}><Icon size={18}/><span>{item.label}</span></button>})}
        {visibleGroups.map(group=>{const GroupIcon=group.icon;const collapsed=!!collapsedGroups[group.label];const active=group.items.some(item=>matchesPage(item,page));return <div className={`nav-group ${active?"group-active":""}`} key={group.label}>
          <button className="nav-group-toggle" title={sidebarCollapsed?group.label:undefined} aria-expanded={!collapsed} onClick={()=>setCollapsedGroups(current=>({...current,[group.label]:!current[group.label]}))}><GroupIcon size={18}/><span>{group.label}</span><ChevronRight className={collapsed?"group-chevron":"group-chevron expanded"} size={15}/></button>
          {!collapsed&&<div className="nav-group-items">{group.items.map(item=>renderNavItem(item,group.label))}</div>}
        </div>})}
        {visibleNavAfter.map(item=>{const Icon=item.icon;return <button key={item.label} title={sidebarCollapsed?item.label:undefined} className={page===(item.page||item.label)?"nav-item selected":"nav-item"} onClick={()=>navigate(item.label,item.page||item.label)}><Icon size={18}/><span>{item.label}</span></button>})}
        {visibleNavEnd.map(item=>{const Icon=item.icon;return <button key={item.label} title={sidebarCollapsed?item.label:undefined} className={page===(item.page||item.label)?"nav-item selected":"nav-item"} onClick={()=>navigate(item.label)}><Icon size={18}/><span>{item.label}</span></button>})}
      </nav>
      <div className="theme-switch"><span>Alternar modo escuro</span><button type="button" role="switch" aria-checked={theme==="dark"} aria-label="Alternar tema escuro" title={theme==="dark"?"Ativar tema claro":"Ativar tema escuro"} onClick={()=>{const next=theme==="dark"?"light":"dark";setTheme(next);localStorage.setItem("aguia-theme",next)}}><i/></button></div>
      <div className="sidebar-bottom"><div className="avatar">{authUser.name.split(/\s+/).map(part=>part[0]).slice(0,2).join("").toUpperCase()}</div><div className="sidebar-user-copy"><b>{authUser.name}</b><small>{authUser.role==="admin"?"Administrador":"Técnico"}</small></div><button type="button" className="logout-btn" title="Sair da conta" aria-label="Sair da conta" onClick={()=>{localStorage.removeItem("aguia-access-token");setAuthUser(null)}}><LogOut size={15}/></button></div>
    </aside>
    {menuOpen&&<button type="button" className="mobile-drawer-backdrop" aria-label="Fechar menu" onClick={()=>setMenuOpen(false)}/>}
    <main className="main">
      <header className="topbar"><button className="icon-btn mobile-menu" aria-expanded={menuOpen} onClick={()=>setMenuOpen(!menuOpen)} aria-label={menuOpen?"Fechar menu":"Abrir menu"}><Menu/></button><div className="crumb">Águia Gestão <span>/</span> {pageTitle(page)}</div><div className="top-actions"><div className="search"><Search size={16}/><input placeholder="Buscar registros..." /></div><button className="icon-btn" aria-label="Notificações"><Bell size={18}/></button><div className="user-badge">AP</div></div></header>
      <section className="content">
        <div className="page-heading"><div><div className="eyebrow">{pageSection(page)}</div><h1>{pageTitle(page)}</h1><p>{pageDescription(page)}</p></div><div className={`heading-actions ${page==="Agenda"?"agenda-heading-actions":""}`}>{page==="Agenda"&&<><button className="primary-btn agenda-new-order" onClick={()=>setForm("order")}><Plus size={17}/>Novo</button><div className="calendar-view-switch agenda-top-views">{([ ["dia","Dia"],["semana","Semana"],["mes","Calendário"] ] as const).map(([key,label])=><button key={key} className={agendaView===key?"active":""} onClick={()=>setAgendaView(key)}>{label}</button>)}</div></>}{page==="Estoque"&&<button className="primary-btn" onClick={()=>setForm("product")}><Plus size={17}/>Novo produto</button>}{page==="Financeiro"&&financeView!=="orcamentos"&&<button className="primary-btn" onClick={()=>{setNewEntryType(financeView==="despesas"?"despesa":"receita");setForm("entry")}}><Plus size={17}/>{financeView==="despesas"?"Nova despesa":"Novo lançamento"}</button>}{page==="Ordens de servi\u00e7o"&&<button className="primary-btn" onClick={()=>setForm("order")}><Plus size={17}/>Nova ordem</button>}{page==="Clientes e endere\u00e7os"&&<button className="primary-btn" onClick={()=>setForm("client")}><Plus size={17}/>Novo cliente</button>}{page==="Fornecedores"&&<button className="primary-btn" onClick={()=>setForm("supplier")}><Plus size={17}/>Novo fornecedor</button>}</div></div>
        {error&&<div className="error" role="alert">{error}<button className="error-close" onClick={()=>setError("")} aria-label="Fechar aviso"><X size={15}/></button></div>}
        {form&&<Modal title={formTitle(form,movementType,selectedTicket,unitParent,selectedSupplier,selectedUnit)} status={form==="edit-order"?selectedOrder?.status:undefined} onClose={()=>{setForm(null);setSelectedProduct(null);setSelectedTicket(null);setSelectedOrder(null);setSelectedSupplier(null);setUnitParent(null);setSelectedUnit(null)}}><Form mode={form} clients={clients} units={units} technicians={technicians} entryTypeDefault={newEntryType} selectedProduct={selectedProduct} selectedTicket={selectedTicket} selectedOrder={selectedOrder} selectedSupplier={selectedSupplier} unitParent={unitParent} editingUnit={selectedUnit} contactUnit={contactUnit} movementType={movementType} setMovementType={setMovementType} busy={busy} onCancel={()=>{setForm(null);setSelectedProduct(null);setSelectedTicket(null);setSelectedOrder(null);setSelectedSupplier(null);setUnitParent(null);setSelectedUnit(null)}} onOpenChecklist={openChecklist} onSubmit={submit}/></Modal>}
        {checklistOrder&&<ChecklistModal order={checklistOrder} unitLabel={units.find(u=>u.id===checklistOrder.unit_id)?.name||clients.find(c=>c.id===checklistOrder.client_id)?.name||""} unitSigla={units.find(u=>u.id===checklistOrder.unit_id)?.sigla||""} unitContactName={units.find(u=>u.id===checklistOrder.unit_id)?.contact_name||""} unitPhone={units.find(u=>u.id===checklistOrder.unit_id)?.phone||""} contacts={unitContacts} action={checklistAction} onClose={()=>{setChecklistOrder(null);setChecklistAction(null)}} onRefresh={load}/>}
        {historyProduct&&<Modal title={`Movimentações · ${historyProduct.name}`} onClose={()=>setHistoryProduct(null)}><div className="history-list">{movements.length===0?<Empty>Nenhuma movimentação registrada para este produto.</Empty>:movements.map(m=><div className="list-row" key={m.id}><div className={`row-icon ${m.movement_type==="entrada"?"order-icon":"ticket-icon"}`}>{m.movement_type==="entrada"?<ArrowDownLeft size={17}/>:<ArrowUpRight size={17}/>}</div><div className="row-main"><b>{m.movement_type==="entrada"?"Entrada":"Saída"} de {m.quantity} un.</b><small>{m.notes||"Sem observação"}</small></div><span className="muted">{new Date(m.created_at).toLocaleDateString("pt-BR")}</span></div>)}</div></Modal>}
        {page==="Dashboard"&&<>
          <div className="welcome"><div><span className="welcome-label">HOJE · {new Date().toLocaleDateString("pt-BR",{weekday:"long",day:"2-digit",month:"long"})}</span><h2>Olá, equipe Águia.</h2><p>Acompanhe ordens de serviço, atendimentos e agenda em um só lugar.</p></div><button className="dashboard-cta" onClick={()=>setForm("order")}><Plus size={16}/>Nova ordem</button></div>
          <div className="stats dashboard-stats"><Stat tone="blue" label="Ordens em aberto" value={openOrders.length} icon={<ClipboardList/>} note="Aguardando ou em execução"/><Stat tone="pink" label="Atendimentos hoje" value={todayOrders.length} icon={<CalendarDays/>} note="Na agenda de hoje"/><Stat tone="amber" label="Ordens atrasadas" value={overdueOrders.length} icon={<Activity/>} note="Data prevista já passou"/><Stat tone="violet" label="Sem técnico" value={unassignedOrders.length} icon={<Users/>} note="Precisam de atribuição"/></div>
          <section className="dashboard-chart panel"><div className="chart-heading"><div><span className="chart-kicker">ÚLTIMOS 7 DIAS</span><h3>Atividade operacional</h3><p>Ordens de serviço registradas por dia</p></div><div className="chart-legend"><span><i className="legend-order"/>Ordens de serviço</span></div></div><svg className="activity-chart" viewBox="0 0 720 160" role="img" aria-label="Atividade operacional nos últimos sete dias"><defs><linearGradient id="activityFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#029cf5" stopOpacity=".36"/><stop offset="100%" stopColor="#029cf5" stopOpacity="0"/></linearGradient></defs>{[32,82,132].map(y=><line key={y} x1="24" x2="696" y1={y} y2={y} className="chart-grid"/>)}<path d={activityArea} fill="url(#activityFill)"/><polyline points={orderPoints.map(p=>`${p.x},${p.y}`).join(" ")} className="chart-line chart-line-order"/>{weeklyActivity.map((day,index)=>{const point=chartPoint(day.orders,index);return <circle key={day.key} cx={point.x} cy={point.y} r="3.5" className="chart-dot"/>})}</svg><div className="chart-dates">{weeklyActivity.map(day=><span key={day.key}>{day.label}</span>)}</div></section>
          <div className="ops-grid dashboard-operations"><div className="panel dashboard-today-panel"><Panel title="Atendimentos de hoje" subtitle="Ordens previstas para a data atual" action={<button className="text-btn" onClick={()=>navigate("Agenda")}>Abrir agenda â†’</button>}/>{todayOrders.length===0?<Empty>Nenhum atendimento agendado para hoje.</Empty>:<div className="ops-list">{todayOrders.slice(0,5).map(order=>{const unit=units.find(u=>u.id===order.unit_id);const client=clients.find(c=>c.id===order.client_id);const technician=technicians.find(t=>t.id===order.technician_id);return <article className="ops-card order-ops-card" key={order.id}><div className="ops-card-top"><span className="eyebrow">OS-{String(order.id).padStart(4,"0")} · {serviceTypeLabel(order.service_type)}</span><Status value={order.status}/></div><h3>{order.title}</h3><p>{[client?.name,unit?.name].filter(Boolean).join(" · ")||"Cliente ou unidade não vinculados"}</p><small>{assignedTechnicianNames(order,technicians)?`Técnicos: ${assignedTechnicianNames(order,technicians)}`:"Sem técnico atribuído"}</small><div className="ops-card-bottom"><button className="secondary-btn" onClick={()=>openOrder(order)}><ClipboardList size={14}/>Abrir ordem</button><button className="secondary-btn" onClick={()=>openChecklist(order)}><Check size={14}/>Checklist</button></div></article>})}</div>}</div><div className="panel dashboard-attention-panel"><Panel title="Precisam de atenção" subtitle="Pendências que podem afetar a operação" action={<button className="text-btn" onClick={()=>navigate("Ordens de servi\u00e7o")}>Ver ordens â†’</button>}/><div className="ops-list attention-list"><button className="attention-row" onClick={()=>{setOrderStatusFilter("abertas");navigate("Ordens de servi\u00e7o")}}><span className="attention-icon overdue"><Activity size={16}/></span><span><b>Ordens atrasadas</b><small>Prazo previsto já passou</small></span><strong>{overdueOrders.length}</strong></button><button className="attention-row" onClick={()=>{setOrderStatusFilter("abertas");navigate("Ordens de servi\u00e7o")}}><span className="attention-icon unassigned"><Users size={16}/></span><span><b>Sem técnico</b><small>Ordens aguardando atribuição</small></span><strong>{unassignedOrders.length}</strong></button><button className="attention-row" onClick={()=>navigate("Estoque")}><span className="attention-icon stock-alert"><Package size={16}/></span><span><b>Estoque no mínimo</b><small>Itens que precisam de reposição</small></span><strong>{lowStock.length}</strong></button></div></div></div>
        </>}
        {page==="Fornecedores"&&<section className="suppliers-page"><div className="stats stats-three supplier-stats"><Stat tone="blue" label="Fornecedores ativos" value={activeSuppliers.length} icon={<Truck/>} note="Disponíveis para novas compras"/><Stat tone="violet" label="Categorias" value={supplierCategories.length} icon={<Package/>} note="Tipos de fornecimento cadastrados"/><Stat tone="amber" label="Inativos" value={suppliers.length-activeSuppliers.length} icon={<Activity/>} note="Cadastros pausados"/></div><div className="panel table-panel suppliers-panel"><Panel title="Diretório de fornecedores" subtitle="Contatos, categorias e dados comerciais dos parceiros"/><div className="supplier-toolbar"><label className="ticket-board-search"><Search size={15}/><input value={supplierSearch} onChange={e=>setSupplierSearch(e.target.value)} placeholder="Buscar por empresa, CNPJ ou contato"/>{supplierSearch&&<button onClick={()=>setSupplierSearch("")} aria-label="Limpar busca"><X size={13}/></button>}</label><label className="supplier-filter">Categoria<select value={supplierCategory} onChange={e=>setSupplierCategory(e.target.value)}><option value="todas">Todas</option>{supplierCategories.map(category=><option key={category} value={category}>{category}</option>)}</select></label><div className="supplier-status-tabs">{([ ["ativos","Ativos"],["inativos","Inativos"],["todos","Todos"] ] as const).map(([key,label])=><button key={key} className={supplierStatus===key?"active":""} onClick={()=>setSupplierStatus(key)}>{label}</button>)}</div><span className="ticket-result-count">{visibleSuppliers.length} fornecedores</span></div><div className="inventory-wrap">{visibleSuppliers.length===0?<Empty>{suppliers.length===0?"Nenhum fornecedor cadastrado. Adicione parceiros de materiais e serviços para organizar seus contatos.":"Nenhum fornecedor encontrado com esses filtros."}</Empty>:<table className="data-table supplier-table"><thead><tr><th>Fornecedor</th><th>Categoria</th><th>Contato</th><th>Telefone</th><th>E-mail</th><th>Status</th><th>Ações</th></tr></thead><tbody>{visibleSuppliers.map(supplier=><tr key={supplier.id}><td><b>{supplier.name}</b><small>{supplier.document||"CNPJ/CPF não informado"}</small></td><td>{supplier.category||"â€”"}</td><td>{supplier.contact_name||"â€”"}</td><td>{supplier.phone||"â€”"}</td><td>{supplier.email||"â€”"}</td><td><span className={`pill ${supplier.active?"done":"inactive"}`}>{supplier.active?"Ativo":"Inativo"}</span></td><td><div className="supplier-actions"><button className="history-btn" onClick={()=>{setSelectedSupplier(supplier);setForm("edit-supplier")}}><Pencil size={13}/>Editar</button><button className="supplier-toggle" onClick={async()=>{try{await request(`/suppliers/${supplier.id}`,{method:"PATCH",body:JSON.stringify({active:!supplier.active})});await load()}catch(e){setError(e instanceof Error?e.message:"Não foi possível atualizar o fornecedor.")}}}>{supplier.active?"Inativar":"Reativar"}</button></div></td></tr>)}</tbody></table>}</div></div></section>}
        {page==="T\u00e9cnicos"&&<section className="technician-page"><div className="technician-summary"><article><span><Users size={15}/>Equipe cadastrada</span><strong>{technicians.length}</strong><small>Profissionais vinculados à operação</small></article><article><span><Check size={15}/>Ativos</span><strong>{technicians.filter(t=>t.active).length}</strong><small>Disponíveis para atendimentos</small></article><article><span><Activity size={15}/>Inativos</span><strong>{technicians.filter(t=>!t.active).length}</strong><small>Cadastros temporariamente pausados</small></article></div><div className="panel table-panel technician-panel"><Panel title="Equipe técnica" subtitle="Contatos e disponibilidade da equipe" action={<button className="primary-btn technician-add" onClick={()=>setForm("technician")}><Plus size={14}/>Novo técnico</button>}/><div className="inventory-wrap">{technicians.length===0?<Empty>Nenhum técnico cadastrado. Adicione profissionais da equipe para vinculá-los aos atendimentos.</Empty>:<table className="data-table technician-table"><thead><tr><th>Técnico</th><th>Telefone</th><th>E-mail</th><th>Status</th><th>Ação</th></tr></thead><tbody>{technicians.map(t=><tr key={t.id}><td><span className="technician-identity"><span className="technician-avatar">{t.name.split(/\s+/).map(part=>part[0]).slice(0,2).join("").toUpperCase()}</span><span><b>{t.name}</b><small>Equipe técnica</small></span></span></td><td>{t.phone||"â€”"}</td><td>{t.email||"â€”"}</td><td><Status value={t.active?"Ativo":"Inativo"}/></td><td><button className="history-btn" onClick={async()=>{await request(`/technicians/${t.id}`,{method:"PATCH",body:JSON.stringify({active:!t.active})});await load()}}>{t.active?"Inativar":"Reativar"}</button></td></tr>)}</tbody></table>}</div></div></section>}
        {page==="Ordens de servi\u00e7o"&&<section className="panel table-panel orders-desk-panel"><Panel title="Ordens de serviço" subtitle="Acompanhe cada atendimento do recebimento à conclusão"/><div className="ticket-board-toolbar order-board-toolbar"><div className="order-filter-tabs">{([ ["todos","Todas"],["abertas","Em aberto"],["concluidas","Concluídas"],["canceladas","Canceladas"] ] as const).map(([key,label])=><button key={key} className={orderStatusFilter===key?"active":""} onClick={()=>setOrderStatusFilter(key)}>{label}<b>{key==="todos"?orders.length:key==="abertas"?openOrders.length:key==="concluidas"?orders.filter(o=>o.status==="concluida").length:orders.filter(o=>o.status==="cancelada").length}</b></button>)}</div><label className="ticket-board-search"><Search size={15}/><input value={orderSearch} onChange={e=>setOrderSearch(e.target.value)} placeholder="Buscar OS, cliente ou unidade"/>{orderSearch&&<button onClick={()=>setOrderSearch("")} aria-label="Limpar busca"><X size={13}/></button>}</label><div className="order-view-switch order-filter-tabs"><button className={orderView==="lista"?"active":""} onClick={()=>setOrderView("lista")}>Lista</button><button className={orderView==="kanban"?"active":""} onClick={()=>setOrderView("kanban")}>Kanban</button></div></div>{orderView==="lista"?<OrderDesk rows={visibleOrders} units={units} clients={clients} technicians={technicians} onEdit={editOrder}/>:<OrderKanban rows={visibleOrders} clients={clients} units={units} technicians={technicians} onEdit={editOrder} onChecklist={openChecklist} onStatus={changeOrderStatus}/>}</section>}
        {page==="Clientes e endere\u00e7os"&&<div className="panel table-panel"><Panel title="Clientes e unidades" subtitle="Cada cliente é o cadastro principal; as unidades ficam vinculadas abaixo."/><div className="client-directory-toolbar"><label className="ticket-board-search"><Search size={15}/><input type="search" value={clientSearch} onChange={e=>setClientSearch(e.target.value)} placeholder="Buscar academia, unidade, sigla ou endereço" aria-label="Buscar clientes e unidades"/>{clientSearch&&<button type="button" onClick={()=>setClientSearch("")} aria-label="Limpar busca"><X size={13}/></button>}</label><span>{visibleClients.length} {visibleClients.length===1?"cliente":"clientes"}</span></div>{visibleClients.length?<div className="client-hierarchy">{visibleClients.map(c=>{const children=units.filter(u=>u.client_id===c.id);return <article className="client-parent" key={c.id}><div className="client-parent-head"><div className="row-icon"><Users size={17}/></div><div className="client-parent-info"><b>{c.name}</b><small>{c.address||"Endereço principal não informado"}</small><small>{c.phone||c.email||"Sem contato cadastrado"}</small></div><span className="unit-count">{children.length} {children.length===1?"unidade":"unidades"}</span><button className="primary-btn add-unit-btn" onClick={()=>{setUnitParent(c);setSelectedUnit(null);setForm("unit")}}><Plus size={15}/>Adicionar unidade</button></div><div className="unit-children">{children.length===0?<div className="no-units">Nenhuma unidade cadastrada para este cliente.</div>:children.map(u=><div className="unit-child" key={u.id}><div className="unit-icon"><Building2 size={16}/></div><div className="unit-info"><b>{u.name}</b><small>{u.address}</small>{u.address&&<div className="unit-map-links"><a className="unit-map-link" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(u.address)}`} target="_blank" rel="noopener noreferrer"><MapPin size={13}/>Google Maps</a><a className="unit-map-link" href={`https://waze.com/ul?q=${encodeURIComponent(u.address)}&navigate=yes`} target="_blank" rel="noopener noreferrer"><Navigation size={13}/>Waze</a></div>}<small>Sigla: {u.sigla||"Não cadastrada"}</small>{(u.contact_name||u.phone)&&<small>{[u.contact_name,u.phone].filter(Boolean).join(" · ")}</small>}{unitContacts.filter(contact=>contact.unit_id===u.id).map(contact=><small key={contact.id}>{({lider:"Líder",gerente:"Gerente",colaborador:"Colaborador"} as Record<string,string>)[contact.role]}: {contact.name}{contact.phone?" · "+contact.phone:""}</small>)}<div className="heading-actions"><button className="history-btn" onClick={()=>{setSelectedUnit(u);setUnitParent(clients.find(client=>client.id===u.client_id)||null);setForm("edit-unit")}}><Pencil size={13}/>Editar unidade</button><button className="history-btn" onClick={()=>{setContactUnit(u);setForm("unit-contact")}}>+ Responsável da unidade</button></div></div></div>)}</div></article>})}</div>:<Empty>{clientQuery?"Nenhum cliente ou unidade encontrado. Tente outro nome, sigla ou endereço.":"Nenhum cliente cadastrado ainda."}</Empty>}</div>}
        {page==="Agenda"&&<>
          <div className="panel agenda-panel calendar-panel"><div className="agenda-toolbar calendar-toolbar"><div className="calendar-controls"><button className="secondary-btn square-btn" onClick={()=>shiftAgenda(-1)} aria-label="Período anterior"><ChevronLeft size={17}/></button><button className="secondary-btn square-btn" onClick={()=>shiftAgenda(1)} aria-label="Próximo período"><ChevronRight size={17}/></button></div><div className="calendar-heading"><strong>{agendaHeading}</strong></div><label className="agenda-client-search"><Search size={15}/><input value={agendaSearch} onChange={e=>setAgendaSearch(e.target.value)} placeholder="Filtrar por cliente..."/>{agendaSearch&&<button onClick={()=>setAgendaSearch("")} aria-label="Limpar busca"><X size={13}/></button>}</label><button className="text-btn today-btn" onClick={()=>setAgendaDay(today())}>Hoje</button></div><div className="agenda-filters"><span>Filtrar:</span>{([ ["open","Agendado"],["progress","Em andamento"],["done","Concluído"],["cancelled","Cancelado"] ] as const).map(([key,label])=><button key={key} className={`agenda-filter ${agendaStatusFilter===key?"active":""} filter-${key}`} onClick={()=>setAgendaStatusFilter(agendaStatusFilter===key?"todos":key)}><i/>{label}</button>)}{agendaStatusFilter!=="todos"&&<button className="agenda-clear-filters" onClick={()=>setAgendaStatusFilter("todos")}>Limpar</button>}</div>
            {agendaView==="mes"&&<div className="calendar-grid month-grid"><div className="calendar-weekdays">{["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"].map(day=><span key={day}>{day}</span>)}</div><div className="month-cells">{monthDays.map(date=>{const dateObj=new Date(`${date}T12:00:00`);const items=agendaOrders.filter(order=>order.scheduled_date===date);return <button key={date} className={`month-cell ${date.slice(0,7)!==agendaDay.slice(0,7)?"outside-month":""} ${date===today()?"is-today":""} ${date===agendaDay?"is-selected":""}`} onClick={()=>{setAgendaDay(date);setAgendaView("dia")}}><span className="month-date">{dateObj.getDate()}</span>{items.slice(0,3).map(order=><span className={`calendar-event event-${agendaStatusKey(order.status)}`} key={order.id}><b>{units.find(unit=>unit.id===order.unit_id)?.name||clients.find(client=>client.id===order.client_id)?.name||`OS-${order.id}`}</b><small>{order.scheduled_time?.slice(0,5)||"Dia todo"} - {order.title}</small></span>)}{items.length>3&&<small className="more-events">+{items.length-3} atendimentos</small>}</button>})}</div></div>}
            {agendaView==="semana"&&<div className="calendar-grid week-grid"><div className="week-head"><span>Horário</span>{weekDays.map(date=><button key={date} className={date===today()?"today-column":""} onClick={()=>{setAgendaDay(date);setAgendaView("dia")}}><small>{new Date(`${date}T12:00:00`).toLocaleDateString("pt-BR",{weekday:"short"})}</small><b>{new Date(`${date}T12:00:00`).getDate()}</b></button>)}</div><div className="week-all-day"><span>Atendimentos</span>{weekDays.map(date=><div key={date}>{agendaOrders.filter(order=>order.scheduled_date===date).map(order=><button key={order.id} className={`calendar-event event-${agendaStatusKey(order.status)}`} onClick={()=>{setAgendaDay(date);setAgendaView("dia")}}><b>{units.find(unit=>unit.id===order.unit_id)?.name||clients.find(client=>client.id===order.client_id)?.name||"Atendimento"}</b><small>{order.scheduled_time?.slice(0,5)||"Dia todo"} - {order.title}</small></button>)}</div>)}</div></div>}
            {agendaView==="dia"&&<div className="day-view"><div className="day-date-mark"><b>{agendaDate.getDate()}</b><span>{agendaDate.toLocaleDateString("pt-BR",{weekday:"long",month:"long",year:"numeric"})}</span></div>{dayOrders.length===0?<Empty>Nenhum serviço agendado para este dia. Use Agendar serviço para adicionar uma ordem.</Empty>:dayOrders.map(order=>{const unit=units.find(u=>u.id===order.unit_id);const client=clients.find(c=>c.id===order.client_id);const technician=technicians.find(t=>t.id===order.technician_id);return <article className="agenda-card" key={order.id}><div className="agenda-card-title"><div><span className="eyebrow">OS-{String(order.id).padStart(4,"0")} · {serviceTypeLabel(order.service_type)}</span><h3>{order.title}</h3></div><Status value={order.status}/></div><p>{order.description||"Sem descrição"}</p><small>{[client?.name,unit?.name,assignedTechnicianNames(order,technicians)?`Técnicos: ${assignedTechnicianNames(order,technicians)}`:"Sem técnico atribuído",order.address||"Endereço não informado"].filter(Boolean).join(" · ")}</small><div className="agenda-card-actions"><button className="secondary-btn" onClick={()=>editOrder(order)}><Pencil size={14}/>Editar</button><button className="secondary-btn" onClick={()=>openChecklist(order)}><ClipboardList size={14}/>Checklist</button><button className="secondary-btn" onClick={()=>void markOrderDone(order)}><Check size={14}/>{order.status==="concluida"?"Reabrir ordem":"Concluir"}</button></div></article>})}</div>}
          </div>
        </>}
        {page==="Estoque"&&<>
          <div className="stats stats-three"><Stat label="Produtos cadastrados" value={products.length} icon={<Package/>} note="Itens no catálogo"/><Stat label="Itens com estoque baixo" value={lowStock.length} icon={<Activity/>} note="No limite ou abaixo"/><div className="stat-card"><div className="stat-top"><span>Valor em estoque</span><div className="stat-icon"><Wallet/></div></div><strong className="money-stat">{money(stockValue)}</strong><small>Custo por unidade de medida</small></div></div>
          {lowStock.length>0&&<div className="notice warning-notice"><Activity size={17}/><span><b>Atenção ao estoque:</b> {lowStock.map(p=>p.name).join(", ")} {lowStock.length===1?"está":"estão"} no limite mínimo ou abaixo.</span></div>}
          <div className="panel table-panel"><Panel title="Produtos" subtitle="Saldo atual, unidade de medida, custo, markup e preço de venda sugerido"/><div className="inventory-wrap">{products.length===0?<Empty>Nenhum produto cadastrado. Adicione itens para controlar o estoque.</Empty>:<table className="data-table"><thead><tr><th>Produto</th><th>Categoria</th><th>Saldo</th><th>Unidade/medida</th><th>Mínimo</th><th>Custo unitário</th><th>Markup</th><th>Preço sugerido</th><th>Ações</th></tr></thead><tbody>{products.map(p=><tr key={p.id}><td><b>{p.name}</b><small>{p.sku||"Sem SKU"}</small></td><td>{p.category||"â€”"}</td><td><span className={`quantity ${p.quantity<=p.minimum_quantity?"quantity-low":""}`}>{p.quantity}</span></td><td>{p.unit_measure||"unidade"}</td><td>{p.minimum_quantity}</td><td>{money(Number(p.unit_price))}</td><td>{Number(p.markup_percent||0).toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2})}%</td><td><b>{money(Number(p.unit_price)*(1+Number(p.markup_percent||0)/100))}</b></td><td><div className="row-actions"><button className="stock-in" onClick={()=>{setSelectedProduct(p);setMovementType("entrada");setForm("movement")}}><ArrowDownLeft size={14}/>Entrada</button><button className="stock-out" onClick={()=>{setSelectedProduct(p);setMovementType("saida");setForm("movement")}}><ArrowUpRight size={14}/>Saída</button><button className="history-btn" onClick={()=>void showHistory(p)}>Histórico</button><button className="history-btn" onClick={()=>{setSelectedProduct(p);setForm("edit-product")}} aria-label={`Editar ${p.name}`}><Pencil size={13}/>Editar</button></div></td></tr>)}</tbody></table>}</div></div>
        </>}
        {page==="Financeiro"&&<>
          <div className="stats stats-four"><div className="stat-card"><div className="stat-top"><span>Recebido</span><div className="stat-icon income-icon"><ArrowDownLeft/></div></div><strong className="money-stat">{money(paidIncome)}</strong><small>Receitas pagas</small></div><div className="stat-card"><div className="stat-top"><span>A receber</span><div className="stat-icon"><ArrowDownLeft/></div></div><strong className="money-stat">{money(openIncome)}</strong><small>Receitas pendentes</small></div><div className="stat-card"><div className="stat-top"><span>A pagar</span><div className="stat-icon expense-icon"><ArrowUpRight/></div></div><strong className="money-stat">{money(openExpense)}</strong><small>Despesas pendentes</small></div><div className="stat-card"><div className="stat-top"><span>Saldo realizado</span><div className="stat-icon"><Wallet/></div></div><strong className="money-stat">{money(paidIncome-paidExpense)}</strong><small>Receitas menos despesas pagas</small></div></div>
          <div className="panel table-panel finance-panel"><div className="finance-tabs" role="tablist" aria-label="Seções financeiras">{([ ["cobrancas","Cobranças"],["despesas","Despesas"],["orcamentos","Orçamentos"] ] as const).map(([key,label])=><button role="tab" aria-selected={financeView===key} key={key} className={financeView===key?"active":""} onClick={()=>setFinanceView(key)}>{label}{key==="cobrancas"&&<span>{entries.filter(entry=>entry.entry_type==="receita").length}</span>}{key==="despesas"&&<span>{entries.filter(entry=>entry.entry_type==="despesa").length}</span>}</button>)}</div>{financeView==="orcamentos"?<div className="finance-coming"><div className="module-placeholder-icon"><FileText size={22}/></div><div><span className="eyebrow">PRÓXIMA ETAPA</span><h2>Orçamentos</h2><p>Esta área ficará junto ao Financeiro. O fluxo de proposta, aprovação e conversão em ordem será estruturado aqui.</p></div></div>:<><div className="finance-section-heading"><div><h3>{financeView==="cobrancas"?"Cobranças":"Despesas"}</h3><p>{financeView==="cobrancas"?"Receitas e pagamentos dos clientes":"Custos e pagamentos da operação"}</p></div></div><div className="inventory-wrap">{financeEntries.length===0?<Empty>{financeView==="cobrancas"?"Nenhuma cobrança registrada.":"Nenhuma despesa registrada."}</Empty>:<table className="data-table"><thead><tr><th>Descrição</th><th>Categoria</th><th>Vencimento</th><th>Valor</th><th>Status</th><th>Ação</th></tr></thead><tbody>{financeEntries.map(e=><tr key={e.id}><td><b>{e.description}</b><small>{e.category||"Sem categoria"}</small></td><td>{e.category||"â€”"}</td><td>{dateLabel(e.due_date)}</td><td className={e.entry_type}>{money(Number(e.amount))}</td><td><Status value={e.status}/></td><td><button className="secondary-btn pay-btn" onClick={()=>void markPaid(e)}>{e.status==="pago"?"Reabrir":"Marcar pago"}</button></td></tr>)}</tbody></table>}</div></>}</div>
        </>}
        {page==="Permissões"&&<section className="permissions-page">
          <div className="permission-notice"><ShieldCheck size={18}/><div><b>Permissões por técnico</b><p>O acesso do administrador já é protegido por login. A próxima etapa é criar contas individuais para a equipe e conectar cada conta às permissões definidas aqui.</p></div></div>
          <div className="permission-layout">
            <aside className="panel permission-people"><div className="permission-panel-heading"><div><h2>Equipe</h2><p>{technicians.length} técnicos cadastrados</p></div><Users size={17}/></div>
              {technicians.length===0?<Empty>Nenhum técnico cadastrado.</Empty>:technicians.map(technician=><button type="button" key={technician.id} className={`permission-person ${permissionTechnicianId===technician.id?"selected":""}`} onClick={()=>{setPermissionTechnicianId(technician.id);setPermissionDraft(technician.screen_permissions||[])}}><span className="permission-avatar">{technician.name.split(/\s+/).map(part=>part[0]).slice(0,2).join("").toUpperCase()}</span><span><b>{technician.name}</b><small>{technician.active?"Ativo":"Inativo"}</small></span><span className={`permission-person-count ${technician.screen_permissions?.length?"has-access":""}`}>{technician.screen_permissions?.length||0}</span></button>)}
            </aside>
            <section className="panel permission-editor"><div className="permission-panel-heading"><div><h2>{selectedPermissionTechnician?.name||"Selecione um técnico"}</h2><p>Marque as telas permitidas para este perfil.</p></div><span className="permission-role"><ShieldCheck size={13}/>Técnico</span></div>
              {!selectedPermissionTechnician?<Empty>Cadastre um técnico para configurar os acessos.</Empty>:<><div className="permission-screen-list">{permissionScreens.map(screen=>{const Icon=screen.icon;const checked=permissionDraft.includes(screen.key);return <label className={`permission-screen ${checked?"checked":""}`} key={screen.key}><input type="checkbox" checked={checked} onChange={event=>setPermissionDraft(current=>event.target.checked?[...current,screen.key]:current.filter(key=>key!==screen.key))}/><span className="permission-screen-icon"><Icon size={16}/></span><span className="permission-screen-copy"><b>{screen.label}</b><small>{screen.description}</small></span><span className="permission-check"><Check size={14}/></span></label>})}</div><div className="permission-footer"><span>{permissionDraft.length} de {permissionScreens.length} telas liberadas</span><button className="primary-btn" onClick={()=>void saveTechnicianPermissions()} disabled={permissionSaving||JSON.stringify(permissionDraft)==JSON.stringify(selectedPermissionTechnician.screen_permissions||[])}><Save size={14}/>{permissionSaving?"Salvandoâ€¦":"Salvar permissões"}</button></div></>}
            </section>
          </div>
        </section>}
        {placeholders[page]&&<div className="panel module-placeholder"><div className="module-placeholder-icon"><Activity size={22}/></div><div><span className="eyebrow">MÓDULO EM PREPARAÇÃO</span><h2>{page}</h2><p>{placeholders[page]}</p><small>A navegação e a estrutura da tela já estão prontas. Os cadastros e fluxos deste módulo serão desenvolvidos em seguida.</small></div></div>}        <footer>Águia Gestão <span>·</span> MVP 0.2 <span>·</span> Ambiente local de desenvolvimento</footer>
      </section>
    </main>
    <nav className="mobile-bottom-nav" aria-label="Navegação principal">
      <button type="button" className={page==="Dashboard"?"active":""} onClick={()=>navigate("Dashboard")}><LayoutDashboard size={18}/><span>Início</span></button>
      <button type="button" className={page==="Ordens de serviço"?"active":""} onClick={()=>navigate("Ordens de Serviço","Ordens de serviço")}><ClipboardList size={18}/><span>Ordens</span></button>
      <button type="button" className="mobile-new-order" aria-label="Abrir nova ordem de serviço" onClick={()=>{setForm("order");setMenuOpen(false)}}><span><Plus size={22}/></span><small>Nova OS</small></button>
      <button type="button" className={page==="Agenda"?"active":""} onClick={()=>navigate("Agenda")}><CalendarDays size={18}/><span>Agenda</span></button>
      <button type="button" className={menuOpen?"active":""} onClick={()=>setMenuOpen(true)}><Menu size={18}/><span>Mais</span></button>
    </nav>
  </div>;
}

function pageSection(page:string) { if(page==="Clientes e endere\u00e7os"||page==="T\u00e9cnicos"||page==="Fornecedores")return "CADASTROS"; if(page==="Dashboard")return "VISÃO GERAL"; if(page==="Financeiro")return "FINANCEIRO"; if(page==="Estoque")return "RECURSOS"; if(page==="Relat\u00f3rios")return "GESTÃO"; if(page==="Permissões")return "ADMINISTRAÇÃO"; return "OPERAÇÃO"; }
function pageTitle(page:string) { return page==="Clientes e endere\u00e7os"?"Clientes":page; }
function pageDescription(page:string) { return ({"Dashboard":"Prioridades, atendimentos do dia e pendências da operação.","Ordens de servi\u00e7o":"Gerencie os atendimentos em lista ou Kanban, da abertura à conclusão.","Clientes e endere\u00e7os":"Consulte clientes, unidades e locais de atendimento.","Fornecedores":"Gerencie parceiros, contatos e dados comerciais em um só lugar.","Agenda":"Planeje atendimentos por dia, semana ou mês e abra a ordem vinculada.","Estoque":"Controle produtos, saldos e entradas e saídas.","Financeiro":"Acompanhe cobranças, despesas e orçamentos no mesmo espaço.","Permissões":"Configure quais telas cada técnico pode acessar."} as Record<string,string>)[page]||placeholders[page]||""; }
function formTitle(mode:FormMode,type:string,ticket:TicketRow|null,unitParent:Client|null,supplier:Supplier|null,unit:Unit|null) { return mode==="convert"?`Gerar ordem do chamado #${ticket?.id}`:mode==="order"?"Abrir Nova Ordem de Serviço":mode==="edit-order"?"Editar ordem de serviço":mode==="edit-product"?"Editar produto":mode==="edit-supplier"?`Editar fornecedor · ${supplier?.name||"Fornecedor"}`:mode==="unit"?`Nova unidade · ${unitParent?.name||"Cliente"}`:mode==="edit-unit"?`Editar unidade · ${unit?.name||"Unidade"}`:({ticket:"Registrar chamado",client:"Cadastrar cliente",supplier:"Cadastrar fornecedor",product:"Cadastrar produto",movement:`Registrar ${type} de estoque`,entry:"Novo lançamento financeiro",technician:"Cadastrar técnico","unit-contact":"Novo responsável da unidade"})[mode]; }
function Panel({title,subtitle,action}:{title:string;subtitle:string;action?:ReactNode}) { return <div className="panel-head"><div><h3>{title}</h3><p>{subtitle}</p></div>{action}</div>; }
function Stat({label,value,icon,note,tone}:{label:string;value:number;icon:ReactNode;note:string;tone?:"blue"|"pink"|"cyan"|"violet"|"amber"}) { return <div className={`stat-card ${tone?`stat-tone-${tone}`:""}`}><div className="stat-top"><span>{label}</span><div className="stat-icon">{icon}</div></div><strong>{value.toLocaleString("pt-BR")}</strong><small>{note}</small></div>; }
function Empty({children}:{children:string}) { return <div className="empty">{children}</div>; }
function Status({value}:{value:string}) { const done=["pago","concluida"].includes(value); const label=({pago:"Pago",pendente:"Pendente",concluida:"Concluída",aberto:"Aberto","em atendimento":"Em atendimento"} as Record<string,string>)[value]||value; return <span className={`pill ${done?"done":""}`}>{label}</span>; }
function TicketDesk({rows,units,clients,selectedId,linkedIds,onSelect,onStatus,onConvert}:{rows:TicketRow[];units:Unit[];clients:Client[];selectedId:number|null;linkedIds:number[];onSelect:(id:number)=>void;onStatus:(ticket:TicketRow,status:string)=>void;onConvert:(ticket:TicketRow)=>void}) { const selected=rows.find(ticket=>ticket.id===selectedId)||rows[0];return <div className="desk-layout"><div className="desk-table-wrap">{rows.length===0?<Empty>Nenhum chamado encontrado com esses filtros.</Empty>:<table className="desk-table"><thead><tr><th></th><th>ID</th><th>Solicitação</th><th>Cliente / unidade</th><th>Prioridade</th><th>Status</th></tr></thead><tbody>{rows.map(ticket=>{const unit=units.find(item=>item.id===ticket.unit_id);const client=clients.find(item=>item.id===ticket.client_id);return <tr key={ticket.id} className={selected?.id===ticket.id?"selected":""} onClick={()=>onSelect(ticket.id)}><td><span className="desk-row-indicator"/></td><td>#{ticket.id}</td><td><b>{ticket.title}</b><small>{ticket.description||"Solicitação sem descrição"}</small></td><td>{client?.name||"â€”"}<small>{unit?.name||"Sem unidade"}</small></td><td><span className={`priority priority-${ticket.priority}`}>{ticket.priority}</span></td><td><Status value={ticket.status}/></td></tr>})}</tbody></table>}</div>{selected&&<aside className="desk-details"><div className="desk-detail-head"><span className="desk-detail-icon"><Ticket size={17}/></span><div><small>CHAMADO #{selected.id}</small><h3>{selected.title}</h3></div></div><div className="desk-detail-scroll"><p className="desk-description">{selected.description||"Nenhuma descrição foi informada para este chamado."}</p><div className="desk-detail-field"><small>CLIENTE</small><b>{clients.find(client=>client.id===selected.client_id)?.name||"Não vinculado"}</b></div><div className="desk-detail-field"><small>UNIDADE</small><b>{units.find(unit=>unit.id===selected.unit_id)?.name||"Não vinculada"}</b></div><div className="desk-detail-field"><small>PRIORIDADE</small><span className={`priority priority-${selected.priority}`}>{selected.priority}</span></div><div className="desk-detail-field"><small>STATUS DO CHAMADO</small><select value={selected.status} onChange={e=>onStatus(selected,e.target.value)}><option value="aberto">Aberto</option><option value="em atendimento">Em atendimento</option><option value="concluido">Concluído</option></select></div>{selected.created_at&&<div className="desk-detail-field"><small>ABERTO EM</small><b>{new Date(selected.created_at).toLocaleDateString("pt-BR")}</b></div>}</div>{!linkedIds.includes(selected.id)&&selected.status!=="concluido"&&<button className="primary-btn desk-action" onClick={()=>onConvert(selected)}><Plus size={15}/>Gerar ordem de serviço</button>}{linkedIds.includes(selected.id)&&<div className="desk-linked"><Check size={15}/>Ordem de serviço vinculada</div>}</aside>}</div>; }
function OrderDesk({rows,units,clients,technicians,onEdit}:{rows:WorkOrder[];units:Unit[];clients:Client[];technicians:Technician[];onEdit:(order:WorkOrder)=>void}) { return <div className="desk-layout order-list-only"><div className="desk-table-wrap">{rows.length===0?<Empty>Nenhuma ordem encontrada com esses filtros.</Empty>:<table className="desk-table"><thead><tr><th></th><th>OS</th><th>Atendimento</th><th>Cliente / unidade</th><th>Técnicos</th><th>Data</th><th>Status</th></tr></thead><tbody>{rows.map(order=>{const unit=units.find(item=>item.id===order.unit_id);const client=clients.find(item=>item.id===order.client_id);return <tr key={order.id} className="order-open-row" tabIndex={0} aria-label={"Editar ordem "+order.id} onClick={()=>onEdit(order)} onKeyDown={event=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();onEdit(order)}}}><td><span className="desk-row-indicator"/></td><td>OS-{String(order.id).padStart(4,"0")}</td><td><b>{order.title}</b><small>{order.description||"Atendimento técnico"}</small></td><td>{client?.name||"â€”"}<small>{unit?.name||"Sem unidade"}</small></td><td>{assignedTechnicianNames(order,technicians)||"Sem técnico"}</td><td>{dateLabel(order.scheduled_date)}</td><td><Status value={order.status}/></td></tr>})}</tbody></table>}</div></div>; }function OrderKanban({rows,clients,units,technicians,onEdit,onChecklist,onStatus}:{rows:WorkOrder[];clients:Client[];units:Unit[];technicians:Technician[];onEdit:(order:WorkOrder)=>void;onChecklist:(order:WorkOrder)=>void;onStatus:(order:WorkOrder,status:string)=>void}) {
  const lanes=[{id:"pendente",label:"Aguardando",tone:"blue"},{id:"em atendimento",label:"Em atendimento",tone:"orange"},{id:"concluida",label:"Concluídas",tone:"green"},{id:"cancelada",label:"Canceladas",tone:"orange"}];
  return <div className="ticket-kanban order-kanban">{lanes.map(lane=>{const items=rows.filter(order=>order.status===lane.id);return <section className={`kanban-lane lane-${lane.tone}`} key={lane.id} onDragOver={event=>event.preventDefault()} onDrop={event=>{event.preventDefault();const id=Number(event.dataTransfer.getData("text/plain"));const order=rows.find(item=>item.id===id);if(order)onStatus(order,lane.id)}}><header><span>{lane.label}</span><b>{items.length}</b></header><div className="kanban-cards">{items.length===0?<div className="kanban-empty">Nenhuma ordem nesta etapa</div>:items.map(order=>{const client=clients.find(item=>item.id===order.client_id);const unit=units.find(item=>item.id===order.unit_id);const technician=technicians.find(item=>item.id===order.technician_id);return <article className="kanban-card order-open-card" key={order.id} draggable={order.status!=="cancelada"} onClick={()=>onEdit(order)} onKeyDown={event=>{if(event.key==="Enter"){event.preventDefault();onEdit(order)}}} tabIndex={0} aria-label={`Abrir edição da ordem ${order.id}`} onDragStart={event=>event.dataTransfer.setData("text/plain",String(order.id))}><div className="kanban-card-top"><small>OS-{String(order.id).padStart(4,"0")}</small><span className={`pill ${order.status==="concluida"?"done":order.status==="cancelada"?"inactive":""}`}>{order.status==="concluida"?"Concluída":order.status==="cancelada"?"Cancelada":order.status==="em atendimento"?"Em atendimento":"Pendente"}</span></div><h3>{order.title}</h3><p>{[client?.name,unit?.name].filter(Boolean).join(" · ")||"Cliente não vinculado"}</p><div className="kanban-meta"><CalendarDays size={13}/>{dateLabel(order.scheduled_date)}{order.scheduled_time?` · ${order.scheduled_time.slice(0,5)}`:""}</div><div className="kanban-meta"><Users size={13}/>{assignedTechnicianNames(order,technicians)||"Sem técnico atribuído"}</div><footer><button className="kanban-drag-hint" onClick={event=>{event.stopPropagation();onChecklist(order)}}>Checklist</button></footer></article>})}</div></section>})}</div>;
}
function TicketKanban({rows,units,onStatus}:{rows:TicketRow[];units:Unit[];onStatus:(ticket:TicketRow,status:string)=>void}) { const lanes=[{id:"aberto",label:"Novos chamados",tone:"blue"},{id:"em atendimento",label:"Em atendimento",tone:"orange"},{id:"concluido",label:"Concluídos",tone:"green"}];return <div className="ticket-kanban">{lanes.map(lane=>{const items=rows.filter(ticket=>ticket.status===lane.id);return <section className={`kanban-lane lane-${lane.tone}`} key={lane.id} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();const id=Number(e.dataTransfer.getData("text/plain"));const ticket=rows.find(item=>item.id===id);if(ticket)onStatus(ticket,lane.id)}}><header><span>{lane.label}</span><b>{items.length}</b></header><div className="kanban-cards">{items.length===0?<div className="kanban-empty">Solte chamados aqui</div>:items.map(ticket=><article className="kanban-card" key={ticket.id} draggable onDragStart={e=>e.dataTransfer.setData("text/plain",String(ticket.id))}><div className="kanban-card-top"><small>CHAMADO #{ticket.id}</small><span className={`priority priority-${ticket.priority}`}>{ticket.priority}</span></div><h3>{ticket.title}</h3><p>{ticket.description||"Sem descrição adicional."}</p><div className="kanban-meta"><Ticket size={13}/>{ticket.unit_id?units.find(unit=>unit.id===ticket.unit_id)?.name||"Unidade":"Sem unidade vinculada"}</div><footer><span className="kanban-drag-hint">Arraste para mover</span><select aria-label={`Mover chamado ${ticket.id}`} value={ticket.status} onChange={e=>onStatus(ticket,e.target.value)}><option value="aberto">Novo</option><option value="em atendimento">Em atendimento</option><option value="concluido">Concluído</option></select></footer></article>)}</div></section>})}</div>; }
function OrderList({rows,units,onEdit,onChecklist}:{rows:WorkOrder[];units:Unit[];onEdit:(order:WorkOrder)=>void;onChecklist:(order:WorkOrder)=>void}) { return <div className="list">{rows.map(o=><div className="list-row" key={o.id}><div className="row-icon order-icon"><ClipboardList size={17}/></div><div className="row-main"><b>OS-{String(o.id).padStart(4,"0")} · {o.title}</b><small>{dateLabel(o.scheduled_date)} · {o.unit_id?`${units.find(u=>u.id===o.unit_id)?.name||"Unidade"} · `:""}{o.address||"Endereço não informado"}</small></div><button className="secondary-btn order-edit-btn" onClick={()=>onChecklist(o)}>Checklist</button>{o.status!=="concluida"&&<button className="secondary-btn order-edit-btn" onClick={()=>onEdit(o)} aria-label={`Editar ordem ${o.id}`}><Pencil size={14}/>Editar</button>}<Status value={o.status}/></div>)}</div>; }
function Modal({title,status,onClose,children}:{title:string;status?:string;onClose:()=>void;children:ReactNode}) { return <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}><section className="form-card modal-card"><div className="modal-head"><div className="modal-title-area"><h3>{title}</h3>{status&&<div className="modal-current-status"><small>Status atual</small><Status value={status}/></div>}</div><button className="icon-btn" onClick={onClose} aria-label="Fechar"><X size={19}/></button></div>{children}</section></div>; }
function Form({mode,clients,units,technicians,entryTypeDefault,selectedProduct,selectedTicket,selectedOrder,selectedSupplier,unitParent,editingUnit,contactUnit,movementType,setMovementType,busy,onCancel,onOpenChecklist,onSubmit}:{mode:FormMode;clients:Client[];units:Unit[];technicians:Technician[];entryTypeDefault:"receita"|"despesa";selectedProduct:Product|null;selectedTicket:TicketRow|null;selectedOrder:WorkOrder|null;selectedSupplier:Supplier|null;unitParent:Client|null;editingUnit:Unit|null;contactUnit:Unit|null;movementType:"entrada"|"saida";setMovementType:(t:"entrada"|"saida")=>void;busy:boolean;onCancel:()=>void;onOpenChecklist:(order:WorkOrder)=>void;onSubmit:(e:FormEvent<HTMLFormElement>)=>void}) {
  const [attendanceTimes,setAttendanceTimes] = useState<{started_at:string|null;finished_at:string|null}>({started_at:null,finished_at:null});
  useEffect(()=>{
    if(mode!=="edit-order"||!selectedOrder){setAttendanceTimes({started_at:null,finished_at:null});return;}
    let active=true;
    void fetch(`${API}/work-orders/${selectedOrder.id}/checklist`).then(response=>response.ok?response.json():null).then(value=>{if(active&&value)setAttendanceTimes({started_at:value.started_at||null,finished_at:value.finished_at||null});}).catch(()=>{});
    return()=>{active=false;};
  },[mode,selectedOrder?.id]);
  const initialClientId = mode==="convert" ? (selectedTicket?.client_id||null) : mode==="edit-order" ? (selectedOrder?.client_id||null) : null;
  const initialUnitId = mode==="convert" ? (selectedTicket?.unit_id||null) : mode==="edit-order" ? (selectedOrder?.unit_id||null) : null;
  const [clientId,setClientId] = useState<number|null>(initialClientId);
  const [unitId,setUnitId] = useState<number|null>(initialUnitId);
  const [orderStep,setOrderStep] = useState(1);
  const [orderClientName,setOrderClientName] = useState("");
  const [orderUnitId,setOrderUnitId] = useState<number|null>(null);
  const [creatingOrderUnit,setCreatingOrderUnit] = useState(false);
  const [orderUnitName,setOrderUnitName] = useState("");
  const [orderUnitSigla,setOrderUnitSigla] = useState("");
  const [orderUnitManager,setOrderUnitManager] = useState("");
  const [orderUnitAddress,setOrderUnitAddress] = useState("");
  const [orderUnitPhone,setOrderUnitPhone] = useState("");
  const [orderServiceType,setOrderServiceType] = useState("instalacao");
  const [orderDescription,setOrderDescription] = useState("");
  const [orderTechnicianIds,setOrderTechnicianIds] = useState<number[]>([]);
  const [orderStepError,setOrderStepError] = useState("");
  const [productCost,setProductCost] = useState(Number(selectedProduct?.unit_price||0));
  const [productMarkup,setProductMarkup] = useState(String(selectedProduct?.markup_percent??0));
  const clientUnits = units.filter(unit=>unit.client_id===clientId);
  const selectedUnit = units.find(unit=>unit.id===unitId);
  const unitOptionLabel = (unit:Unit) => unit.sigla?`${unit.name} · ${unit.sigla}`:unit.name;
  const [unitQuery,setUnitQuery] = useState(()=>selectedUnit?unitOptionLabel(selectedUnit):"");
  const [serviceAddress,setServiceAddress] = useState(selectedUnit?.address||clients.find(c=>c.id===clientId)?.address||"");
  const orderClientMatch=clients.find(client=>client.name.trim().toLocaleLowerCase("pt-BR")===orderClientName.trim().toLocaleLowerCase("pt-BR"));
  const orderUnit=units.find(unit=>unit.id===orderUnitId);
  const orderClientUnits=units.filter(unit=>unit.client_id===orderClientMatch?.id);

  const timeLabel=(value:string|null)=>value?new Date(value).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"}):"â€”";
const clientSelector = <><label className="client-select-field"><span className="form-field-heading">Cliente</span><select name="client_id" value={clientId??""} onChange={e=>{const nextClient=e.target.value?Number(e.target.value):null;setClientId(nextClient);setUnitId(null);setUnitQuery("");setServiceAddress(clients.find(c=>c.id===nextClient)?.address||"")}}><option value="">Sem cliente vinculado</option>{clients.map(c=><option value={c.id} key={c.id}>{c.name}</option>)}</select></label><label className="unit-search-field"><span className="form-field-heading unit-selector-label"><b>Unidade (opcional)</b><small>{unitId?`Selecionada: ${selectedUnit?.name||"unidade"}`:"Busque pelo nome ou pela sigla da unidade."}</small></span><input type="search" list="client-unit-options" value={unitQuery} disabled={!clientId||clientUnits.length===0} placeholder={!clientId?"Selecione um cliente primeiro":clientUnits.length?"Digite o nome ou a sigla":"Nenhuma unidade cadastrada"} autoComplete="off" onChange={e=>{const query=e.target.value;const normalized=query.trim().toLocaleLowerCase("pt-BR");const match=clientUnits.find(unit=>unit.name.toLocaleLowerCase("pt-BR")===normalized||unit.sigla?.toLocaleLowerCase("pt-BR")===normalized||unitOptionLabel(unit).toLocaleLowerCase("pt-BR")===normalized);setUnitQuery(query);setUnitId(match?.id||null);setServiceAddress(match?.address||clients.find(c=>c.id===clientId)?.address||"")}}/><input type="hidden" name="unit_id" value={unitId??""}/><input type="hidden" name="address" value={selectedUnit?.address||serviceAddress}/><datalist id="client-unit-options">{clientUnits.map(unit=><option key={unit.id} value={unitOptionLabel(unit)}/>)}</datalist></label></>;
  const advanceOrderStep=()=>{setOrderStepError("");if(orderStep===1){if(!orderClientName.trim()){setOrderStepError("Informe ou selecione um cliente.");return;}if(!orderUnitId&&!creatingOrderUnit){setOrderStepError("Selecione uma unidade ou cadastre uma nova para esta ordem.");return;}if(creatingOrderUnit&&(!orderUnitName.trim()||!orderUnitAddress.trim())){setOrderStepError("Informe o nome e o endereço da nova unidade.");return;}}setOrderStep(Math.min(4,orderStep+1));};
  if(mode==="order") return <form className="modal-form order-wizard" onSubmit={onSubmit}>
    <input type="hidden" name="order_action" value=""/><input type="hidden" name="order_action_at" value=""/>
    <input type="hidden" name="client_id" value={orderClientMatch?.id||""}/><input type="hidden" name="unit_id" value={creatingOrderUnit?"":orderUnitId||""}/>
    <input type="hidden" name="new_client_name" value={orderClientMatch?"":orderClientName.trim()}/><input type="hidden" name="new_unit_name" value={creatingOrderUnit?orderUnitName.trim():""}/>
    <input type="hidden" name="new_unit_sigla" value={creatingOrderUnit?orderUnitSigla.trim():""}/><input type="hidden" name="new_unit_manager" value={creatingOrderUnit?orderUnitManager.trim():""}/>
    <input type="hidden" name="new_unit_address" value={creatingOrderUnit?orderUnitAddress.trim():""}/><input type="hidden" name="new_unit_phone" value={creatingOrderUnit?orderUnitPhone.trim():""}/>
    <input type="hidden" name="address" value={creatingOrderUnit?orderUnitAddress:orderUnit?.address||orderClientMatch?.address||""}/>
    <input type="hidden" name="scheduled_date" value={today()}/><input type="hidden" name="scheduled_time" value=""/>
    <input type="hidden" name="title" value={`Atendimento · ${serviceTypeLabel(orderServiceType)}`}/><input type="hidden" name="service_type" value={orderServiceType}/><input type="hidden" name="description" value={orderDescription.trim()}/>
    {orderTechnicianIds.map(id=><input type="hidden" name="technician_ids" value={id} key={id}/>)}
    <nav className="order-wizard-steps" aria-label="Etapas da nova ordem">{["Cliente","Serviço","Equipe","Resumo"].map((label,index)=><button type="button" key={label} className={orderStep===index+1?"current":orderStep>index+1?"completed":""} onClick={()=>{if(index+1<orderStep){setOrderStep(index+1);setOrderStepError("")}}}><span>{index+1}. </span>{label}</button>)}</nav>
    {orderStep===1&&<section className="order-wizard-step"><div className="wizard-intro"><span>01 · LOCAL</span><h3>Cliente e unidade</h3><p>Selecione o cliente e escolha uma unidade ou cadastre uma rapidamente.</p></div>
      <label>Cliente<input list="order-client-options" value={orderClientName} onChange={event=>{const value=event.target.value;const match=clients.find(client=>client.name.trim().toLocaleLowerCase("pt-BR")===value.trim().toLocaleLowerCase("pt-BR"));setOrderClientName(value);setClientId(match?.id||null);setOrderUnitId(null);setCreatingOrderUnit(false);setOrderStepError("")}} placeholder="Escolha ou digite um cliente novo" autoComplete="off"/><datalist id="order-client-options">{clients.map(client=><option key={client.id} value={client.name}/>)}</datalist></label>
      {orderClientMatch&&<label>Unidade cadastrada<select value={creatingOrderUnit?"":orderUnitId||""} onChange={event=>{const id=event.target.value?Number(event.target.value):null;setOrderUnitId(id);setCreatingOrderUnit(false)}}><option value="">Selecione uma unidade</option>{orderClientUnits.map(unit=><option value={unit.id} key={unit.id}>{unit.name}{unit.sigla?` · ${unit.sigla}`:""}</option>)}</select></label>}
      <button type="button" className={`wizard-add-unit ${creatingOrderUnit?"active":""}`} onClick={()=>{setCreatingOrderUnit(!creatingOrderUnit);setOrderUnitId(null);setOrderStepError("")}}><Plus size={14}/>{creatingOrderUnit?"Usar unidade já cadastrada":"Cadastrar nova unidade"}</button>
      {creatingOrderUnit&&<div className="wizard-unit-fields"><p>Ela será salva no cadastro do cliente e vinculada a esta OS.</p><label>Unidade<input value={orderUnitName} onChange={event=>setOrderUnitName(event.target.value)} placeholder="Ex.: Lapa"/></label><div className="wizard-two-fields"><label>Sigla<input value={orderUnitSigla} onChange={event=>setOrderUnitSigla(event.target.value)} placeholder="Ex.: RJLAPA"/></label><label>Gerente<input value={orderUnitManager} onChange={event=>setOrderUnitManager(event.target.value)} placeholder="Nome do gerente"/></label></div><label>Endereço<input value={orderUnitAddress} onChange={event=>setOrderUnitAddress(event.target.value)} placeholder="Rua, número, bairro, cidade"/></label><label>Telefone<input value={orderUnitPhone} onChange={event=>setOrderUnitPhone(event.target.value)} placeholder="Telefone da unidade"/></label></div>}
      {orderStepError&&<p className="wizard-error">{orderStepError}</p>}
    </section>}
    {orderStep===2&&<section className="order-wizard-step"><div className="wizard-intro"><span>02 · SERVIÇO</span><h3>O que será realizado?</h3><p>Escolha o tipo de atendimento e, se quiser, descreva o serviço.</p></div><fieldset className="wizard-service-options"><legend>Tipo de serviço</legend>{([["instalacao","Instalação"],["manutencao","Manutenção"],["preventiva","Preventiva"],["corretiva","Correção"]] as const).map(([value,label])=><button type="button" key={value} className={orderServiceType===value?"active":""} aria-pressed={orderServiceType===value} onClick={()=>setOrderServiceType(value)}>{label}</button>)}</fieldset><label>Descrição do serviço <small>(opcional)</small><textarea value={orderDescription} onChange={event=>setOrderDescription(event.target.value)} placeholder="Descreva o serviço que será realizado..."/></label></section>}
    {orderStep===3&&<section className="order-wizard-step"><div className="wizard-intro"><span>03 · EQUIPE</span><h3>Quem vai ao atendimento?</h3><p>Selecione um ou mais técnicos responsáveis.</p></div><div className="wizard-technicians">{technicians.filter(technician=>technician.active).map(technician=><label key={technician.id} className={orderTechnicianIds.includes(technician.id)?"selected":""}><input type="checkbox" checked={orderTechnicianIds.includes(technician.id)} onChange={event=>setOrderTechnicianIds(current=>event.target.checked?[...current,technician.id]:current.filter(id=>id!==technician.id))}/><span className="wizard-technician-avatar">{technician.name.split(/\s+/).map(part=>part[0]).slice(0,2).join("").toUpperCase()}</span><span>{technician.name}</span><Check size={14}/></label>)}{technicians.filter(technician=>technician.active).length===0&&<p className="wizard-empty">Cadastre técnicos ativos para atribuí-los a esta ordem.</p>}</div></section>}
    {orderStep===4&&<section className="order-wizard-step"><div className="wizard-intro"><span>04 · REVISÃO</span><h3>Confira os dados da ordem</h3><p>Revise as informações antes de salvar ou iniciar o atendimento.</p></div><div className="wizard-summary"><div><span>CLIENTE</span><strong>{orderClientName||"â€”"}</strong></div><div><span>UNIDADE</span><strong>{creatingOrderUnit?orderUnitName:orderUnit?.name||"â€”"}</strong><small>{creatingOrderUnit?orderUnitSigla:orderUnit?.sigla}</small></div><div><span>ENDEREÇO</span><strong>{creatingOrderUnit?orderUnitAddress:orderUnit?.address||orderClientMatch?.address||"â€”"}</strong></div><div><span>TIPO DE SERVIÇO</span><strong>{serviceTypeLabel(orderServiceType)}</strong></div><div><span>TÉCNICOS</span><strong>{technicians.filter(technician=>orderTechnicianIds.includes(technician.id)).map(technician=>technician.name).join(", ")||"A definir"}</strong></div><div><span>AGENDAMENTO</span><strong>Hoje · {new Date().toLocaleDateString("pt-BR")}</strong></div>{orderDescription.trim()&&<div className="summary-description"><span>DESCRIÇÃO</span><strong>{orderDescription.trim()}</strong></div>}</div></section>}
    <footer className="order-wizard-footer"><button type="button" className="secondary-btn" onClick={orderStep===1?onCancel:()=>{setOrderStep(orderStep-1);setOrderStepError("")}}>{orderStep===1?"Cancelar":"Voltar"}</button>{orderStep<4?<button type="button" className="primary-btn" onClick={advanceOrderStep}>Próximo<ChevronRight size={15}/></button>:<><button type="submit" className="secondary-btn" disabled={busy}>{busy?"Salvandoâ€¦":"Salvar ordem"}</button><button type="submit" className="attendance-started-btn" data-action="start" onClick={event=>{const input=event.currentTarget.form?.elements.namedItem("order_action");if(input instanceof HTMLInputElement)input.value="start";const stamp=event.currentTarget.form?.elements.namedItem("order_action_at");if(stamp instanceof HTMLInputElement)stamp.value=new Date().toISOString();pendingWhatsAppWindow=window.open("about:blank","_blank")}} disabled={busy}><Check size={14}/>{busy?"Salvandoâ€¦":"Iniciar atendimento"}</button></>}</footer>
  </form>;
  return <form className="modal-form" onSubmit={onSubmit}>
    <input type="hidden" name="order_action" value="" />
    <input type="hidden" name="order_action_at" value="" />
    {(mode==="ticket"||mode==="order"||mode==="edit-order")&&<>{(mode==="order"||mode==="edit-order")&&<>
      <section className="order-form-section">
        <div className="order-section-heading"><span>01</span><div><b>Local do atendimento</b><small>Vincule o cliente e, se houver, a unidade cadastrada.</small></div></div>
        <div className="order-fields-grid">{clientSelector}</div>
      </section>
      <section className="order-form-section">
        <div className="order-section-heading"><span>02</span><div><b>Agendamento e serviço</b><small>Defina quando será realizado e qual o tipo de atendimento.</small></div></div>
        <div className="order-fields-grid">
          <label className="order-date-field">Data<input name="scheduled_date" type="date" required={mode==="order"} defaultValue={selectedOrder?.scheduled_date||(mode==="order"?today():"")}/><button type="button" className="date-now-btn" onClick={e=>{const input=e.currentTarget.parentElement?.querySelector<HTMLInputElement>('input[name="scheduled_date"]');if(input)input.value=today()}}>Hoje</button></label>

          <label>Tipo de serviço<select name="service_type" required defaultValue={selectedOrder?.service_type||"corretiva"}><option value="corretiva">Corretiva</option><option value="instalacao">Instalação</option><option value="manutencao">Manutenção</option></select></label>{mode==="edit-order"&&<div className="order-attendance-times"><div><span>Entrada</span><b>{timeLabel(attendanceTimes.started_at)}</b></div><div><span>Saída</span><b>{timeLabel(attendanceTimes.finished_at)}</b></div></div>}
        </div>
      </section>
      <section className="order-form-section">
        <div className="order-section-heading"><span>03</span><div><b>Detalhes da ordem</b><small>O título pode ser preenchido depois do início do atendimento.</small></div></div>
        <div className="order-fields-grid">
          <label className="order-title-field">Título da ordem <small>(opcional)</small><input name="title" defaultValue={selectedOrder?.title?.startsWith("Atendimento · ")?"":selectedOrder?.title||""} placeholder="Ex.: Manutenção preventiva"/></label>
          <label className="order-description-field">Descrição <small>(opcional)</small><textarea name="description" defaultValue={selectedOrder?.description||""} placeholder="Detalhes adicionais, se já souber"/></label>
        </div>
      </section>
      <fieldset className="technician-multi-field"><legend>04 · Técnicos responsáveis</legend><small>Selecione um ou mais técnicos para este atendimento.</small><div>{technicians.filter(technician=>technician.active||selectedOrder?.technician_ids?.includes(technician.id)||technician.id===selectedOrder?.technician_id).map(technician=><label key={technician.id}><input type="checkbox" name="technician_ids" value={technician.id} defaultChecked={selectedOrder?.technician_ids?.includes(technician.id)||technician.id===selectedOrder?.technician_id}/>{technician.name}{technician.active?"":" (inativo)"}</label>)}</div>{technicians.length===0&&<p className="order-no-technicians">Cadastre técnicos em Cadastros / Técnicos para atribuí-los.</p>}</fieldset>
    </>}{mode==="ticket"&&<><label>Título<input name="title" required minLength={3} placeholder="Descreva a solicitação"/></label><label>Descrição<textarea name="description" placeholder="Detalhes adicionais"/></label><label>Prioridade<select name="priority"><option value="normal">Normal</option><option value="baixa">Baixa</option><option value="alta">Alta</option><option value="urgente">Urgente</option></select></label>{clientSelector}</>}</>}{mode==="technician"&&<><div className="product-selected"><Users size={18}/><div><b>Ativo da empresa</b><small>O técnico ficará disponível para os atendimentos de todas as unidades.</small></div></div><label>Nome completo<input name="name" required minLength={2}/></label><label>Telefone<input name="phone"/></label><label>E-mail<input name="email" type="email"/></label></>}
    {(mode==="supplier"||mode==="edit-supplier")&&<><div className="product-selected"><Truck size={18}/><div><b>{mode==="edit-supplier"?"Atualize o cadastro do parceiro":"Cadastro comercial"}</b><small>Organize os dados de contato e a especialidade do fornecedor.</small></div></div><label>Nome da empresa<input name="name" required minLength={2} defaultValue={selectedSupplier?.name||""} placeholder="Razão social ou nome fantasia" autoFocus/></label><label>Categoria<input name="category" defaultValue={selectedSupplier?.category||""} placeholder="Ex.: Materiais elétricos, Segurança elétrica" list="supplier-categories"/><datalist id="supplier-categories"><option value="Materiais elétricos"/><option value="Segurança elétrica"/><option value="Telecomunicações"/><option value="Ferramentas e equipamentos"/><option value="Serviços"/><option value="Outros"/></datalist></label><label>CNPJ / CPF<input name="document" defaultValue={selectedSupplier?.document||""} placeholder="00.000.000/0000-00"/></label><label>Nome do contato<input name="contact_name" defaultValue={selectedSupplier?.contact_name||""} placeholder="Pessoa responsóvel"/></label><label>Telefone / WhatsApp<input name="phone" defaultValue={selectedSupplier?.phone||""} placeholder="(00) 00000-0000"/></label><label>E-mail comercial<input name="email" type="email" defaultValue={selectedSupplier?.email||""} placeholder="contato@empresa.com"/></label><label className="supplier-wide-field">Endereço<input name="address" defaultValue={selectedSupplier?.address||""} placeholder="Rua, número, bairro e cidade"/></label><label className="supplier-wide-field">Observações<textarea name="notes" defaultValue={selectedSupplier?.notes||""} placeholder="Prazo, condições comerciais ou informações úteis"/></label>{mode==="edit-supplier"&&<label>Status do cadastro<select name="active" defaultValue={selectedSupplier?.active?"true":"false"}><option value="true">Ativo</option><option value="false">Inativo</option></select></label>}</>}
    {mode==="unit-contact"&&<><div className="unit-context">Unidade: <b>{contactUnit?.name||"Unidade selecionada"}</b> · Cadastro vinculado a esta unidade.</div><label>Tipo de responsóvel<select name="role" required><option value="lider">Líder</option><option value="gerente">Gerente</option><option value="colaborador">Colaborador</option></select></label><label>Nome completo<input name="name" required minLength={2}/></label><label>Telefone<input name="phone"/></label><label>E-mail<input name="email" type="email"/></label></>}
    {mode==="client"&&<><label>Nome do cliente<input name="name" required minLength={2}/></label><label>Telefone<input name="phone"/></label><label>E-mail<input name="email" type="email"/></label><label>Endereço<input name="address"/></label></>}
    {(mode==="unit"||mode==="edit-unit")&&(unitParent||editingUnit)&&<><div className="product-selected"><Users size={18}/><div><b>Cliente pai: {unitParent?.name||"Cliente"}</b><small>{mode==="edit-unit"?"Atualize os dados da unidade e a sigla usada no checklist.":"A unidade será cadastrada dentro deste cliente."}</small></div></div><label>Nome da unidade<input name="name" required minLength={2} placeholder="Ex.: Unidade Centro" defaultValue={editingUnit?.name||""} autoFocus={mode==="unit"}/></label><label>Sigla da unidade<input name="sigla" maxLength={80} placeholder="Ex.: SP01" defaultValue={editingUnit?.sigla||""}/></label><label>Endereço da unidade<input name="address" required minLength={3} placeholder="Rua, número, bairro, cidade" defaultValue={editingUnit?.address||""}/></label><label>Responsável local<input name="contact_name" placeholder="Nome do contato da unidade" defaultValue={editingUnit?.contact_name||""}/></label><label>Telefone da unidade<input name="phone" placeholder="Telefone de contato" defaultValue={editingUnit?.phone||""}/></label></>}
    {(mode==="product"||mode==="edit-product")&&<>{mode==="edit-product"&&<div className="product-selected"><Package size={18}/><div><b>Saldo atual: {selectedProduct?.quantity??0} {selectedProduct?.unit_measure||"unidade"}</b><small>Use Entrada ou Saída para ajustar o saldo e manter o histórico de movimentações.</small></div></div>}<label>Nome do produto<input name="name" required minLength={2} defaultValue={selectedProduct?.name||""}/></label><label>SKU / código<input name="sku" defaultValue={selectedProduct?.sku||""}/></label><label>Categoria<input name="category" defaultValue={selectedProduct?.category||""}/></label><label>Unidade de medida<select name="unit_measure" defaultValue={selectedProduct?.unit_measure||"unidade"}><option value="unidade">Unidade</option><option value="caixa">Caixa</option><option value="pacote">Pacote</option><option value="saco">Saco</option></select></label>{mode==="product"&&<label>Quantidade inicial<input name="quantity" type="number" min="0" step="1" defaultValue="0" required/></label>}<label>Estoque mínimo<input name="minimum_quantity" type="number" min="0" step="1" defaultValue={selectedProduct?.minimum_quantity??0} required/></label><label>Custo unitário<input name="unit_price" type="number" min="0" step="0.01" value={productCost} onChange={e=>setProductCost(Number(e.target.value)||0)} required/></label><label>Markup (%)<input name="markup_percent" type="number" min="0" step="0.01" value={productMarkup} onFocus={()=>{if(productMarkup==="0")setProductMarkup("")}} onChange={e=>setProductMarkup(e.target.value)} required/></label><div className="price-preview"><span>PREÇO DE VENDA SUGERIDO</span><strong>{money(Math.round(productCost*(1+(Number(productMarkup)||0)/100)*100)/100)}</strong><small>Custo unitário + markup aplicado</small></div></>}
    {mode==="movement"&&<><div className="product-selected"><Package size={19}/><div><b>{selectedProduct?.name}</b><small>Saldo atual: {selectedProduct?.quantity} {selectedProduct?.unit_measure||"unidade"}</small></div></div><label>Tipo de movimentação<select value={movementType} onChange={e=>setMovementType(e.target.value as "entrada"|"saida")}><option value="entrada">Entrada</option><option value="saida">Saída</option></select></label><label>Quantidade<input name="quantity" type="number" min="1" step="1" required autoFocus/></label><label>Observação<input name="notes" placeholder="Ex.: compra, uso em serviço"/></label></>}
    {mode==="convert"&&selectedTicket&&<><div className="product-selected"><Ticket size={19}/><div><b>Chamado #{selectedTicket.id} · {selectedTicket.title}</b><small>{selectedTicket.description||"Sem descrição adicional."}</small></div></div><div className="unit-context">Cliente: <b>{clients.find(c=>c.id===selectedTicket.client_id)?.name||"Sem cliente"}</b>{selectedUnit&&<> · Unidade: <b>{selectedUnit.name}</b></>}</div><label>Data agendada<input name="scheduled_date" type="date" defaultValue={today()}/></label><label>Horário<input name="scheduled_time" type="time"/></label><label>Técnico responsável<select name="technician_id"><option value="">Sem técnico atribuído</option>{technicians.filter(technician=>technician.active).map(technician=><option value={technician.id} key={technician.id}>{technician.name}</option>)}</select></label><input type="hidden" name="address" value={selectedUnit?.address||clients.find(c=>c.id===selectedTicket.client_id)?.address||""}/></>}
    {mode==="entry"&&<><label>Descrição<input name="description" required minLength={2} placeholder="Ex.: Pagamento de manutenção"/></label><label>Tipo<select name="entry_type" defaultValue={entryTypeDefault}><option value="receita">Receita</option><option value="despesa">Despesa</option></select></label><label>Categoria<input name="category" placeholder="Ex.: Serviço, material, aluguel"/></label><label>Valor (R$)<input name="amount" type="number" min="0.01" step="0.01" required/></label><label>Data de vencimento<input name="due_date" type="date"/></label></>}
    <div className="form-actions"><button type="button" className="secondary-btn" onClick={onCancel}>Cancelar</button>{mode==="order"&&<button className="attendance-started-btn" type="submit" data-action="start" onClick={e=>{const input=e.currentTarget.form?.elements.namedItem("order_action");if(input instanceof HTMLInputElement)input.value="start";const stamp=e.currentTarget.form?.elements.namedItem("order_action_at");if(stamp instanceof HTMLInputElement)stamp.value=new Date().toISOString();pendingWhatsAppWindow=window.open("about:blank","_blank")}} disabled={busy}>{busy?"Salvandoâ€¦":"Iniciar Atendimento"}</button>}{mode==="edit-order"&&selectedOrder&&<>{selectedOrder.status!=="em atendimento"&&<button type="button" className="secondary-btn" onClick={()=>onOpenChecklist(selectedOrder)}><ClipboardList size={14}/>Checklist</button>}<div className="attendance-actions-group"><button type="submit" className="attendance-started-btn" data-action="start" onClick={e=>{const input=e.currentTarget.form?.elements.namedItem("order_action");if(input instanceof HTMLInputElement)input.value="start";const stamp=e.currentTarget.form?.elements.namedItem("order_action_at");if(stamp instanceof HTMLInputElement)stamp.value=new Date().toISOString();pendingWhatsAppWindow=window.open("about:blank","_blank")}} disabled={busy||selectedOrder.status!=="pendente"}><Check size={14}/>{selectedOrder.status==="em atendimento"?"Atendimento Iniciado":busy?"Salvandoâ€¦":"Iniciar Atendimento"}</button><button type="submit" className="attendance-finish-btn" data-action="finish" onClick={e=>{const input=e.currentTarget.form?.elements.namedItem("order_action");if(input instanceof HTMLInputElement)input.value="finish";const stamp=e.currentTarget.form?.elements.namedItem("order_action_at");if(stamp instanceof HTMLInputElement)stamp.value=new Date().toISOString();pendingWhatsAppWindow=window.open("about:blank","_blank")}} disabled={busy||selectedOrder.status!=="em atendimento"}><Check size={14}/>{busy?"Salvandoâ€¦":"Concluir Atendimento"}</button></div></>}<button className="primary-btn" type="submit" onClick={e=>{const input=e.currentTarget.form?.elements.namedItem("order_action");if(input instanceof HTMLInputElement)input.value=""}} disabled={busy}>{busy?"Salvandoâ€¦":mode==="order"?"Salvar ordem":mode==="edit-order"?"Salvar alterações":"Salvar registro"}</button></div>
  </form>;
}









