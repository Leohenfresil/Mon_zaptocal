import { useState, useEffect, useMemo } from "react";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight, MapPin, Filter, Download } from "lucide-react";
import { api } from "../services/api";
import { motion } from "motion/react";
import { downloadICS } from "../utils/ics";
import { supabase } from "../lib/supabaseClient";

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'month' | 'week'>('month');
  const [events, setEvents] = useState<any[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<any | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedEvent, setEditedEvent] = useState<any | null>(null);
  const [filterLocal, setFilterLocal] = useState<string>("");
  const [filterClient, setFilterClient] = useState<string>("");
  const [filterTags, setFilterTags] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [notification, setNotification] = useState<{ message: string, type: 'success' | 'error' } | null>(null);
  const [userTimezone, setUserTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
        if (user?.user_metadata?.timezone) {
            setUserTimezone(user.user_metadata.timezone);
        }
    });
  }, []);

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const showNotification = (message: string, type: 'success' | 'error') => {
    setNotification({ message, type });
  };

  const locales = useMemo(() => Array.from(new Set(events.map(e => e.location))).filter(Boolean).sort(), [events]);
  const clients = useMemo(() => Array.from(new Set(events.map(e => e.client))).filter(Boolean).sort(), [events]);
  const allTags = useMemo(() => {
	  const tagSet = new Set<string>();
	  events.forEach(e => {
		  if (e.tags) {
			  const eTags = Array.isArray(e.tags) ? e.tags : (typeof e.tags === 'string' ? e.tags.split(',').map((t: string) => t.trim()) : []);
			  eTags.forEach((t: string) => { if (t) tagSet.add(t); });
		  }
	  });
	  return Array.from(tagSet).sort();
  }, [events]);

  const filteredEvents = useMemo(() => {
	  return events.filter(e => {
		  if (filterLocal && e.location !== filterLocal) return false;
		  if (filterClient && e.client !== filterClient) return false;
		  if (filterTags.length > 0) {
			  const eTags = Array.isArray(e.tags) ? e.tags : (typeof e.tags === 'string' ? e.tags.split(',').map((t: string) => t.trim()) : []);
			  return filterTags.every(t => eTags.includes(t));
		  }
		  return true;
	  });
  }, [events, filterLocal, filterClient, filterTags]);

  useEffect(() => {
    api.events.list().then(setEvents).catch(console.error);
  }, []);

  const handleEdit = (event: any) => {
    setEditedEvent({ ...event });
    setIsEditing(true);
  };

  const handleSave = async () => {
    if (editedEvent) {
        try {
            await api.events.update(editedEvent.id, editedEvent);
            showNotification("Evento salvo com sucesso!", "success");
            setIsEditing(false);
            setSelectedEvent(null);
            const updatedEvents = await api.events.list();
            setEvents(updatedEvents);
        } catch (err) {
            console.error(err);
            showNotification("Erro ao salvar evento.", "error");
        }
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("Tem certeza que deseja excluir este evento?")) {
        try {
            await api.events.delete(id);
            showNotification("Evento excluído com sucesso!", "success");
            setSelectedEvent(null);
            const updatedEvents = await api.events.list();
            setEvents(updatedEvents);
        } catch (err) {
            console.error(err);
            showNotification("Erro ao excluir evento.", "error");
        }
    }
  }

  const days = useMemo(() => {
    if (viewMode === 'week') {
      const start = startOfWeek(currentDate);
      const end = endOfWeek(currentDate);
      return eachDayOfInterval({ start, end });
    } else {
      const monthStart = startOfMonth(currentDate);
      const monthEnd = endOfMonth(monthStart);
      const startDate = startOfWeek(monthStart);
      const endDate = endOfWeek(monthEnd);
      return eachDayOfInterval({ start: startDate, end: endDate });
    }
  }, [currentDate, viewMode]);

  const monthStart = useMemo(() => startOfMonth(currentDate), [currentDate]);

  const navigate = (direction: 'next' | 'prev') => {
    const amount = direction === 'next' ? 1 : -1;
    if (viewMode === 'month') {
        setCurrentDate(direction === 'next' ? addMonths(currentDate, 1) : subMonths(currentDate, 1));
    } else {
        // Simple weekly navigation
        const newDate = new Date(currentDate);
        newDate.setDate(newDate.getDate() + (amount * 7));
        setCurrentDate(newDate);
    }
  };
  const next = () => navigate('next');
  const prev = () => navigate('prev');

  const getEventStyle = (event: any) => {
    const eTags = Array.isArray(event.tags) ? event.tags : (typeof event.tags === 'string' ? event.tags.split(',').map((t: string) => t.trim()).filter(Boolean) : []);
    
    // Tag specific overrides
    if (eTags.includes("Paloma")) {
        return "bg-red-500/10 border-red-500/20 text-red-400";
    }
    if (eTags.includes("Isabel")) {
        return "bg-blue-500/10 border-blue-500/20 text-blue-400";
    }

    // Status based colors
    if (event.status === 'confirmed')
        return "bg-green-500/10 border-green-500/20 text-green-400";
    
    // Fallback for non-synced/new events
    if (!event.google_event_id) {
        if (event.status === 'pending') return "bg-yellow-500/10 border-yellow-500/20 text-yellow-400"; // Novo
        return "bg-gray-500/10 border-gray-500/20 text-gray-400"; // Não sincronizado
    }
    
    return "bg-amber-500/10 border-amber-500/20 text-amber-400";
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-2xl font-bold">Calendário de Eventos</h2>
        <div className="flex items-center gap-2">
            <button 
                onClick={() => setShowFilters(!showFilters)}
                className={`p-2 rounded-lg transition-colors ${showFilters ? "bg-blue-600 text-white" : "bg-gray-800 text-gray-400 hover:bg-gray-700"}`}
            >
                <Filter size={20} />
            </button>
        </div>
        
        {showFilters && (
            <div className="absolute top-20 right-10 z-10 flex flex-col gap-4 bg-gray-900 border border-gray-800 p-4 rounded-2xl shadow-xl w-72">
              <select value={filterLocal} onChange={e => setFilterLocal(e.target.value)} className="bg-gray-800 text-white rounded-lg p-2 text-sm">
                <option value="">Todos os Locais</option>
                {locales.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
              <select value={filterClient} onChange={e => setFilterClient(e.target.value)} className="bg-gray-800 text-white rounded-lg p-2 text-sm">
                <option value="">Todos os Clientes</option>
                {clients.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <div className="flex flex-wrap gap-2 text-sm">
                <span className="text-gray-400">Tags:</span>
                {allTags.map(tag => (
                  <button
                    key={tag}
                    onClick={() => setFilterTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])}
                    className={`px-3 py-1 rounded-full text-xs transition-colors ${filterTags.includes(tag) ? "bg-blue-600 text-white" : "bg-gray-800 text-gray-500 hover:bg-gray-700"}`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
              <button
                onClick={() => downloadICS(filteredEvents)}
                className="flex items-center justify-center gap-2 w-full bg-blue-600 hover:bg-blue-500 text-white p-2 rounded-lg text-sm mt-4"
              >
                <Download size={16} />
                Exportar para .ics
              </button>
            </div>
        )}
        
        <div className="flex items-center gap-4">
          <div className="flex bg-gray-900 border border-gray-800 rounded-lg p-1">
              <button onClick={() => setViewMode('month')} className={`px-3 py-1 rounded-md text-sm ${viewMode === 'month' ? 'bg-gray-800 text-white' : 'text-gray-500 hover:text-gray-300'}`}>Mês</button>
              <button onClick={() => setViewMode('week')} className={`px-3 py-1 rounded-md text-sm ${viewMode === 'week' ? 'bg-gray-800 text-white' : 'text-gray-500 hover:text-gray-300'}`}>Semana</button>
          </div>
          <div className="flex items-center gap-2 bg-gray-900 border border-gray-800 rounded-lg p-1 justify-center sm:justify-start w-full sm:w-auto">
            <button onClick={prev} className="p-2 hover:bg-gray-800 rounded-md transition-colors">
              <ChevronLeft size={20} />
            </button>
            <span className="text-sm font-semibold px-4 capitalize">
              {formatInTimeZone(currentDate, userTimezone, viewMode === 'month' ? "MMMM yyyy" : "d 'de' MMM, yyyy", { locale: ptBR })}
            </span>
            <button onClick={next} className="p-2 hover:bg-gray-800 rounded-md transition-colors">
              <ChevronRight size={20} />
            </button>
          </div>
          <button className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium">
            Ver Hoje
          </button>
        </div>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden shadow-2xl">
        {/* Week Headers */}
        <div className="grid grid-cols-7 border-b border-gray-800 bg-gray-800/20">
          {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"].map((day) => (
            <div key={day} className="px-4 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-widest">
              {day}
            </div>
          ))}
        </div>

        {/* Days Grid */}
        <div className="grid grid-cols-7">
          {days.map((day, i) => {
            const dayEvents = filteredEvents.filter(e => e.event_date && isSameDay(new Date(e.event_date), day));
            const isSelected = isSameMonth(day, monthStart);
            
            return (
              <div 
                key={i} 
                className={`min-h-[140px] border-r border-b border-gray-800 p-2 transition-colors ${
                  !isSelected ? "bg-gray-950/40 text-gray-700" : "bg-transparent hover:bg-gray-800/10"
                }`}
              >
                <div className="flex justify-between items-center mb-2">
                  <span className={`text-sm font-semibold ${isSameDay(day, new Date()) ? "w-7 h-7 bg-blue-600 text-white rounded-full flex items-center justify-center -ml-1" : ""}`}>
                    {format(day, "d")}
                  </span>
                </div>
                
                <div className="space-y-1">
                  {dayEvents.map((event, idx) => (
                    <div 
                      key={idx} 
                      onClick={() => setSelectedEvent(event)}
                      className={`relative cursor-pointer px-2 py-1.5 rounded-md text-[10px] leading-tight border transition-all duration-300 hover:scale-105 hover:shadow-lg group ${getEventStyle(event)}`}
                    >
                      <div className="flex items-center gap-1.5">
                          <div className={`w-1.5 h-1.5 rounded-full ${event.status === 'confirmed' ? 'bg-green-500' : event.status === 'pending' && event.google_event_id ? 'bg-blue-500' : 'bg-amber-500'}`} />
                          <div className="font-bold truncate">{event.client || "Cliente"}</div>
                      </div>
                      
                      {/* Preview Overlay */}
                      <div className="absolute left-0 top-full mt-1 hidden group-hover:block w-48 bg-gray-800 text-white p-3 rounded-xl shadow-2xl z-50 border border-gray-700 pointer-events-none">
                          <p className="font-bold text-sm truncate">{event.client}</p>
                          <p className="text-xs text-gray-300 mt-1 flex items-center gap-1">
                            <MapPin size={10} /> {event.location || "Sem local"}
                          </p>
                          <p className="text-xs text-gray-400 mt-0.5">{event.event_date} - {event.start_time}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {notification && (
        <div className={`fixed top-4 right-4 z-[9999] px-4 py-2 rounded-lg text-white shadow-lg ${notification.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
          {notification.message}
        </div>
      )}

      {selectedEvent && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-900 border border-gray-800 p-6 rounded-2xl w-full max-w-sm space-y-4">
            <h3 className="text-lg font-bold">{isEditing ? "Editar Evento" : "Detalhes do Evento"}</h3>
            {isEditing ? (
                <div className="space-y-3">
                    <input className="w-full bg-gray-800 border p-2 rounded" value={editedEvent.client || ''} onChange={e => setEditedEvent({...editedEvent, client: e.target.value})} placeholder="Cliente" />
                    <input className="w-full bg-gray-800 border p-2 rounded" value={editedEvent.location || ''} onChange={e => setEditedEvent({...editedEvent, location: e.target.value})} placeholder="Local" />
                    <input className="w-full bg-gray-800 border p-2 rounded" value={editedEvent.tags || ''} onChange={e => setEditedEvent({...editedEvent, tags: e.target.value})} placeholder="Tags (separadas por vírgula)" />
                </div>
            ) : (
                <div className="space-y-2">
                    <p><strong>Cliente:</strong> {selectedEvent.client}</p>
                    <p><strong>Data:</strong> {selectedEvent.event_date}</p>
                    <p><strong>Hora:</strong> {selectedEvent.start_time}</p>
                    <p><strong>Local:</strong> {selectedEvent.location}</p>
                    <p><strong>Tags:</strong> {Array.isArray(selectedEvent.tags) ? selectedEvent.tags.join(', ') : (selectedEvent.tags || 'Nenhuma')}</p>
                    <p><strong>Status:</strong> {selectedEvent.status === 'confirmed' ? 'Confirmado' : selectedEvent.status === 'pending' && selectedEvent.google_event_id ? 'Alterado' : 'Pendente'}</p>
                </div>
            )}
            
            <div className="flex gap-2 mt-4">
                {isEditing ? (
                    <>
                        <button onClick={() => setIsEditing(false)} className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-white">Cancelar</button>
                        <button onClick={handleSave} className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-white">Salvar</button>
                    </>
                ) : (
                    <>
                        <button onClick={() => setSelectedEvent(null)} className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-white">Fechar</button>
                        <button onClick={() => handleDelete(selectedEvent.id)} className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-500 rounded-lg text-white">Excluir</button>
                        <button onClick={() => handleEdit(selectedEvent)} className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-white">Editar</button>
                    </>
                )}
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}
