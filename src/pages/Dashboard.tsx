import { useState, useEffect } from "react";
import { api } from "../services/api";
import { motion } from "motion/react";
import { Calendar, CheckCircle2, Clock, MessageSquare, ArrowUpRight } from "lucide-react";

export default function Dashboard() {
  const [events, setEvents] = useState<any[]>([]);
  const [stats, setStats] = useState([
    { label: "Total de Mensagens", value: "0", icon: MessageSquare, color: "text-blue-500", bg: "bg-blue-500/10" },
    { label: "Eventos Detectados", value: "0", icon: Calendar, color: "text-purple-500", bg: "bg-purple-500/10" },
    { label: "Sincronizados", value: "0", icon: CheckCircle2, color: "text-green-500", bg: "bg-green-500/10" },
    { label: "Pendentes", value: "0", icon: Clock, color: "text-amber-500", bg: "bg-amber-500/10" },
  ]);

  useEffect(() => {
    api.whatsapp.getRecentMessages(5).then((data) => {
        // Map raw messages to a compatible format for the list
        setEvents(data.map((m: any) => ({
            parsed_data: { title: "Mensagem recebida" }, // Assuming a default here
            raw_text: m.body
        })));
    }).catch(console.error);
    
    api.events.stats().then((data) => {
      setStats([
        { label: "Total de Mensagens", value: data.totalMessages.toString(), icon: MessageSquare, color: "text-blue-500", bg: "bg-blue-500/10" },
        { label: "Eventos Detectados", value: data.totalEvents.toString(), icon: Calendar, color: "text-purple-500", bg: "bg-purple-500/10" },
        { label: "Sincronizados", value: data.confirmedEvents.toString(), icon: CheckCircle2, color: "text-green-500", bg: "bg-green-500/10" },
        { label: "Pendentes", value: data.pendingEvents.toString(), icon: Clock, color: "text-amber-500", bg: "bg-amber-500/10" },
      ]);
    }).catch(console.error);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-8"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, i) => (
          <div key={i} className="p-6 bg-gray-900 border border-gray-800 rounded-2xl flex items-center justify-between group hover:border-gray-700 transition-all">
            <div>
              <p className="text-sm text-gray-400 mb-1">{stat.label}</p>
              <h3 className="text-2xl font-bold text-white">{stat.value}</h3>
            </div>
            <div className={`p-4 ${stat.bg} ${stat.color} rounded-xl`}>
              <stat.icon size={24} />
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-1 gap-8">
        {/* Activity Chart */}


        {/* Recent Events */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <h3 className="text-lg font-semibold mb-6">Últimas Mensagens</h3>
          <div className="space-y-6">
            {events.length > 0 ? events.map((event, i) => (
              <div key={i} className="flex gap-4">
                <div className="h-10 w-10 shrink-0 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500">
                  <MessageSquare size={18} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white truncate">{event.parsed_data?.title || "Evento sem título"}</p>
                  <p className="text-xs text-gray-500 truncate mt-1">{event.raw_text}</p>
                </div>
              </div>
            )) : (
              <p className="text-gray-500 text-sm text-center py-10">Nenhuma mensagem interceptada ainda.</p>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
