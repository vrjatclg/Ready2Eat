// utils.js
export const fmt = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

export function money(n) {
  return fmt.format(n || 0);
}

export function nowISO() {
  return new Date().toISOString();
}

export function uuid() {
  // RFC4122-ish
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c=>{
    const r = crypto.getRandomValues(new Uint8Array(1))[0] & 15;
    const v = c === "x" ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export function generatePaymentCode(existingSet) {
  // 3 blocks: ABC-1234-XYZ
  const letters = () => Array.from(crypto.getRandomValues(new Uint8Array(3))).map(v => String.fromCharCode(65 + (v % 26))).join("");
  const digits = () => Array.from(crypto.getRandomValues(new Uint8Array(4))).map(v => (v % 10)).join("");
  let code;
  do {
    code = `${letters()}-${digits()}-${letters()}`;
  } while (existingSet && existingSet.has(code));
  return code;
}

export async function sha256(str) {
  const enc = new TextEncoder().encode(str);
  const hash = await crypto.subtle.digest("SHA-256", enc);
  return [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, "0")).join("");
}

export function debounce(fn, ms=250){
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(()=>fn(...args), ms);
  };
}

export function sanitize(str) {
  return String(str || "").replace(/[<>&"']/g, s => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#39;'}[s]));
}

export function daysAgo(n){const d=new Date();d.setDate(d.getDate()-n);return d;}
export function hoursAgo(n){const d=new Date();d.setHours(d.getHours()-n);return d;}
