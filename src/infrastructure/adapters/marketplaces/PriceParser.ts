export function parsePrice(priceStr: string | null | undefined): number | null {
  if (!priceStr) return null;
  // Remove caracteres que não sejam dígitos, ponto ou vírgula
  let cleaned = priceStr.replace(/[^\d.,]/g, '').trim();
  if (!cleaned) return null;

  // Detecta se a vírgula é o separador decimal (Padrão brasileiro, ex: 1.249,90 ou 199,90)
  if (/,(\d{2})$/.test(cleaned)) {
    cleaned = cleaned.replace(/\./g, '').replace(',', '.');
  } 
  // Detecta se o ponto é o separador decimal (Padrão americano, ex: 1,249.90 ou 199.90)
  else if (/\.(\d{2})$/.test(cleaned)) {
    cleaned = cleaned.replace(/,/g, '');
  } 
  // Fallback genérico caso não termine em dois dígitos após o ponto ou vírgula
  else {
    cleaned = cleaned.replace(',', '.');
  }

  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? null : parsed;
}
