import { validateContract } from '../contracts/validate.mjs';
import { digestObject, sha256Bytes } from './digest.mjs';
import { fail } from './errors.mjs';

const cssName = (name) => name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
const safeId = (value) => value.replace(/[^a-zA-Z0-9_-]/g, '-');

function assertBlueprint(blueprint) {
  const validation = validateContract('blueprint', blueprint);
  if (!validation.valid) fail('INVALID_BLUEPRINT', JSON.stringify(validation.errors));
  if (digestObject(blueprint) !== blueprint.digest) fail('BLUEPRINT_DIGEST_MISMATCH', 'Blueprint bytes do not match its digest');
  if (!blueprint.generationReady) fail('BLUEPRINT_NOT_READY', `Blueprint is blocked: ${blueprint.blockingIssues.join(', ')}`);
}

function safeCssValue(value) {
  const rendered = String(value);
  if (/url\s*\(|expression\s*\(|javascript\s*:|@import/i.test(rendered)) fail('UNSAFE_STYLE_VALUE', 'networked or executable CSS is forbidden');
  return rendered.replace(/[{};]/g, '');
}

function styleSheet(blueprint, replacements = {}) {
  const layouts = new Map(blueprint.layout.map((entry) => [entry.id, entry]));
  const styles = new Map(blueprint.styles.map((entry) => [entry.id, entry]));
  return blueprint.nodes.map((node) => {
    const declarations = [];
    const layout = layouts.get(node.layoutRef);
    const style = styles.get(node.styleRef);
    declarations.push(`display:${layout.display}`);
    for (const [property, value] of Object.entries(layout.values).sort(([a], [b]) => a.localeCompare(b))) {
      const normalized = cssName(property);
      declarations.push(`${normalized}:${replacements[`${layout.id}.${normalized}`] ? `var(${replacements[`${layout.id}.${normalized}`]})` : safeCssValue(value)}`);
    }
    for (const [property, value] of Object.entries(style.properties).sort(([a], [b]) => a.localeCompare(b))) {
      const normalized = cssName(property);
      declarations.push(`${normalized}:${replacements[`${style.id}.${normalized}`] ? `var(${replacements[`${style.id}.${normalized}`]})` : safeCssValue(value)}`);
    }
    return `.n-${safeId(node.id)}{${declarations.join(';')}}`;
  }).join('\n');
}

function componentModule(blueprint) {
  const portable = {
    rootId: blueprint.nodes.find((node) => node.parentId === null).id,
    nodes: blueprint.nodes.map(({ id, parentId, kind, children }) => ({ id, parentId, kind, children })),
    events: blueprint.events.map(({ id, trigger, targetNodeId, intent, fromState, toState }) => ({ id, trigger, targetNodeId, intent, fromState, toState })),
    initialState: blueprint.states[0]?.id ?? 'default',
  };
  return `const blueprint=${JSON.stringify(portable)};
const tags={container:'div',text:'span',control:'button',icon:'span',slot:'div'};
const handledEvents=new WeakSet();
function renderNode(id,onIntent){const node=blueprint.nodes.find((item)=>item.id===id);const element=document.createElement(tags[node.kind]||'div');element.className='n-'+node.id.replace(/[^a-zA-Z0-9_-]/g,'-');element.dataset.nodeId=node.id;const eventGroups=new Map();for(const event of blueprint.events.filter((item)=>item.targetNodeId===id)){const domEvent=event.trigger==='keyboard'?'keydown':event.trigger==='input'?'input':event.trigger==='click'?'click':event.trigger;const group=eventGroups.get(domEvent)||[];group.push(event);eventGroups.set(domEvent,group);}for(const [domEvent,events] of eventGroups){element.addEventListener(domEvent,(detail)=>{if(handledEvents.has(detail))return;const stateOwner=element.closest?.('[data-state]')||element;const event=events.find((item)=>item.fromState===stateOwner.dataset.state);if(!event)return;if(event.trigger==='keyboard'){if(detail.key!=='Enter'&&detail.key!==' ')return;detail.preventDefault();}handledEvents.add(detail);stateOwner.dataset.state=event.toState;onIntent?.(event.intent,{eventId:event.id,detail});});}for(const child of node.children)element.append(renderNode(child,onIntent));return element;}
export function mount(root,{onIntent}={}){const element=renderNode(blueprint.rootId,onIntent);element.dataset.state=blueprint.initialState;const domEvents=new Set(blueprint.events.map((event)=>event.trigger==='keyboard'?'keydown':event.trigger==='input'?'input':event.trigger==='click'?'click':event.trigger));for(const domEvent of domEvents)element.addEventListener(domEvent,(detail)=>handledEvents.delete(detail),true);root.replaceChildren(element);return element;}
export const definition=Object.freeze(blueprint);
`;
}

function assemble(blueprint, { assetId, variant, replacements = {}, parentArtifactRef, targetRef, mapping }) {
  const files = [
    { relativePath: 'index.html', content: '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><link rel="stylesheet" href="./styles.css"></head><body><main id="preview"></main><script type="module">import{mount}from"./component.js";mount(document.querySelector("#preview"),{onIntent:(intent)=>globalThis.dispatchEvent(new CustomEvent("distill-intent",{detail:{intent}}))});</script></body></html>' },
    { relativePath: 'styles.css', content: styleSheet(blueprint, replacements) },
    { relativePath: 'component.js', content: componentModule(blueprint) },
  ];
  const fileEntries = files.map((file) => ({ relativePath: file.relativePath, digest: sha256Bytes(Buffer.from(file.content)) }));
  const blueprintRef = { kind: 'blueprint', id: blueprint.blueprintId, revision: blueprint.revision, digest: blueprint.digest, relativePath: `blueprints/${blueprint.blueprintId}.json` };
  const assetPackage = {
    schemaVersion: '1.0.0', assetId, revision: 1, variant, level: blueprint.granularity === 'block' ? 'L3' : 'L2', deliveryStatus: 'preview-ready',
    files: fileEntries, exports: ['mount', 'definition'], dependencies: [], props: structuredClone(blueprint.props), states: blueprint.states.map((state) => state.id), intents: blueprint.events.map((event) => event.intent), rights: blueprint.rights, blueprintRef,
    ...(variant === 'adapted' ? { parentArtifactRef, targetRef, mapping } : {}),
  };
  const validation = validateContract('asset-package', assetPackage);
  if (!validation.valid) fail('INVALID_ASSET_PACKAGE', JSON.stringify(validation.errors));
  const bundle = { assetPackage, files, blueprint: structuredClone(blueprint), runtimeVerification: blueprint.runtimeVerification, runtimeEvidenceGaps: structuredClone(blueprint.runtimeEvidenceGaps) };
  bundle.bundleDigest = digestObject(bundle);
  return bundle;
}

export function generateSourceReplica(blueprint) {
  assertBlueprint(blueprint);
  return assemble(blueprint, { assetId: blueprint.blueprintId, variant: 'source-replica' });
}

export function generateAdaptedAsset(sourceBundle, mappingResult) {
  if (mappingResult.gaps.length) fail('UNSUPPORTED_TOKEN_MAPPING', JSON.stringify(mappingResult.gaps));
  if (!sourceBundle.blueprint) fail('MISSING_BLUEPRINT', 'adaptation bundle must retain its validated Blueprint input');
  assertBlueprint(sourceBundle.blueprint);
  return assemble(sourceBundle.blueprint, {
    assetId: `${sourceBundle.assetPackage.assetId}-daren`,
    variant: 'adapted',
    replacements: mappingResult.mapping,
    parentArtifactRef: { kind: 'asset-package', id: sourceBundle.assetPackage.assetId, revision: sourceBundle.assetPackage.revision, digest: sourceBundle.bundleDigest, relativePath: `assets/${sourceBundle.assetPackage.assetId}/asset-package.json` },
    targetRef: mappingResult.targetRef,
    mapping: mappingResult.mapping,
  });
}
