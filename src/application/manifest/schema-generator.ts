import type { ISchemaModelRepository } from '@/domain/ports/index.js';
import type { SchemaModelField } from '@/domain/models/index.js';
import { fitSections, type Section } from './token-budgeter.js';

const HEADER = '# Schema\n';

/**
 * Generate SCHEMA.md - data model definitions from schema/ORM frameworks.
 */
export function generateSchemaManifest(
  schemaModelRepo: ISchemaModelRepository,
  maxTokens: number,
): string {
  const allModels = schemaModelRepo.findAll();

  if (allModels.length === 0) {
    return fitSections(HEADER, [], maxTokens);
  }

  const sections: Section[] = [];

  for (const model of allModels) {
    const lines: string[] = [];
    lines.push(`## ${model.name} (${model.framework})`);

    if (model.tableName) {
      lines.push(`Table: ${model.tableName}`);
    }

    for (const field of model.fields) {
      lines.push(formatSchemaField(field));
    }

    lines.push('');
    sections.push({ content: lines.join('\n'), score: model.fields.length });
  }

  return fitSections(HEADER, sections, maxTokens);
}

function formatSchemaField(field: SchemaModelField): string {
  const flags: string[] = [];

  if (field.isPrimaryKey) flags.push('PK');
  if (field.isRequired) flags.push('required');
  if (field.isUnique) flags.push('unique');
  if (field.hasDefault) flags.push('default');
  if (field.relationTarget) flags.push(`\u2192 ${field.relationTarget}`);

  const flagStr = flags.length > 0 ? ` (${flags.join(', ')})` : '';

  return `- ${field.name}: ${field.fieldType}${flagStr}`;
}
