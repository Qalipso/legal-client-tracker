// Vitest's jsdom environment only copies window properties that don't
// already exist on globalThis. Node 22+ ships an inert native `localStorage`
// global, so without disabling it (see the `test` script's NODE_OPTIONS)
// jsdom's real implementation never gets copied over and stays undefined.
export {};
