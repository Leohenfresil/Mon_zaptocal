import { useState, useEffect, useMemo } from "react";
import { api } from "../services/api";
import { motion } from "motion/react";
import { Calendar, CheckCircle2, Clock, MapPin, User, ExternalLink, Search, Filter, Edit2, Tag, Share2 } from "lucide-react";
import { format, startOfMonth, endOfMonth, parseISO } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import { ptBR } from "date-fns/locale";
import { supabase } from "../lib/supabaseClient";

export default function EventsPage() {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editingEvent, setEditingEvent] = useState<any | null>(null);
  const [isFilterVisible, setIsFilterVisible] = useState(false);
  const [userTimezone, setUserTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
        if (user?.user_metadata?.timezone) {
            setUserTimezone(user.user_metadata.timezone);
        }
    });
  }, []);
  
  const [filters, setFilters] = useState({
    client: "",
    status: "",
    location: "",
    month: format(new Date(), "yyyy-MM"),
  });

  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [bulkTagValue, setBulkTagValue] = useState("");
  const [notification, setNotification] = useState<{ message: string, type: 'success' | 'error' } | null>(null);

  const handleBulkTag = async (action: 'add' | 'remove') => {
      if (!bulkTagValue.trim()) return;
      try {
          const tagToApply = bulkTagValue.trim();
          await Promise.all(
              Array.from(selectedIds).map(async (id) => {
                  const event = events.find(e => e.id === id);
                  if (!event) return;
                  
                  let tags = Array.isArray(event.tags) 
                      ? [...event.tags] 
                      : String(event.tags || "").split(',').map((t: string) => t.trim()).filter(Boolean);
                  
                  if (action === 'add') {
                      if (!tags.includes(tagToApply)) tags.push(tagToApply);
                  } else {
                      tags = tags.filter(t => t !== tagToApply);
                  }
                  
                  await api.events.update(id, { ...event, tags });
              })
          );
          showNotification(`Tags atualizadas para ${selectedIds.size} eventos!`, "success");
          setBulkTagValue("");
          loadEvents();
      } catch (err) {
          showNotification("Erro ao atualizar tags em lote", "error");
          console.error(err);
      }
  }

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const showNotification = (message: string, type: 'success' | 'error') => {
    setNotification({ message, type });
  };
  
  const allAvailableTags = useMemo(() => {
    const tagsSet = new Set<string>();
    events.forEach(event => {
      if (event.tags) {
        const tags = Array.isArray(event.tags) 
          ? event.tags 
          : String(event.tags).split(',');
        
        tags.forEach(tag => {
          const trimmedTag = tag.trim();
          if (trimmedTag) tagsSet.add(trimmedTag);
        });
      }
    });
    return Array.from(tagsSet).sort();
  }, [events]);

  const filteredEvents = useMemo(() => {
    if (selectedTags.length === 0) return events;
    return events.filter(event => {
      let eventTags: string[] = [];
      if (event.tags) {
        eventTags = Array.isArray(event.tags) 
          ? event.tags 
          : String(event.tags).split(',').map((t: string) => t.trim());
      }
      return selectedTags.every(tag => eventTags.includes(tag));
    });
  }, [events, selectedTags]);

  useEffect(() => {
    loadEvents();
  }, [filters]);

  const loadEvents = async () => {
    setLoading(true);
    try {
      const queryParams: Record<string, string> = {};
      
      // If no explicit status filter, use the month filter
      if (!filters.status) {
        queryParams.startDate = format(startOfMonth(parseISO(`${filters.month}-01`)), "yyyy-MM-dd");
        queryParams.endDate = format(endOfMonth(parseISO(`${filters.month}-01`)), "yyyy-MM-dd");
      }
      
      if (filters.client) queryParams.client = filters.client;
      if (filters.status) queryParams.status = filters.status;
      if (filters.location) queryParams.location = filters.location;

      const data = await api.events.list(queryParams);
      setEvents(data);
      setSelectedIds(new Set());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async (id: string) => {
    try {
      await api.events.sync(id);
      loadEvents();
      showNotification("Evento sincronizado com sucesso!", "success");
    } catch (err) {
      console.error(err);
      showNotification("Erro ao sincronizar evento.", "error");
    }
  };

  const handleBulkSync = async () => {
    try {
      await api.events.syncBulk(Array.from(selectedIds));
      loadEvents();
      showNotification(`${selectedIds.size} eventos sincronizados com sucesso!`, "success");
    } catch (err) {
      console.error(err);
      showNotification("Erro ao sincronizar eventos.", "error");
    }
  };

  const toggleSelectAll = () => {
    const pendingEvents = filteredEvents.filter(e => e.status !== "confirmed");
    if (selectedIds.size === pendingEvents.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(pendingEvents.map(e => e.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Gestão de Eventos</h2>
        <div className="flex items-center gap-2">
          <button 
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium transition-colors text-white"
            onClick={() => setEditingEvent({})}
          >
            Novo Evento
          </button>
          
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-2 border-l border-gray-700 pl-2">
                <input 
                    placeholder="Tag..."
                    className="bg-gray-800 border border-gray-700 px-2 py-1.5 rounded-lg text-sm w-24 text-white outline-none"
                    value={bulkTagValue}
                    onChange={(e) => setBulkTagValue(e.target.value)}
                />
                <button
                    onClick={() => handleBulkTag('add')}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium transition-colors text-white"
                >
                    + Tag
                </button>
                <button
                    onClick={() => handleBulkTag('remove')}
                    className="px-3 py-1.5 bg-red-600 hover:bg-red-500 rounded-lg text-sm font-medium transition-colors text-white"
                >
                    - Tag
                </button>
                <button
                    onClick={handleBulkSync}
                    className="px-4 py-2 bg-green-600 hover:bg-green-500 rounded-lg text-sm font-medium transition-colors text-white"
                >
                    Sincronizar {selectedIds.size}
                </button>
            </div>
          )}
          <button 
            onClick={loadEvents}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm font-medium transition-colors"
          >
            Atualizar Lista
          </button>
        </div>
      </div>

      {notification && (
        <div className={`fixed top-4 right-4 z-[9999] px-4 py-2 rounded-lg text-white shadow-lg ${notification.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
          {notification.message}
        </div>
      )}

      {editingEvent && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-900 border border-gray-800 p-6 rounded-2xl w-full max-w-lg space-y-4">
            <h3 className="text-lg font-bold">{editingEvent.id ? "Editar Evento" : "Novo Evento"}</h3>
            <input
              type="text"
              placeholder="Cliente/Título"
              className="w-full bg-gray-800 border border-gray-700 p-2 rounded-lg text-white"
              value={editingEvent.client || ""}
              onChange={(e) => setEditingEvent(prev => ({...prev, client: e.target.value}))}
            />
            <div className="grid grid-cols-2 gap-4">
              <input
                type="date"
                className="w-full bg-gray-800 border border-gray-700 p-2 rounded-lg text-white"
                value={editingEvent.event_date || ""}
                onChange={(e) => setEditingEvent(prev => ({...prev, event_date: e.target.value}))}
              />
              <input
                type="time"
                className="w-full bg-gray-800 border border-gray-700 p-2 rounded-lg text-white"
                value={editingEvent.start_time || ""}
                onChange={(e) => setEditingEvent(prev => ({...prev, start_time: e.target.value}))}
              />
            </div>
            <input
              type="text"
              placeholder="Local"
              className="w-full bg-gray-800 border border-gray-700 p-2 rounded-lg text-white"
              value={editingEvent.location || ""}
              onChange={(e) => setEditingEvent(prev => ({...prev, location: e.target.value}))}
            />
            <input
              type="text"
              placeholder="Tags (separadas por vírgula)"
              className="w-full bg-gray-800 border border-gray-700 p-2 rounded-lg text-white"
              value={Array.isArray(editingEvent.tags) ? editingEvent.tags.join(', ') : (editingEvent.tags || "")}
              onChange={(e) => setEditingEvent(prev => ({...prev, tags: e.target.value}))}
            />
             <div className="flex justify-end gap-2 mt-4">
                <button onClick={() => setEditingEvent(null)} className="px-4 py-2 text-gray-400 hover:text-white">Cancelar</button>
                <button 
                  onClick={async () => {
                     // Validação de campos obrigatórios
                     if (!editingEvent.client || !editingEvent.event_date) {
                        showNotification("Título/Cliente e Data são obrigatórios!", "error");
                        return;
                     }

                     try {
                        if (editingEvent.id) {
                           await api.events.update(editingEvent.id, editingEvent);
                        } else {
                           await api.events.create(editingEvent);
                        }
                        showNotification("Evento salvo com sucesso!", "success");
                        setEditingEvent(null);
                        loadEvents();
                     } catch (err) {
                        console.error(err);
                        showNotification("Erro ao salvar evento.", "error");
                     }
                  }}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-white"
                >Salvar</button>
             </div>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="bg-gray-900 border border-gray-800 p-4 rounded-2xl space-y-4">
        <div className="flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 text-gray-500" size={16} />
            <input
              type="text"
              placeholder="Buscar por cliente/título..."
              value={filters.client}
              onChange={(e) => setFilters(prev => ({...prev, client: e.target.value}))}
              className="w-full pl-10 pr-4 py-2 bg-gray-800 rounded-lg border border-gray-700 focus:border-blue-500 outline-none text-sm text-white"
            />
          </div>
          <button 
            onClick={() => setIsFilterVisible(!isFilterVisible)}
            className={`p-2 rounded-lg transition-colors ${isFilterVisible ? "bg-blue-600 text-white" : "bg-gray-800 text-gray-400 hover:bg-gray-700"}`}
          >
            <Filter size={20} />
          </button>
        </div>

        {isFilterVisible && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-gray-800">
            <select
              value={filters.status}
              onChange={(e) => setFilters(prev => ({...prev, status: e.target.value}))}
              className="bg-gray-800 rounded-lg border border-gray-700 px-4 py-2 text-sm text-white outline-none"
            >
              <option value="">Status: Todos</option>
              <option value="pending">Pendente</option>
              <option value="confirmed">Sincronizado</option>
            </select>
            <div className="relative">
              <MapPin className="absolute left-3 top-3 text-gray-500" size={16} />
              <input
                type="text"
                placeholder="Buscar por local..."
                value={filters.location}
                onChange={(e) => setFilters(prev => ({...prev, location: e.target.value}))}
                className="w-full pl-10 pr-4 py-2 bg-gray-800 rounded-lg border border-gray-700 focus:border-blue-500 outline-none text-sm text-white"
              />
            </div>
            <input
              type="month"
              value={filters.month}
              onChange={(e) => setFilters(prev => ({...prev, month: e.target.value}))}
              className="bg-gray-800 rounded-lg border border-gray-700 px-4 py-2 text-sm text-white outline-none"
            />
            {allAvailableTags.length > 0 && (
              <div className="md:col-span-3 flex flex-wrap gap-2 pt-2">
                <span className="text-sm text-gray-400 self-center">Tags:</span>
                {allAvailableTags.map(tag => (
                  <button
                    key={tag}
                    onClick={() => setSelectedTags(prev => 
                      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
                    )}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                      selectedTags.includes(tag) 
                        ? "bg-blue-600 text-white" 
                        : "bg-gray-800 text-gray-400 hover:bg-gray-700"
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-gray-800/50 text-gray-400 text-xs uppercase tracking-wider">
            <tr>
              <th className="px-6 py-4 font-semibold w-10">
                <input 
                  type="checkbox" 
                  checked={selectedIds.size > 0 && selectedIds.size === filteredEvents.filter(e => e.status !== "confirmed").length}
                  onChange={toggleSelectAll}
                  className="rounded border-gray-700 bg-gray-900 text-blue-600 focus:ring-blue-500"
                />
              </th>
              <th className="px-6 py-4 font-semibold">Evento / Data</th>
              <th className="px-6 py-4 font-semibold">Local / Cliente</th>
              <th className="px-6 py-4 font-semibold">Tags</th>
              <th className="px-6 py-4 font-semibold">Status</th>
              <th className="px-6 py-4 font-semibold">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {filteredEvents.length > 0 ? filteredEvents.map((event) => (
              <tr key={event.id} className="hover:bg-gray-800/20 transition-colors">
                <td className="px-6 py-4">
                  {event.status !== "confirmed" && (
                    <input 
                      type="checkbox" 
                      checked={selectedIds.has(event.id)}
                      onChange={() => toggleSelect(event.id)}
                      className="rounded border-gray-700 bg-gray-900 text-blue-600 focus:ring-blue-500"
                    />
                  )}
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-col">
                    <span className="font-medium text-white">{event.client || "Sem título"}</span>
                    <div className="flex items-center gap-1 text-xs text-gray-500 mt-1">
                      <Clock size={12} />
                      <span>{event.event_date ? format(new Date(`${event.event_date}T${event.start_time || '00:00'}`), "dd 'de' MMMM, HH:mm", { locale: ptBR }) : "Data não definida"}</span>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-1 text-xs text-gray-300">
                      <MapPin size={12} className="text-gray-500" />
                      <span>{event.location || "N/A"}</span>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-gray-300">
                      <User size={12} className="text-gray-500" />
                      <span>{event.guests != null ? `${event.guests} convidados` : "0 convidados"}</span>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                   <div className="flex flex-wrap gap-1">
                     {(Array.isArray(event.tags) ? event.tags : (typeof event.tags === 'string' ? event.tags.split(',').map((t: string) => t.trim()).filter(Boolean) : [])).map((tag, i) => (
                       <span key={i} className="px-2 py-0.5 bg-gray-800 text-gray-400 rounded-full text-[10px]">{tag}</span>
                     ))}
                   </div>
                </td>
                <td className="px-6 py-4">
                  {event.status === "confirmed" ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-500/10 text-green-500 border border-green-500/20">
                      <CheckCircle2 size={12} /> Sincronizado
                    </span>
                  ) : event.status === "pending" && event.google_event_id ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-500/10 text-blue-500 border border-blue-500/20">
                      <Clock size={12} /> Alterado
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-500 border border-amber-500/20">
                      <Clock size={12} /> Pendente
                    </span>
                  )
                  }
                </td>
                <td className="px-6 py-4">
                   <div className="flex gap-2">
                        {event.status !== "confirmed" && (
                          <button
                            onClick={() => handleSync(event.id)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-md text-xs font-medium transition-colors"
                          >
                            <Sync size={14} /> Sincronizar
                          </button>
                        )}
                        <button
                          onClick={() => {
                              const link = `${window.location.origin}/event/${event.id}`;
                              navigator.clipboard.writeText(link);
                              showNotification("Link copiado para a área de transferência!", "success");
                          }}
                          className="p-2 bg-gray-700 hover:bg-gray-600 text-white rounded-md transition-colors"
                          title="Compartilhar"
                        >
                          <Share2 size={16} />
                        </button>
                        <button
                          onClick={() => setEditingEvent(event)}
                          className="p-2 bg-gray-700 hover:bg-gray-600 text-white rounded-md transition-colors"
                          title="Editar"
                        >
                          <Edit2 size={16} />
                        </button>
                   </div>
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-gray-500 italic">
                  {loading ? "Carregando..." : "Nenhum evento detectado ainda."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}

function Sync({ size, className }: { size?: number, className?: string }) {
  return (
    <svg 
      width={size || 24} 
      height={size || 24} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
    >
      <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
    </svg>
  );
}
