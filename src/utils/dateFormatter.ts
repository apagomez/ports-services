/**
 * Helper to standardise any date input (String, Date object, or numeric timestamp)
 * into the required "DD-MMM-YY" format (e.g. "02-Jan-25", "29-Dec-26").
 */
export function formatSystemDate(dateInput: any): string {
  if (!dateInput) return '-';
  
  let date: Date;
  
  if (dateInput instanceof Date) {
    date = dateInput;
  } else if (typeof dateInput === 'number') {
    date = new Date(dateInput);
  } else if (typeof dateInput === 'string') {
    const trimmed = dateInput.trim();
    if (!trimmed || trimmed === '-' || trimmed.toLowerCase() === 'n/a' || trimmed.toLowerCase() === 'undefined' || trimmed.toLowerCase() === 'null') {
      return trimmed || '-';
    }
    
    // Attempt standard split parsing if form matches 'D-MMM-YYYY' or similar
    // to preserve month representations
    const parts = trimmed.split('-');
    if (parts.length === 3) {
      const dayStr = parts[0];
      const monthStr = parts[1]; // Jan, Feb, etc.
      const yearStr = parts[2];
      
      const dayNum = parseInt(dayStr, 10);
      const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
      const monthIndex = months.indexOf(monthStr.toLowerCase().slice(0, 3));
      
      if (!isNaN(dayNum) && monthIndex !== -1) {
        let yearNum = parseInt(yearStr, 10);
        if (yearStr.length === 4) {
          yearNum = yearNum % 100; // Keep last 2 digits
        }
        const formattedDay = dayNum < 10 ? `0${dayNum}` : `${dayNum}`;
        const formattedMonth = monthStr.charAt(0).toUpperCase() + monthStr.slice(1, 3).toLowerCase();
        const formattedYear = yearNum < 10 ? `0${yearNum}` : `${yearNum}`;
        return `${formattedDay}-${formattedMonth}-${formattedYear}`;
      }
    }

    // Try parsing with standard JS Date constructor
    const parsed = new Date(trimmed);
    if (!isNaN(parsed.getTime())) {
      date = parsed;
    } else {
      // In case standard parse fails, see if it is in format DD/MM/YYYY or MM/DD/YYYY
      const slashParts = trimmed.split('/');
      if (slashParts.length === 3) {
        const p1 = parseInt(slashParts[0], 10);
        const p2 = parseInt(slashParts[1], 10);
        const p3 = parseInt(slashParts[2], 10);
        if (!isNaN(p1) && !isNaN(p2) && !isNaN(p3)) {
          // Default to assume MM/DD/YYYY, or DD/MM/YYYY
          // Let's build a standard Date
          const month = p1 <= 12 ? p1 - 1 : p2 - 1;
          const day = p1 <= 12 ? p2 : p1;
          const year = p3 < 100 ? (p3 < 50 ? 2000 + p3 : 1900 + p3) : p3;
          const customParsed = new Date(year, month, day);
          if (!isNaN(customParsed.getTime())) {
            date = customParsed;
          } else {
            return trimmed;
          }
        } else {
          return trimmed;
        }
      } else {
        return trimmed;
      }
    }
  } else {
    return '-';
  }

  // Format valid Date object to DD-MMM-YY
  const day = date.getDate();
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const month = months[date.getMonth()];
  const year = date.getFullYear() % 100;

  const formattedDay = day < 10 ? `0${day}` : `${day}`;
  const formattedYear = year < 10 ? `0${year}` : `${year}`;
  
  return `${formattedDay}-${month}-${formattedYear}`;
}

/**
 * Returns hours and minutes for a date input if relevant, e.g. "14:55"
 */
export function formatSystemTime(dateInput: any): string {
  if (!dateInput) return '-';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
}

/**
 * Returns formatted date and time, e.g. "26-Jun-26 01:09 PM"
 */
export function formatSystemDateTime(dateInput: any): string {
  if (!dateInput) return '-';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) {
    // If it's already some pre-formatted string, return it as is or try standard split
    return String(dateInput);
  }
  const formattedDate = formatSystemDate(d);
  const formattedTime = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  return `${formattedDate} at ${formattedTime}`;
}

