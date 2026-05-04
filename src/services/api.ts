const API_BASE = "/api";

export async function fetchWithAuth(url: string, options: any = {}) {
  const response = await fetch(url, options);
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(error.error || "Request failed");
  }
  return response.json();
}

export const api = {
  whatsapp: {
    getStatus: () => fetchWithAuth(`${API_BASE}/whatsapp/status`),
    getGroups: () => fetchWithAuth(`${API_BASE}/whatsapp/groups`),
    disconnect: () => fetchWithAuth(`${API_BASE}/whatsapp/disconnect`, { method: "POST" }),
    setGroup: (jid: string) => fetchWithAuth(`${API_BASE}/whatsapp/set-group`, { 
      method: "POST", 
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jid })
    }),
    fetchPastMessages: (jid: string, limit: number) => fetchWithAuth(`${API_BASE}/whatsapp/fetch-past-messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jid, limit })
    }),
    reprocessMessages: () => fetchWithAuth(`${API_BASE}/whatsapp/reprocess-messages`, { method: "POST" }),
    getRecentMessages: (limit: number = 5) => fetchWithAuth(`${API_BASE}/whatsapp/recent-messages?limit=${limit}`),
  },
  events: {
    list: (filters: Record<string, string> = {}) => {
      const query = new URLSearchParams(filters).toString();
      return fetchWithAuth(`${API_BASE}/events${query ? `?${query}` : ""}`);
    },
    create: (event: any) => fetchWithAuth(`${API_BASE}/events`, { 
      method: "POST", 
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(event) 
    }),
    update: (id: string, event: any) => fetchWithAuth(`${API_BASE}/events/${id}`, { 
      method: "PUT", 
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(event) 
    }),
    stats: () => fetchWithAuth(`${API_BASE}/events/stats`),
    sync: (id: string) => fetchWithAuth(`${API_BASE}/events/${id}/sync`, { method: "POST" }),
    syncBulk: (ids: string[]) => fetchWithAuth(`${API_BASE}/events/sync-bulk`, { 
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids })
    }),
    delete: (id: string) => fetchWithAuth(`${API_BASE}/events/${id}`, { method: "DELETE" }),
  },
  calendar: {
    getStatus: () => fetchWithAuth(`${API_BASE}/calendar/status`),
  }
};
