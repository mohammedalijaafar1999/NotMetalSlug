// Imports every content module under src/content (enemies, bosses, vehicles, weapons, levels,
// themes, music, sfx, ui...). Each module registers itself on import. Order must not matter.
const modules = import.meta.glob(['./**/*.ts', '!./index.ts'], { eager: true });
export const contentModules = Object.keys(modules).sort();
