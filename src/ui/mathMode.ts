/**
 * "Show the cryptography" (PRD R11) as a module-level flag, so the pure
 * formatting helpers (panelFacts, format) can consult it without threading a
 * prop through components owned by other work. App sets it on every render.
 */
let on = false;

export const mathMode = {
  get(): boolean { return on; },
  set(next: boolean): void { on = next; },
};
