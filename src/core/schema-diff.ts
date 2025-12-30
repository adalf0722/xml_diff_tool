import type { XMLNode } from './xml-parser';
import type { DiffType } from './xml-diff';

const FIELD_ATTRS = ['type', 'size', 'defaultvalue'] as const;

export interface SchemaFieldDef {
  name: string;
  type?: string;
  size?: string;
  defaultvalue?: string;
}

export interface SchemaTableDef {
  name: string;
  fields: Map<string, SchemaFieldDef>;
}

export interface SchemaDiffChange {
  key: typeof FIELD_ATTRS[number];
  oldValue?: string;
  newValue?: string;
}

export interface SchemaDiffItem {
  id: string;
  kind: 'table' | 'field';
  type: DiffType;
  table: string;
  field?: string;
  fieldCount?: number;
  changes?: SchemaDiffChange[];
  fieldDef?: SchemaFieldDef;
}

export interface SchemaDiffStats {
  added: number;
  removed: number;
  modified: number;
  unchanged: number;
  total: number;
  tableAdded: number;
  tableRemoved: number;
  fieldAdded: number;
  fieldRemoved: number;
  fieldModified: number;
  fieldUnchanged: number;
}

export interface SchemaDiffResult {
  items: SchemaDiffItem[];
  stats: SchemaDiffStats;
}

function isElementNode(node: XMLNode): boolean {
  return node.nodeType === 'element';
}

function extractTables(root: XMLNode | null): Map<string, SchemaTableDef> {
  const tables = new Map<string, SchemaTableDef>();
  if (!root) return tables;

  const stack: XMLNode[] = [root];
  while (stack.length > 0) {
    const node = stack.pop()!;
    if (!isElementNode(node)) {
      continue;
    }

    if (node.name === 'macrosgroup') {
      continue;
    }

    if (node.name === 'struct') {
      const tableName = node.attributes.name;
      if (tableName && !tables.has(tableName)) {
        const fields = new Map<string, SchemaFieldDef>();
        for (const child of node.children) {
          if (!isElementNode(child) || child.name !== 'entry') continue;
          const fieldName = child.attributes.name;
          if (!fieldName || fields.has(fieldName)) continue;
          fields.set(fieldName, {
            name: fieldName,
            type: child.attributes.type,
            size: child.attributes.size,
            defaultvalue: child.attributes.defaultvalue,
          });
        }
        tables.set(tableName, { name: tableName, fields });
      }
    }

    for (const child of node.children) {
      stack.push(child);
    }
  }

  return tables;
}

function diffFieldAttributes(
  fieldA: SchemaFieldDef,
  fieldB: SchemaFieldDef
): SchemaDiffChange[] {
  const changes: SchemaDiffChange[] = [];
  for (const key of FIELD_ATTRS) {
    const oldValue = fieldA[key] ?? '';
    const newValue = fieldB[key] ?? '';
    if (oldValue !== newValue) {
      changes.push({ key, oldValue, newValue });
    }
  }
  return changes;
}

export function buildSchemaDiff(rootA: XMLNode | null, rootB: XMLNode | null): SchemaDiffResult {
  const tablesA = extractTables(rootA);
  const tablesB = extractTables(rootB);
  const items: SchemaDiffItem[] = [];
  const stats: SchemaDiffStats = {
    added: 0,
    removed: 0,
    modified: 0,
    unchanged: 0,
    total: 0,
    tableAdded: 0,
    tableRemoved: 0,
    fieldAdded: 0,
    fieldRemoved: 0,
    fieldModified: 0,
    fieldUnchanged: 0,
  };

  const tableNames = Array.from(new Set([...tablesA.keys(), ...tablesB.keys()])).sort((a, b) =>
    a.localeCompare(b)
  );

  for (const tableName of tableNames) {
    const tableA = tablesA.get(tableName);
    const tableB = tablesB.get(tableName);

    if (!tableA && tableB) {
      stats.added += 1;
      stats.tableAdded += 1;
      items.push({
        id: `table:added:${tableName}`,
        kind: 'table',
        type: 'added',
        table: tableName,
        fieldCount: tableB.fields.size,
      });
      continue;
    }

    if (tableA && !tableB) {
      stats.removed += 1;
      stats.tableRemoved += 1;
      items.push({
        id: `table:removed:${tableName}`,
        kind: 'table',
        type: 'removed',
        table: tableName,
        fieldCount: tableA.fields.size,
      });
      continue;
    }

    if (!tableA || !tableB) continue;

    const fieldNames = Array.from(
      new Set([...tableA.fields.keys(), ...tableB.fields.keys()])
    ).sort((a, b) => a.localeCompare(b));

    for (const fieldName of fieldNames) {
      const fieldA = tableA.fields.get(fieldName);
      const fieldB = tableB.fields.get(fieldName);

      if (!fieldA && fieldB) {
        stats.added += 1;
        stats.fieldAdded += 1;
        items.push({
          id: `field:added:${tableName}:${fieldName}`,
          kind: 'field',
          type: 'added',
          table: tableName,
          field: fieldName,
          fieldDef: fieldB,
        });
        continue;
      }

      if (fieldA && !fieldB) {
        stats.removed += 1;
        stats.fieldRemoved += 1;
        items.push({
          id: `field:removed:${tableName}:${fieldName}`,
          kind: 'field',
          type: 'removed',
          table: tableName,
          field: fieldName,
          fieldDef: fieldA,
        });
        continue;
      }

      if (!fieldA || !fieldB) continue;
      const changes = diffFieldAttributes(fieldA, fieldB);
      if (changes.length > 0) {
        stats.modified += 1;
        stats.fieldModified += 1;
        items.push({
          id: `field:modified:${tableName}:${fieldName}`,
          kind: 'field',
          type: 'modified',
          table: tableName,
          field: fieldName,
          changes,
          fieldDef: fieldB,
        });
      } else {
        stats.unchanged += 1;
        stats.fieldUnchanged += 1;
      }
    }
  }

  stats.total = stats.added + stats.removed + stats.modified + stats.unchanged;

  return { items, stats };
}
