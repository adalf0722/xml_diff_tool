import type { XMLNode } from './xml-parser';
import type { DiffType } from './xml-diff';

export type SchemaPresetId = 'struct' | 'xsd' | 'table' | 'custom';

export interface SchemaExtractConfig {
  tableTags: string[];
  fieldTags: string[];
  tableNameAttrs: string[];
  fieldNameAttrs: string[];
  ignoreNodes: string[];
  ignoreNamespaces?: boolean;
  caseSensitiveNames?: boolean;
  fieldSearchMode?: 'children' | 'descendants';
}

const FIELD_ATTRS = ['type', 'size', 'defaultvalue'] as const;

export const DEFAULT_SCHEMA_PRESET_ID: SchemaPresetId = 'struct';

const DEFAULT_SCHEMA_CONFIG: SchemaExtractConfig = {
  tableTags: ['struct'],
  fieldTags: ['entry'],
  tableNameAttrs: ['name'],
  fieldNameAttrs: ['name'],
  ignoreNodes: ['macrosgroup'],
  ignoreNamespaces: false,
  caseSensitiveNames: true,
  fieldSearchMode: 'children',
};

export const SCHEMA_PRESETS: Record<SchemaPresetId, SchemaExtractConfig> = {
  struct: DEFAULT_SCHEMA_CONFIG,
  xsd: {
    tableTags: ['complexType'],
    fieldTags: ['element', 'attribute'],
    tableNameAttrs: ['name'],
    fieldNameAttrs: ['name'],
    ignoreNodes: ['annotation', 'documentation'],
    ignoreNamespaces: true,
    caseSensitiveNames: true,
    fieldSearchMode: 'descendants',
  },
  table: {
    tableTags: ['table', 'entity'],
    fieldTags: ['column', 'field'],
    tableNameAttrs: ['name', 'id', 'table'],
    fieldNameAttrs: ['name', 'column', 'field'],
    ignoreNodes: [],
    ignoreNamespaces: false,
    caseSensitiveNames: true,
    fieldSearchMode: 'children',
  },
  custom: DEFAULT_SCHEMA_CONFIG,
};

export function getSchemaPresetConfig(presetId: SchemaPresetId): SchemaExtractConfig {
  const preset = SCHEMA_PRESETS[presetId] ?? DEFAULT_SCHEMA_CONFIG;
  return {
    ...preset,
    tableTags: [...preset.tableTags],
    fieldTags: [...preset.fieldTags],
    tableNameAttrs: [...preset.tableNameAttrs],
    fieldNameAttrs: [...preset.fieldNameAttrs],
    ignoreNodes: [...preset.ignoreNodes],
  };
}

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

function normalizeTagKey(name: string, ignoreNamespaces: boolean): string {
  const trimmed = name.trim();
  const base = ignoreNamespaces ? trimmed.split(':').pop() || trimmed : trimmed;
  return base.toLowerCase();
}

function pickAttributeValue(attributes: Record<string, string>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = attributes[key];
    if (value !== undefined && value !== '') return value;
  }
  const lowerCaseMap = new Map(
    Object.entries(attributes).map(([key, value]) => [key.toLowerCase(), value])
  );
  for (const key of keys) {
    const value = lowerCaseMap.get(key.toLowerCase());
    if (value !== undefined && value !== '') return value;
  }
  return undefined;
}

function normalizeSchemaKey(name: string, caseSensitive: boolean): string {
  const trimmed = name.trim();
  return caseSensitive ? trimmed : trimmed.toLowerCase();
}

function extractTables(
  root: XMLNode | null,
  config: SchemaExtractConfig
): Map<string, SchemaTableDef> {
  const tables = new Map<string, SchemaTableDef>();
  if (!root) return tables;

  const ignoreNamespaces = config.ignoreNamespaces ?? false;
  const caseSensitiveNames = config.caseSensitiveNames ?? true;
  const fieldSearchMode = config.fieldSearchMode ?? 'children';
  const tableTagSet = new Set(
    config.tableTags.map(tag => normalizeTagKey(tag, ignoreNamespaces))
  );
  const fieldTagSet = new Set(
    config.fieldTags.map(tag => normalizeTagKey(tag, ignoreNamespaces))
  );
  const ignoreNodeSet = new Set(
    config.ignoreNodes.map(tag => normalizeTagKey(tag, ignoreNamespaces))
  );

  const getTableName = (node: XMLNode) =>
    pickAttributeValue(node.attributes, config.tableNameAttrs);
  const getFieldName = (node: XMLNode) =>
    pickAttributeValue(node.attributes, config.fieldNameAttrs);

  const collectFields = (tableNode: XMLNode) => {
    const fields = new Map<string, SchemaFieldDef>();
    if (!tableNode.children.length) return fields;

    if (fieldSearchMode === 'children') {
      for (const child of tableNode.children) {
        if (!isElementNode(child)) continue;
        const tagKey = normalizeTagKey(child.name, ignoreNamespaces);
        if (ignoreNodeSet.has(tagKey)) continue;
        if (!fieldTagSet.has(tagKey)) continue;
        const fieldName = getFieldName(child);
        if (!fieldName) continue;
        const displayName = fieldName.trim();
        if (!displayName) continue;
        const fieldKey = normalizeSchemaKey(displayName, caseSensitiveNames);
        if (fields.has(fieldKey)) continue;
        fields.set(fieldKey, {
          name: displayName,
          type: child.attributes.type,
          size: child.attributes.size,
          defaultvalue: child.attributes.defaultvalue,
        });
      }
      return fields;
    }

    const stack = [...tableNode.children];
    while (stack.length > 0) {
      const node = stack.pop()!;
      if (!isElementNode(node)) continue;
      const tagKey = normalizeTagKey(node.name, ignoreNamespaces);
      if (ignoreNodeSet.has(tagKey)) continue;
      if (tableTagSet.has(tagKey)) {
        continue;
      }
      if (fieldTagSet.has(tagKey)) {
        const fieldName = getFieldName(node);
        if (fieldName) {
          const displayName = fieldName.trim();
          if (displayName) {
            const fieldKey = normalizeSchemaKey(displayName, caseSensitiveNames);
            if (!fields.has(fieldKey)) {
              fields.set(fieldKey, {
                name: displayName,
                type: node.attributes.type,
                size: node.attributes.size,
                defaultvalue: node.attributes.defaultvalue,
              });
            }
          }
        }
      }
      for (const child of node.children) {
        stack.push(child);
      }
    }
    return fields;
  };

  const stack: XMLNode[] = [root];
  while (stack.length > 0) {
    const node = stack.pop()!;
    if (!isElementNode(node)) {
      continue;
    }

    const tagKey = normalizeTagKey(node.name, ignoreNamespaces);
    if (ignoreNodeSet.has(tagKey)) {
      continue;
    }

    if (tableTagSet.has(tagKey)) {
      const tableName = getTableName(node);
      if (tableName) {
        const displayName = tableName.trim();
        if (displayName) {
          const tableKey = normalizeSchemaKey(displayName, caseSensitiveNames);
          const fields = collectFields(node);
          if (!tables.has(tableKey)) {
            tables.set(tableKey, { name: displayName, fields });
          } else {
            const existing = tables.get(tableKey)!;
            for (const [fieldKey, fieldDef] of fields) {
              if (!existing.fields.has(fieldKey)) {
                existing.fields.set(fieldKey, fieldDef);
              }
            }
          }
        }
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

export function buildSchemaDiff(
  rootA: XMLNode | null,
  rootB: XMLNode | null,
  config: SchemaExtractConfig = getSchemaPresetConfig(DEFAULT_SCHEMA_PRESET_ID)
): SchemaDiffResult {
  const tablesA = extractTables(rootA, config);
  const tablesB = extractTables(rootB, config);
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

  const tableKeys = Array.from(new Set([...tablesA.keys(), ...tablesB.keys()])).sort((a, b) =>
    a.localeCompare(b)
  );

  for (const tableKey of tableKeys) {
    const tableA = tablesA.get(tableKey);
    const tableB = tablesB.get(tableKey);
    const tableName = tableA?.name ?? tableB?.name ?? tableKey;

    if (!tableA && tableB) {
      stats.added += 1;
      stats.tableAdded += 1;
      items.push({
        id: `table:added:${tableKey}`,
        kind: 'table',
        type: 'added',
        table: tableName,
        fieldCount: tableB.fields.size,
      });
      for (const [fieldKey, fieldDef] of tableB.fields) {
        stats.added += 1;
        stats.fieldAdded += 1;
        items.push({
          id: `field:added:${tableKey}:${fieldKey}`,
          kind: 'field',
          type: 'added',
          table: tableName,
          field: fieldDef.name,
          fieldDef,
        });
      }
      continue;
    }

    if (tableA && !tableB) {
      stats.removed += 1;
      stats.tableRemoved += 1;
      items.push({
        id: `table:removed:${tableKey}`,
        kind: 'table',
        type: 'removed',
        table: tableName,
        fieldCount: tableA.fields.size,
      });
      for (const [fieldKey, fieldDef] of tableA.fields) {
        stats.removed += 1;
        stats.fieldRemoved += 1;
        items.push({
          id: `field:removed:${tableKey}:${fieldKey}`,
          kind: 'field',
          type: 'removed',
          table: tableName,
          field: fieldDef.name,
          fieldDef,
        });
      }
      continue;
    }

    if (!tableA || !tableB) continue;

    const fieldKeys = Array.from(
      new Set([...tableA.fields.keys(), ...tableB.fields.keys()])
    ).sort((a, b) => a.localeCompare(b));

    for (const fieldKey of fieldKeys) {
      const fieldA = tableA.fields.get(fieldKey);
      const fieldB = tableB.fields.get(fieldKey);
      const fieldName = fieldA?.name ?? fieldB?.name ?? fieldKey;

      if (!fieldA && fieldB) {
        stats.added += 1;
        stats.fieldAdded += 1;
        items.push({
          id: `field:added:${tableKey}:${fieldKey}`,
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
          id: `field:removed:${tableKey}:${fieldKey}`,
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
          id: `field:modified:${tableKey}:${fieldKey}`,
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
