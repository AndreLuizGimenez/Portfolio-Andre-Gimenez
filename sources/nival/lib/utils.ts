/* Os adaptadores recebem apenas classes de base e nomes CSS do site.
 * Não há utilitários conflitantes ou objetos condicionais nesses consumidores. */
export function cn(...inputs: (string | undefined)[]): string {
  return inputs.filter(Boolean).join(" ");
}
