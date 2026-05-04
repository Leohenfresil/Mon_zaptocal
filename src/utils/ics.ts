import { format } from "date-fns";

export function generateICS(events: any[]): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Monitor Zaptocal//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];

  events.forEach((event) => {
    const startDate = new Date(event.event_date);
    const endDate = new Date(startDate.getTime() + 60 * 60 * 1000); // Assume 1 hour duration if not specified

    lines.push("BEGIN:VEVENT");
    lines.push(`SUMMARY:${event.title || "Evento"}`);
    lines.push(`DTSTART:${format(startDate, "yyyyMMdd'T'HHmmss'Z'")}`);
    lines.push(`DTEND:${format(endDate, "yyyyMMdd'T'HHmmss'Z'")}`);
    lines.push(`DESCRIPTION:${event.description || ""}`);
    lines.push(`LOCATION:${event.location || ""}`);
    lines.push("END:VEVENT");
  });

  lines.push("END:VCALENDAR");

  return lines.join("\n");
}

export function downloadICS(events: any[], filename: string = "calendario.ics") {
  const content = generateICS(events);
  const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
