import { validateContract } from '../contracts/validate.mjs';
import { fail } from './errors.mjs';

const propertyTokens = new Map([
  ['color', '--color-foreground'],
  ['background', '--color-background'],
  ['background-color', '--color-background'],
  ['border-color', '--color-border-default'],
  ['border-radius', '--radius-md'],
  ['outline-color', '--color-focus-ring'],
  ['gap', '--space-100'],
  ['padding', '--space-300'],
  ['font-size', '--text-ui-body-default'],
  ['line-height', '--leading-ui-body-default'],
]);

const cssName = (name) => name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);

export function mapBlueprintToDaren(blueprint, { targetRef }) {
  const validation = validateContract('blueprint', blueprint);
  if (!validation.valid) fail('INVALID_BLUEPRINT', JSON.stringify(validation.errors));
  if (!targetRef) fail('MISSING_TARGET', 'Daren adaptation requires a versioned target token reference');
  const mapping = {};
  const gaps = [];
  for (const style of blueprint.styles) {
    for (const property of Object.keys(style.properties).sort()) {
      const normalized = cssName(property);
      const token = propertyTokens.get(normalized);
      if (token) mapping[`${style.id}.${normalized}`] = token;
      else gaps.push({ code: 'UNSUPPORTED_TOKEN_MAPPING', styleId: style.id, property });
    }
  }
  for (const layout of blueprint.layout) {
    for (const property of Object.keys(layout.values).sort()) {
      const normalized = cssName(property);
      const token = propertyTokens.get(normalized);
      if (token) mapping[`${layout.id}.${normalized}`] = token;
      else if (!['display', 'width', 'height', 'min-width', 'max-width'].includes(normalized)) {
        gaps.push({ code: 'UNSUPPORTED_TOKEN_MAPPING', styleId: layout.id, property });
      }
    }
  }
  return { targetRef: structuredClone(targetRef), mapping, gaps };
}
