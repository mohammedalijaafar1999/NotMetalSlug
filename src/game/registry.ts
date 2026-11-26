// Entity type registry: content modules register factories by type name so levels can
// spawn them from data ({ type: 'rifleman', x: 640 }).

import type { Entity } from './entity';
import type { World } from './world';

export interface SpawnSpec {
  /** Registered entity type name. */
  type: string;
  /** World x (for 'bottom' anchored entities: feet x). */
  x: number;
  /** World y (feet). If omitted, placed on the top-most floor at x. */
  y?: number;
  /** Spawn when the camera's RIGHT edge reaches this x (default: x - 8). Only for LevelDef.entities. */
  trigger?: number;
  /** Type-specific options (facing, behaviour variants, drops...). */
  props?: Record<string, any>;
}

export type EntityCategory = 'enemy' | 'boss' | 'vehicle' | 'pickup' | 'prop' | 'hostage' | 'hazard' | 'misc';

export interface EntityTypeInfo {
  type: string;
  category: EntityCategory;
  description: string;
  create: (world: World, spec: SpawnSpec) => Entity;
}

const types = new Map<string, EntityTypeInfo>();

/**
 * Register an entity type.
 *   registerEntity('rifleman', 'enemy', (w, s) => new Rifleman(s), 'Basic soldier with a rifle');
 * The factory receives the spawn spec; position (x, y) and props are applied by world.spawn()
 * after construction, so constructors don't need to handle them (but may read spec.props).
 */
export function registerEntity(type: string, category: EntityCategory, create: (world: World, spec: SpawnSpec) => Entity, description = ''): void {
  types.set(type, { type, category, create, description });
}

export function getEntityType(type: string): EntityTypeInfo | undefined {
  return types.get(type);
}

export function entityTypes(category?: EntityCategory): EntityTypeInfo[] {
  return [...types.values()].filter((t) => !category || t.category === category);
}
