import { useState } from "react";
import type { FormEvent } from "react";
import { Eye, EyeOff, LockKeyhole, Mail, ShieldCheck, UserRoundPlus } from "lucide-react";

type Props = { setupNeeded: boolean; busy: boolean; error: string; onSubmit: (data:{name:string;email:string;password:string})=>void; onRegister:(data:{email:string;password:string})=>void };

export default function LoginScreen({setupNeeded,busy,error,onSubmit,onRegister}:Props) {
  const [showPassword,setShowPassword]=useState(false);
  const [registerMode,setRegisterMode]=useState(false);
  const [formError,setFormError]=useState("");
  function submit(event:FormEvent<HTMLFormElement>){event.preventDefault();setFormError("");const form=new FormData(event.currentTarget);const email=String(form.get("email")||"");const password=String(form.get("password")||"");if(registerMode){if(password!==String(form.get("confirmPassword")||"")){setFormError("As senhas não conferem.");return;}onRegister({email,password});}else onSubmit({name:String(form.get("name")||""),email,password});}

  return <main className="login-screen">
    <section className="login-card">
      <div className="login-brand"><img className="login-brand-logo" src="/aguia-sidebar.png" alt="Águia Gestão"/></div>
      <div className="login-heading">
        <span><ShieldCheck size={14}/>{setupNeeded?"CONFIGURAÇÃO INICIAL":registerMode?"CADASTRO":"ACESSO SEGURO"}</span>
        <h1>{setupNeeded?"Configure seu acesso":registerMode?"Cadastre-se":"Boas-vindas"}</h1>
        <p>{setupNeeded?"Crie seu acesso de administrador.":registerMode?"Use o e-mail já cadastrado para você em Técnicos.":"Entre com seu e-mail e senha para continuar."}</p>
      </div>
      {(error||formError)&&<div className="login-error" role="alert">{formError||error}</div>}
      <form onSubmit={submit} className="login-form">
        {setupNeeded&&<label>Nome do administrador<input name="name" autoComplete="name" minLength={2} maxLength={160} placeholder="Seu nome" required autoFocus/></label>}
        <label>E-mail<div className="login-input-wrap"><Mail size={16}/><input name="email" type="email" autoComplete="username" placeholder="voce@empresa.com" required autoFocus={!setupNeeded}/></div></label>
        <label>Senha<div className="login-input-wrap"><LockKeyhole size={16}/><input name="password" type={showPassword?"text":"password"} autoComplete={setupNeeded||registerMode?"new-password":"current-password"} minLength={setupNeeded||registerMode?10:1} maxLength={128} placeholder={setupNeeded||registerMode?"Pelo menos 10 caracteres":"Digite sua senha"} required/><button type="button" className="login-password-toggle" onClick={()=>setShowPassword(value=>!value)} aria-label={showPassword?"Ocultar senha":"Mostrar senha"}>{showPassword?<EyeOff size={16}/>:<Eye size={16}/>}</button></div>{(setupNeeded||registerMode)&&<small className="login-hint">Use uma senha forte com pelo menos 10 caracteres.</small>}</label>
        {registerMode&&<label>Confirmar senha<div className="login-input-wrap"><LockKeyhole size={16}/><input name="confirmPassword" type={showPassword?"text":"password"} autoComplete="new-password" minLength={10} maxLength={128} placeholder="Digite a senha novamente" required/></div></label>}
        <button className="login-submit" type="submit" disabled={busy}>{busy?(setupNeeded?"Configurando…":registerMode?"Criando acesso…":"Entrando…"):setupNeeded?"Criar acesso administrador":registerMode?"Cadastre-se":"Entrar no portal"}</button>
      </form>
      {!setupNeeded&&<button type="button" className="login-register-toggle" disabled={busy} onClick={()=>{setRegisterMode(value=>!value);setShowPassword(false);setFormError("");}}><UserRoundPlus size={16}/>{registerMode?"Voltar para entrar":"Cadastre-se"}</button>}
    </section>
  </main>;
}
