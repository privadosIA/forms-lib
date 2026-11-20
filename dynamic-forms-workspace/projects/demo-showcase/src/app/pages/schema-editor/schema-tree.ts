import { DfArray, DfFormSchema, DfGroup, DfNode, isDfArray, isDfGroup, isDfSlot, isDfTable } from '@core/dynamic-forms';

type Container = DfGroup | DfArray;

/** Grupos y listas contienen otros nodos. */
export const isContainer = (node: DfNode | undefined): node is Container => !!node && (isDfGroup(node) || isDfArray(node));

/** Nombre con el que se identifica un nodo: el id de un grupo o una tabla, el name de un slot, o la key de un campo o una lista. */
export const nodeName = (node: DfNode): string => (isDfGroup(node) || isDfTable(node) ? node.id : isDfSlot(node) ? node.name : node.key);

/** Posición de un nodo: índices desde schema.fields bajando por grupos y listas. [] es el formulario. */
export type NodePath = number[];

/** Nodo del árbol aplanado para pintarlo con sangría. */
export interface TreeRow {
  path: NodePath;
  node: DfNode;
  depth: number;
}

export const samePath = (a: NodePath | null, b: NodePath | null): boolean =>
  !!a && !!b && a.length === b.length && a.every((v, i) => v === b[i]);

export function getNode(schema: DfFormSchema, path: NodePath): DfNode | undefined {
  let nodes: DfNode[] | undefined = schema.fields;
  let node: DfNode | undefined;
  for (const i of path) {
    node = nodes?.[i];
    nodes = isContainer(node) ? node.fields : undefined;
  }
  return node;
}

export function flatten(schema: DfFormSchema): TreeRow[] {
  const rows: TreeRow[] = [];
  const walk = (nodes: DfNode[], parent: NodePath) =>
    (Array.isArray(nodes) ? nodes : []).forEach((node, i) => {
      const path = [...parent, i];
      rows.push({ path, node, depth: parent.length });
      if (isContainer(node)) walk(node.fields, path);
    });
  walk(schema.fields, []);
  return rows;
}

/** Copia el esquema y devuelve también el array que contiene al nodo de path (y su índice). */
function cloneAt(schema: DfFormSchema, path: NodePath): { copy: DfFormSchema; siblings: DfNode[]; index: number } {
  const copy = structuredClone(schema);
  let siblings = copy.fields;
  for (const i of path.slice(0, -1)) siblings = (siblings[i] as Container).fields;
  return { copy, siblings, index: path[path.length - 1] };
}

export function replaceNode(schema: DfFormSchema, path: NodePath, node: DfNode): DfFormSchema {
  const { copy, siblings, index } = cloneAt(schema, path);
  siblings[index] = node;
  return copy;
}

export function removeNode(schema: DfFormSchema, path: NodePath): DfFormSchema {
  const { copy, siblings, index } = cloneAt(schema, path);
  siblings.splice(index, 1);
  return copy;
}

/** Mueve un nodo dentro de su grupo o lista. Devuelve el esquema y la nueva ruta, o null si no se puede. */
export function moveNode(schema: DfFormSchema, path: NodePath, delta: -1 | 1): { schema: DfFormSchema; path: NodePath } | null {
  const { copy, siblings, index } = cloneAt(schema, path);
  const target = index + delta;
  if (target < 0 || target >= siblings.length) return null;
  [siblings[index], siblings[target]] = [siblings[target], siblings[index]];
  return { schema: copy, path: [...path.slice(0, -1), target] };
}

/**
 * Inserta un nodo: dentro del grupo o la lista seleccionados (al final), detrás del campo seleccionado o, sin
 * selección, al final del formulario. Devuelve el esquema y la ruta del nodo nuevo.
 */
export function insertNode(schema: DfFormSchema, selected: NodePath | null, node: DfNode): { schema: DfFormSchema; path: NodePath } {
  const copy = structuredClone(schema);
  const target = selected?.length ? getNode(copy, selected) : undefined;
  if (isContainer(target)) {
    target.fields.push(node);
    return { schema: copy, path: [...selected!, target.fields.length - 1] };
  }
  if (target && selected) {
    const parent = selected.slice(0, -1);
    const siblings = parent.length ? (getNode(copy, parent) as Container).fields : copy.fields;
    const index = selected[selected.length - 1] + 1;
    siblings.splice(index, 0, node);
    return { schema: copy, path: [...parent, index] };
  }
  copy.fields.push(node);
  return { schema: copy, path: [copy.fields.length - 1] };
}

/** Primer nombre libre con ese prefijo entre las keys e ids del esquema: campo1, campo2… */
export function freeName(schema: DfFormSchema, prefix: string): string {
  const used = new Set(flatten(schema).map(({ node }) => nodeName(node)));
  let n = 1;
  while (used.has(`${prefix}${n}`)) n++;
  return `${prefix}${n}`;
}
