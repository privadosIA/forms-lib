import { Injectable, inject } from '@angular/core';
import { DfValidatorDefinition } from '../models/config.model';
import { DF_VALIDATORS } from '../tokens/dynamic-forms.tokens';

/**
 * Catálogo de validadores de negocio referenciables por alias desde el esquema.
 * Se alimenta de DF_VALIDATORS (multi) y admite registro en tiempo de ejecución.
 */
@Injectable({ providedIn: 'root' })
export class ValidatorRegistryService {
  private readonly registry = new Map<string, DfValidatorDefinition>();

  constructor() {
    const groups = inject(DF_VALIDATORS, { optional: true }) ?? [];
    groups.flat().forEach((def) => this.register(def));
  }

  register(definition: DfValidatorDefinition): void {
    if (!definition?.name) throw new Error('[dynamic-forms] Un validador necesita "name".');
    this.registry.set(definition.name, definition);
  }

  get(name: string): DfValidatorDefinition | undefined {
    return this.registry.get(name);
  }

  has(name: string): boolean {
    return this.registry.has(name);
  }

  names(): string[] {
    return [...this.registry.keys()];
  }
}
