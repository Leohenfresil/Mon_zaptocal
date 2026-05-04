import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

// ── Extração de variáveis ────────────────────────────────
dotenv.config();

// Inicialização segura do cliente Gemini
let ai: GoogleGenAI | null = null;
if (process.env.GEMINI_API_KEY) {
  try {
    ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  } catch (e) {
    console.error("Erro ao inicializar Gemini:", e);
  }
}

// ── Parsing via Regras Específicas ──────────────────────────────
export function parseWithRules(content: string): any[] {
    const events: any[] = [];
    
    const monthsMap: { [key: string]: string } = {
      "janeiro": "01", "fevereiro": "02", "março": "03", "marco": "03", "abril": "04", "maio": "05", "junho": "06",
      "julho": "07", "agosto": "08", "setembro": "09", "outubro": "10", "novembro": "11", "dezembro": "12"
    };

    const monthsList = ["janeiro", "fevereiro", "março", "marco", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
    const monthsRegex = monthsList.join('|');
     // Split messages into month blocks looking for keywords or just month names at the start of a line or start of content
    const monthSections = content.split(new RegExp(`(?=(?:\\n|^)\\s*(?:(?:AGENDA|MÊS|MES)\\s+(?:\\d{4})?\\s*)?(?:${monthsRegex})\\b)`, 'i'));
    
    let currentYear = new Date().getFullYear().toString();
    // Try to find a year anywhere in the content early on
    const globalYearMatch = content.match(/\b(202\d)\b/);
    if (globalYearMatch) currentYear = globalYearMatch[1];
    
    for (const section of monthSections) {
      if (section.trim().length < 3) continue;

      // 1. Extract Year and Month from Section Header or first few lines
      const headerMatch = section.match(new RegExp(`(?:(?:AGENDA|MÊS|MES)\\s+)?(\\d{4})?\\s*(${monthsRegex})`, 'i'));
      
      let year = currentYear;
      let monthName = "";
      
      if (headerMatch) {
        if (headerMatch[1]) year = headerMatch[1];
        monthName = headerMatch[2].toLowerCase();
      } else {
        // Fallback: search for stand-alone month name in first part of section
        for (const m of monthsList) {
          if (section.toLowerCase().substring(0, 100).includes(m)) {
            monthName = m;
            break;
          }
        }
      }
      
      if (!monthName) {
        // console.log("[ProcessorService] Skipping section - no month found:", section.substring(0, 50) + "...");
        continue;
      }
      
      const month = monthsMap[monthName];
      if (!month) continue;

      // 2. Split section into potential event blocks
      const blocksSource = section.split(/(?:\n|^)\s*\*?\s*Data\s*[:：]\s*\*?/i);
      
      if (blocksSource.length > 1) {
        for (let i = 1; i < blocksSource.length; i++) {
          const block = blocksSource[i];
          const dayMatch = block.match(/(?:[\*\s]*?)(\d{1,2})/);
          if (!dayMatch) continue;
          const day = dayMatch[1].padStart(2, '0');
          
          const eventDate = `${year}-${month}-${day}`;
          // Basic date validation
          if (isNaN(new Date(eventDate).getTime())) {
             console.warn(`[ProcessorService] Invalid date generated: ${eventDate}`);
             continue;
          }

          const clientMatch = block.match(/(?:Cliente|Evento|Título|Titulo|Nome|N):\s*\*?([^\n\*]+)\*?/i);
          let client = clientMatch ? clientMatch[1].trim() : "";
          let title = client ? "Evento para " + client : "";
          
          if (!title) {
            // Look for next lines that don't start with day or location/time keywords
            const lines = block.split('\n').map(l => l.trim()).filter(l => l.length > 0);
            for (const line of lines) {
              const lowerLine = line.toLowerCase();
              if (line.match(/^\d{1,2}/)) continue;
              if (lowerLine.includes('local') || lowerLine.includes('horário') || lowerLine.includes('cliente') || lowerLine.includes('convidados')) continue;
              if (line.length > 2) {
                title = line.replace(/[\*\_]/g, '').trim();
                break;
              }
            }
          }
          
          if (!title) title = "Agendamento";
          
          const timeMatch = block.match(/(?:Horário|Horario|Hora|H|às|as)\s*[:：]?\s*\*?(\d{1,2}(?:[hH:]\d{2})?)?/i);
          let time = "12:00";
          if (timeMatch && timeMatch[1]) {
            let rawTime = timeMatch[1].replace(/h/i, ':').replace(/\s/g, '').trim();
            if (!rawTime.includes(':')) rawTime += ":00";
            if (rawTime.length < 5 && rawTime.includes(':')) {
              const parts = rawTime.split(':');
              rawTime = `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
            }
            time = rawTime;
          } else if (block.toLowerCase().includes('horário') || block.toLowerCase().includes('horario')) {
            // Label exists but no specific time found, use default or mark it
            time = "00:00"; // Mark extreme edge cases or specific markers as midnight
          }
          
          const locMatch = block.match(/(?:Local|Endereço|Endereco|Lugar):\s*\*?([^\n\*]+)\*?/i);
          const location = locMatch ? locMatch[1].trim() : "Não especificado";
          
          const guestsMatch = block.match(/(?:Convidados|Pessoas|Qtd|Q):\s*(\d+)/i);
          const guests = guestsMatch ? parseInt(guestsMatch[1]) : null;
  
          events.push({
            title: title,
            client: client,
            date: eventDate,
            time: time,
            location: location,
            guests: guests,
            durationMinutes: 60
          });
        }
      } else {
        // Fallback: line by line within this section (e.g. "Data: 10 - Cliente - 14h")
        const lines = section.split('\n');
        for (const line of lines) {
          const lineMatch = line.match(/(?:[\*\s]*)(\d{1,2})[\s\-\/\*]+(?:[A-ZÀ-Úa-zà-ú\s]+[\s\-\/\*]+)?(\d{1,2}(?:[hH:]\d{2})?)/);
          if (lineMatch) {
            const day = lineMatch[1].padStart(2, '0');
            let time = lineMatch[2].replace(/h/i, ':').trim();
            if (!time.includes(':')) time += ":00";
            
            events.push({
              title: line.replace(/[\*\_]/g, '').substring(0, 50).trim(),
              date: `${year}-${month}-${day}`,
              time: time,
              location: "Extraindo da linha",
              guests: null,
              durationMinutes: 60
            });
          }
        }
      }
    }

    return events;
  }

// ── Parseador principal ────────────────────────────────────
// Usa regex heurísticos + opcionalmente Gemini para parsing inteligente

export async function parseMessage(text: string) {
  if (!text || text.trim().length < 5) return fallbackParser(text);

  // 1. Tenta parsing via IA (Gemini), se configurado
  if (ai) {
    try {
      const aiResult = await parseWithGemini(text);
      if (aiResult) return aiResult;
    } catch (error: any) {
      console.warn('⚠️  Parsing via IA falhou:', error.message);
    }
  }

  // 2. Fallback: parsing via regex heurísticos
  const rulesResult = parseWithRules(text);
  if (rulesResult && rulesResult.length > 0) return rulesResult[0]; // TODO: handle multiple events
  
  return fallbackParser(text);
}

// ── Parsing via Gemini ─────────────────────────────────────
async function parseWithGemini(text: string) {
  try {
    const prompt = `Você é um assistente que extrai informações de eventos de mensagens de WhatsApp em português brasileiro.
Analise a mensagem abaixo e extraia as informações do evento. Se a mensagem NÃO contiver informações de evento/agenda, retorne null.

Mensagem:
"${text}"

Retorne APENAS um JSON válido com os campos (ou null se não for um evento):
{
  "title": "título/nome do evento",
  "description": "descrição adicional se houver",
  "startDate": "YYYY-MM-DD",
  "startTime": "HH:MM ou null",
  "location": "local do evento ou null",
  "guests": número_de_convidados_ou_null,
  "isRecurring": boolean,
  "recurrencePattern": "string ou null",
  "recurrenceDetails": {
    "type": "string",
    "interval": "number ou null"
  }
}

Regras:
- startDate OBRIGATÓRIO no formato YYYY-MM-DD
- Se o ano não for mencionado, use ${new Date().getFullYear()}
- guest_count: número inteiro apenas
- Se não for claramente um evento com data, retorne null
- Para isRecurring, identifique se o evento se repete. Preencha recurrencePattern com a descrição da frequência e forneça as informações estruturadas em recurrenceDetails.`;

    const response = await ai.models.generateContent({
      model: "gemini-1.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            description: { type: Type.STRING },
            startDate: { type: Type.STRING },
            startTime: { type: Type.STRING },
            location: { type: Type.STRING },
            guests: { type: Type.INTEGER },
            isRecurring: { type: Type.BOOLEAN },
            recurrencePattern: { type: Type.STRING },
            recurrenceDetails: {
              type: Type.OBJECT,
              properties: {
                type: { type: Type.STRING },
                interval: { type: Type.INTEGER }
              }
            },
          },
        },
      },
    });

    const content = response.text?.trim();
    if (!content || content === 'null') return null;

    const parsed = JSON.parse(content);
    if (!parsed || !parsed.startDate) return null;

    return {
      title: parsed.title || 'Evento sem título',
      description: parsed.description || null,
      startDate: parsed.startDate,
      startTime: parsed.startTime || null,
      location: parsed.location || null,
      guests: parsed.guests || null,
      isRecurring: parsed.isRecurring || false,
      recurrencePattern: parsed.recurrencePattern || null,
      recurrenceDetails: parsed.recurrenceDetails || null,
    };

  } catch (error: any) {
    console.warn('⚠️  Parsing via IA falhou, usando regex:', error.message);
    return null;
  }
}

// ── Parsing via Regex (Fallback) ──────────────────────────────────────
function fallbackParser(text: string) {
  const data: any = {
    title: text.split('\n')[0].substring(0, 50),
    startDate: null,
    startTime: null,
    location: null,
    guests: null,
    description: text,
    isRecurring: false,
    recurrencePattern: null,
    recurrenceDetails: null,
  };

  const lowerText = text.toLowerCase();

  // 1. More flexible regex definitions
  // 1. dd/mm[/yyyy], dd-mm, dd.mm
  // 2. dd de <mes> (dia 7 de abril, 7 de abril)
  // 3. dda <mes> (7a Abril)
  // 4. dd/<mes> (7/Abr)
  const dateRegex = /(?:(\d{1,2})[\/\-\.](\d{1,2})(?:[\/\-\.](\d{2,4}))?)|(?:(?:dia\s+)?(\d{1,2})\s*(?:de\s+|a|\/)\s*([a-z]+))/i;
  
  // Time: HH:MM, HHhMM, HHh, 15:00, 15h00, 15h
  const timeRegex = /(?:\b(?:às?|em)\s+)?(\d{1,2})(?:[hH:](\d{0,2}))?\b/;
  // Guests: keyword + number
  const guestRegex = /(?:convidado|pessoa|participante|vaga)s?\s*(?:de\s*)?(?:é\s*)?:?\s*(\d{1,3})/;
  // Location: keyword + content
  const locationRegex = /(?:local|endereço|onde)\s*(?:é\s*)?:?\s*(.+)/i;
  // Recurrence
  const recurringKeywords = [
    {
      pattern: 'diário',
      regex: /diari[oa]|todos os dia[s]?/i,
      details: { type: 'daily', interval: 1 }
    },
    {
      pattern: 'semanal',
      regex: /semanal|toda\s+(?:segunda|terça|quarta|quinta|sexta|sábado|domingo)/i,
      details: { type: 'weekly' }
    },
    {
      pattern: 'quinzenal',
      regex: /quinzenal/i,
      details: { type: 'weekly', interval: 2 }
    },
    {
      pattern: 'mensal',
      regex: /mensal|todo dia \d+/i,
      details: { type: 'monthly' }
    },
    {
      pattern: 'complexo',
      regex: /todo(?:s)?\s+(?:primeir[oa]|segund[oa]|terceir[oa]|quart[oa]|últim[oa])\s+(?:segunda|terça|quarta|quinta|sexta|sábado|domingo)/i,
      details: { type: 'complex' }
    },
    {
      pattern: 'a cada dias',
      regex: /a cada\s+(\d+)\s+dia[s]?/i,
      details: { type: 'daily' }
    }
  ];

  const monthMap: Record<string, string> = {
    'jan': '01', 'janeiro': '01',
    'fev': '02', 'fevereiro': '02',
    'mar': '03', 'março': '03',
    'abr': '04', 'abril': '04',
    'mai': '05', 'maio': '05',
    'jun': '06', 'junho': '06',
    'jul': '07', 'julho': '07',
    'ago': '08', 'agosto': '08',
    'set': '09', 'setembro': '09',
    'out': '10', 'outubro': '10',
    'nov': '11', 'novembro': '11',
    'dez': '12', 'dezembro': '12'
  };

  // 2. Global scan
  const dateMatch = lowerText.match(dateRegex);
  if (dateMatch) {
    const currentYear = new Date().getFullYear().toString();
    if (dateMatch[1]) { // dd/mm[/yyyy] style
      const d = dateMatch[1].padStart(2, '0');
      const m = dateMatch[2].padStart(2, '0');
      const y = dateMatch[3] ? (dateMatch[3].length === 2 ? `20${dateMatch[3]}` : dateMatch[3]) : currentYear;
      data.startDate = `${y}-${m}-${d}`;
    } else if (dateMatch[4]) { // dd [de|a|/] mes style
      const d = dateMatch[4].padStart(2, '0');
      const mesName = dateMatch[5].substring(0, 3).toLowerCase();
      const m = monthMap[mesName] || '01';
      data.startDate = `${currentYear}-${m}-${d}`;
    }
  }

  const timeMatch = lowerText.match(timeRegex);
  if (timeMatch) {
    data.startTime = `${timeMatch[1].padStart(2, '0')}:${(timeMatch[2] || '00').padStart(2, '0')}`;
  }

  const guestMatch = lowerText.match(guestRegex);
  if (guestMatch) {
    data.guests = parseInt(guestMatch[1]);
  }
  
  const locationMatch = text.match(locationRegex);
  if (locationMatch && locationMatch[1]) {
    data.location = locationMatch[1].split('\n')[0].trim();
  }

  for (const item of recurringKeywords) {
    if (item.regex.test(lowerText)) {
      data.isRecurring = true;
      data.recurrencePattern = item.pattern;
      data.recurrenceDetails = item.details;
      break;
    }
  }

  // 3. Line-based scan for explicit labels (highest priority)
  text.split("\n").forEach((line) => {
    const lowerLine = line.toLowerCase();
    
    // Only override if not already found by regex
    if (lowerLine.includes("local:") && !data.location) data.location = line.split(":").slice(1).join(":").trim();
    if (lowerLine.includes("data:") && !data.startDate) {
        const dStr = line.split("data:")[1]?.trim();
        // Assume simple YYYY-MM-DD or DD/MM for now
        data.startDate = dStr || data.startDate;
    }
    if ((lowerLine.includes("horário:") || lowerLine.includes("horario:")) && !data.startTime) data.startTime = line.split(":")[1]?.trim() || data.startTime;
    if ((lowerLine.includes("convidados:") || lowerLine.includes("guests:")) && !data.guests) data.guests = parseInt(line.split(":")[1]?.trim()) || data.guests;
    if ((lowerLine.includes("evento:") || lowerLine.includes("title:")) && !data.title) data.title = line.split(":")[1]?.trim() || data.title;
  });

  return data;
}
