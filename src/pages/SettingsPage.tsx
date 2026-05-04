import { useState, useEffect } from "react";
import { api } from "../services/api";
import { motion } from "motion/react";
import { MessageSquare, Calendar, Shield, ExternalLink, RefreshCw, Smartphone, CheckCircle2, LogOut } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { supabase } from "../lib/supabaseClient";
import { useNavigate } from "react-router-dom";

export default function SettingsPage() {
  const [waStatus, setWaStatus] = useState<any>({ status: "disconnected", qr: null, monitoredGroupJid: null });
  const [calendlyStatus, setCalendlyStatus] = useState<any>({ authenticated: false });
  const [loading, setLoading] = useState(false);
  const [groups, setGroups] = useState<any[]>([]);
  const [userTimezone, setUserTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone);
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
        if (user?.user_metadata?.timezone) {
            setUserTimezone(user.user_metadata.timezone);
        }
    });
    refreshStatus();
    const interval = setInterval(refreshStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleTimezoneChange = async (tz: string) => {
    setUserTimezone(tz);
    await supabase.auth.updateUser({ data: { timezone: tz } });
  }

  useEffect(() => {
    if (waStatus.status === "connected") {
        fetchGroups();
    }
  }, [waStatus.status]);

  const refreshStatus = async () => {
    try {
      const wa = await api.whatsapp.getStatus();
      const cal = await api.calendar.getStatus();
      setWaStatus(wa);
      setCalendlyStatus(cal);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchGroups = async () => {
      try {
        const fetched = await api.whatsapp.getGroups();
        setGroups(fetched);
      } catch (err) {
        console.error(err);
      }
  };

  const handleSetGroup = async (jid: string) => {
      await api.whatsapp.setGroup(jid);
      refreshStatus();
  }

  const handleCalendlyAuth = () => {
    const width = 600;
    const height = 700;
    const left = window.screen.width / 2 - width / 2;
    const top = window.screen.height / 2 - height / 2;
    window.open(
      "/api/calendar/auth",
      "CalendlyAuth",
      `width=${width},height=${height},top=${top},left=${left},scrollbars=yes`
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="max-w-4xl space-y-8"
    >
      <div>
        <h2 className="text-2xl font-bold mb-2">Configurações</h2>
        <p className="text-gray-400">Gerencie suas conexões e segurança.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* WhatsApp Setup */}
        <div className="bg-gray-900 border border-gray-800 rounded-3xl p-8 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-6 opacity-10">
            <MessageSquare size={80} />
          </div>
          
          <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
            <Smartphone className="text-green-500" /> WhatsApp
          </h3>

          {waStatus.status === "connected" ? (
            <div className="space-y-6">
              <div className="p-6 bg-green-500/10 border border-green-500/20 rounded-2xl flex items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-green-500 flex items-center justify-center text-white">
                  <CheckCircle2 size={24} />
                </div>
                <div>
                  <p className="font-bold text-white">Dispositivo Conectado</p>
                  <p className="text-sm text-green-500">Monitorando mensagens em tempo real</p>
                </div>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm text-gray-400">Grupo de Monitoramento</label>
                <select 
                  value={waStatus.monitoredGroupJid || ""} 
                  onChange={(e) => handleSetGroup(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 p-3 rounded-xl text-white outline-none"
                >
                    <option value="">Selecione um grupo...</option>
                    {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </div>

              <button 
                onClick={() => api.whatsapp.disconnect()}
                className="w-full py-3 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-xl font-semibold transition-all"
              >
                Desconectar Dispositivo
              </button>
              
              <button 
                onClick={async () => {
                  setLoading(true);
                  try {
                    await api.whatsapp.reprocessMessages();
                    alert("Reprocessamento iniciado com sucesso!");
                  } catch (err) {
                    console.error(err);
                    alert("Erro ao reprocessar mensagens.");
                  } finally {
                    setLoading(false);
                  }
                }}
                disabled={loading}
                className="w-full py-3 bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 rounded-xl font-semibold transition-all flex items-center justify-center gap-2"
              >
                {loading ? <RefreshCw className="animate-spin" size={16} /> : <RefreshCw size={16} />}
                Reprocessar Mensagens Antigas
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              <p className="text-sm text-gray-400">Escaneie o QR Code abaixo com seu WhatsApp para iniciar o monitoramento.</p>
              
              <div className="bg-white p-4 rounded-3xl w-fit mx-auto shadow-2xl">
                {waStatus.qr ? (
                  <QRCodeSVG value={waStatus.qr} size={200} />
                ) : (
                  <div className="w-[200px] h-[200px] bg-gray-100 flex items-center justify-center rounded-xl animate-pulse">
                    <RefreshCw className="text-gray-300 animate-spin" size={32} />
                  </div>
                )}
              </div>

              <div className="text-center text-xs text-gray-500 flex items-center justify-center gap-2">
                <Shield size={12} /> Conexão criptografada ponta-a-ponta
              </div>
            </div>
          )}
        </div>

        {/* General Settings */}
        <div className="bg-gray-900 border border-gray-800 rounded-3xl p-8">
           <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
             <Calendar className="text-blue-500" /> Preferências
           </h3>
           <div className="space-y-4">
               <div>
                 <label className="block text-sm text-gray-400 mb-2">Zona Horária</label>
                 <select 
                   value={userTimezone} 
                   onChange={(e) => handleTimezoneChange(e.target.value)}
                   className="w-full bg-gray-800 border border-gray-700 p-3 rounded-xl text-white outline-none"
                 >
                   {Intl.supportedValuesOf('timeZone').map(tz => (
                     <option key={tz} value={tz}>{tz}</option>
                   ))}
                 </select>
               </div>
           </div>
        </div>

        {/* Calendly Setup */}
        <div className="bg-gray-900 border border-gray-800 rounded-3xl p-8 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-6 opacity-10">
            <Calendar size={80} />
          </div>

          <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
            <img src="https://assets.calendly.com/assets/external/logo.png" alt="Calendly" className="h-5 invert" />
          </h3>

          <div className="space-y-6">
            <p className="text-sm text-gray-400">Sincronize automaticamente os eventos extraídos com sua agenda do Calendly.</p>
            
            <div className={`p-6 rounded-2xl border transition-all ${
              calendlyStatus.authenticated 
                ? "bg-blue-500/10 border-blue-500/20" 
                : "bg-gray-800/50 border-gray-700"
            }`}>
              <div className="flex items-center gap-4">
                <div className={`h-12 w-12 rounded-full flex items-center justify-center text-white ${
                  calendlyStatus.authenticated ? "bg-blue-600" : "bg-gray-700"
                }`}>
                  <Calendar size={24} />
                </div>
                <div>
                  <p className="font-bold text-white">OAuth 2.0</p>
                  <p className={`text-sm ${calendlyStatus.authenticated ? "text-blue-500" : "text-gray-500"}`}>
                    {calendlyStatus.authenticated ? "Autenticado com sucesso" : "Aguardando autorização"}
                  </p>
                </div>
              </div>
            </div>

            <button 
              onClick={handleCalendlyAuth}
              className={`w-full py-3 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all ${
                calendlyStatus.authenticated
                  ? "bg-gray-800 hover:bg-gray-700 text-white" 
                  : "bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/20"
              }`}
            >
              {calendlyStatus.authenticated ? "Reautenticar Calendly" : "Conectar com Calendly"}
              <ExternalLink size={16} />
            </button>

            <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl">
              <p className="text-[10px] text-yellow-500 flex items-center gap-1 uppercase font-bold tracking-wider">
                Aviso de Segurança
              </p>
              <p className="text-xs text-gray-400 mt-1">Recomendamos usar uma conta dedicada para bots de sincronização.</p>
            </div>
          </div>
        </div>
      </div>
      
      <div className="border-t border-gray-800 pt-8 mt-8">
        <button
          onClick={async () => {
            await supabase.auth.signOut();
            navigate('/auth');
          }}
          className="flex items-center gap-2 text-red-500 hover:text-red-400 font-semibold"
        >
          <LogOut size={20} />
          Sair da conta
        </button>
      </div>
    </motion.div>
  );
}
