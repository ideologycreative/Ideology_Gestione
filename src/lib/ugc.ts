export const UGC_STATI: { id: string; label: string; hint: string }[] = [
  { id: 'raccolto', label: 'Raccolto', hint: 'Contenuto ricevuto dal creator' },
  { id: 'selezionato', label: 'Selezionato', hint: 'Scelto tra i contenuti ricevuti' },
  { id: 'adattato', label: 'Adattato', hint: 'Adattato al formato del cliente' },
  { id: 'approvato', label: 'Approvato', hint: 'Pronto a uscire' },
  { id: 'autonoma', label: 'Autonoma', hint: "Il creator pubblica sul proprio profilo" },
];

/** Ported from legacy client portal's COLORS map — used only by the UGC chip in the client-facing panel. */
export const UGC_STATO_COLOR: Record<string, string> = {
  raccolto: 'var(--text-3)',
  selezionato: 'var(--info-text)',
  adattato: 'var(--warning-text)',
  approvato: 'var(--accent)',
  autonoma: 'var(--rule-2)',
};
