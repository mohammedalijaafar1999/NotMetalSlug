// Startup hooks: content modules push functions here; main.ts runs them after the default
// scene flow is installed (so UI modules can replace flow.title etc).
export const startupHooks: (() => void)[] = [];
