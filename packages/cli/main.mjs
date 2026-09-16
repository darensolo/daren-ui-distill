#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import {
  assertRelativePath, auditAsset, buildBlueprint, captureSource, compileCapture, createDeliveryAuthorization, createJobStore,
  digestObject, DistillError, executeStages, generateAdaptedAsset, generateSourceReplica, mapBlueprintToDaren, materializeAsset, optimizeAssetWithJournal, projectBlueprintMarkdown, resolveAuthorizedPath, sha256Bytes,
  reconcileMaterialization, runAssetAdaptPipeline, runBlueprintAdaptPipeline, runBlueprintPipeline,
} from '../core/index.mjs';
import {
  publishLocalAsset, readLocalRegistrationReceipt, registerLocalAsset,
} from '../../adapters/local-folder/index.mjs';
import { parseArgs, resolveActionPlan } from './args.mjs';

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  if (chunks.length === 0) throw new DistillError('MISSING_INPUT', 'command requires JSON input');
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

async function readPayload(options) {
  if (!options.input) return readStdin();
  const file = await resolveAuthorizedPath(options.input, {
    baseDir: options.baseDir,
    roots: options.readRoots.length ? options.readRoots : [options.input],
  });
  return JSON.parse(await readFile(file, 'utf8'));
}

function bindCaptureAuthority(payload, options) {
  if (Object.hasOwn(payload, 'baseDir') || payload.scope?.readRoots !== undefined) {
    throw new DistillError('PAYLOAD_AUTHORITY_CONFLICT', 'capture payload cannot set baseDir or readRoots; CLI boundary options are authoritative');
  }
  if (options.readRoots.length === 0) throw new DistillError('MISSING_READ_ROOT', 'capture requires at least one --read-root');
  return { ...payload, baseDir: options.baseDir, scope: { readRoots: [...options.readRoots] } };
}

function jobStore(options) {
  if (!options.jobRoot || !options.jobId) throw new DistillError('MISSING_JOB', 'command requires --job-root and --job-id');
  assertRelativePath(options.jobRoot);
  return createJobStore(path.resolve(options.baseDir, options.jobRoot));
}

function pipelineInput(payload, inputKind) {
  return inputKind === 'blueprint' ? { blueprint: payload.blueprint ?? payload, targetRef: payload.targetRef }
    : inputKind === 'asset' ? { sourceBundle: payload.bundle ?? payload, targetRef: payload.targetRef }
      : inputKind === 'library-asset' ? { libraryAsset: payload }
        : { captureInput: payload, targetRef: payload.targetRef };
}

async function dissectInput(payload, inputKind, options) {
  const capture = inputKind === 'source'
    ? await captureSource(bindCaptureAuthority(payload.captureRequest ?? payload, options))
    : payload.capture ?? payload.bundle ?? payload;
  if (!capture) throw new DistillError('MISSING_CAPTURE', 'dissect requires a CaptureBundle or an authorized source capture request');
  const blueprint = buildBlueprint({ capture, proposal: payload.proposal, blueprintId: payload.blueprintId, revision: payload.revision, rights: payload.rights });
  return { capture, blueprint };
}

function stageResult(result, targetRoot, jobId, stage) {
  const bundle = result.bundle;
  const outputRefs = [{ kind: 'asset-package', id: bundle.assetPackage.assetId, revision: bundle.assetPackage.revision, digest: bundle.bundleDigest, relativePath: `${targetRoot}/asset-package.json` }];
  const reportRefs = result.report ? [{ kind: 'adaptation-report', id: `${bundle.assetPackage.assetId}-mapping`, revision: 1, digest: digestObject(result.report), relativePath: `${targetRoot}/adaptation-report.json` }] : [];
  const effectReceipts = [{ kind: 'materialization-receipt', id: `${jobId}-${stage}`, revision: 1, digest: digestObject(result.materialization), relativePath: `${targetRoot}/asset-package.json` }];
  return { status: 'succeeded', inputRefs: [], outputRefs, reportRefs, effectReceipts };
}

async function executeBoundPlan({ options, payload, plan, binding, store }) {
  const libraryRoot = binding.scope.libraryRoot ?? '.ui-distill/library';
  const siteRoot = binding.scope.siteRoot ?? '.ui-distill/site';
  const input = pipelineInput(payload, binding.request.inputKind);
  const artifacts = {};
  let dissected = null;
  const hasAdapt = plan.resolvedStages.includes('adapt');
  const blueprintFor = async () => {
    if (input.blueprint) return input.blueprint;
    if (input.sourceBundle?.blueprint) return input.sourceBundle.blueprint;
    if (dissected?.blueprint) return dissected.blueprint;
    try { return JSON.parse(await readFile(path.join(binding.scope.baseDir, binding.scope.outDir, 'blueprint/blueprint.json'), 'utf8')); }
    catch { dissected = await dissectInput(input.captureInput, binding.request.inputKind, options); return dissected.blueprint; }
  };
  const adaptedBundleFor = async () => {
    if (artifacts.adapted?.bundle) return artifacts.adapted.bundle;
    if (!plan.resolvedStages.includes('adapt')) return input.sourceBundle;
    const blueprint = await blueprintFor();
    const sourceBundle = input.sourceBundle ?? artifacts.source?.bundle ?? generateSourceReplica(blueprint);
    return generateAdaptedAsset(sourceBundle, mapBlueprintToDaren(sourceBundle.blueprint, { targetRef: input.targetRef }));
  };
  const registrationReceiptFor = async () => {
    if (artifacts.registration?.receipt) return artifacts.registration.receipt;
    if (input.libraryAsset?.registrationReceipt) return input.libraryAsset.registrationReceipt;
    if (input.libraryAsset?.registrationReceiptPath) return readLocalRegistrationReceipt({ baseDir: binding.scope.baseDir, libraryRoot, receiptPath: input.libraryAsset.registrationReceiptPath });
    const bundle = await adaptedBundleFor();
    if (!bundle) throw new DistillError('MISSING_REGISTRATION_RECEIPT', 'publish requires a registration receipt');
    return readLocalRegistrationReceipt({
      baseDir: binding.scope.baseDir,
      libraryRoot,
      receiptPath: `${libraryRoot}/assets/${bundle.assetPackage.assetId}/registration-receipt.json`,
    });
  };
  const describeBundle = (bundle, targetRoot, report = null) => {
    const files = [...bundle.files, { relativePath: 'asset-package.json', content: `${JSON.stringify(bundle.assetPackage, null, 2)}\n` }, ...(report ? [{ relativePath: 'adaptation-report.json', content: `${JSON.stringify(report, null, 2)}\n` }] : [])];
    const materialization = { status: 'succeeded', targetRoot, receipts: files.map((file) => ({ relativePath: file.relativePath, digest: sha256Bytes(Buffer.from(file.content)) })) };
    return { expectedFiles: Object.fromEntries(materialization.receipts.map((receipt) => [receipt.relativePath, receipt.digest])), result: stageResult({ bundle, materialization, ...(report ? { report } : {}) }, targetRoot, options.jobId, report ? 'adapt' : 'replicate') };
  };
  const expectedStage = async (stage, targetRoot) => {
    if (stage === 'dissect') {
      const blueprint = await blueprintFor();
      const content = `${JSON.stringify(blueprint, null, 2)}\n`;
      const materialization = { status: 'succeeded', targetRoot, receipts: [{ relativePath: 'blueprint.json', digest: sha256Bytes(Buffer.from(content)) }] };
      return { expectedFiles: { 'blueprint.json': materialization.receipts[0].digest }, result: { status: 'succeeded', inputRefs: [], outputRefs: [{ kind: 'blueprint', id: blueprint.blueprintId, revision: blueprint.revision, digest: blueprint.digest, relativePath: `${targetRoot}/blueprint.json` }], reportRefs: [], effectReceipts: [{ kind: 'materialization-receipt', id: `${options.jobId}-dissect`, revision: 1, digest: digestObject(materialization), relativePath: `${targetRoot}/blueprint.json` }] } };
    }
    const blueprint = await blueprintFor();
    const sourceBundle = input.sourceBundle ?? generateSourceReplica(blueprint);
    if (stage === 'replicate') return describeBundle(sourceBundle, targetRoot);
    const mapping = mapBlueprintToDaren(sourceBundle.blueprint, { targetRef: input.targetRef });
    const bundle = generateAdaptedAsset(sourceBundle, mapping);
    const report = { schemaVersion: '1.0.0', kind: 'adaptation-report', sourceDigest: sourceBundle.bundleDigest, adaptedDigest: bundle.bundleDigest, targetRef: input.targetRef, mapping: mapping.mapping, gaps: mapping.gaps };
    return describeBundle(bundle, targetRoot, report);
  };
  const handlers = {
    dissect: async () => {
      dissected = await dissectInput(input.captureInput, binding.request.inputKind, options);
      const targetRoot = `${binding.scope.outDir}/blueprint`;
      const materialization = await materializeAsset({ files: [{ relativePath: 'blueprint.json', content: `${JSON.stringify(dissected.blueprint, null, 2)}\n` }] }, { baseDir: binding.scope.baseDir, writeRoots: [targetRoot], targetRoot });
      artifacts.dissect = { ...dissected, materialization };
      const outputRefs = [{ kind: 'blueprint', id: dissected.blueprint.blueprintId, revision: dissected.blueprint.revision, digest: dissected.blueprint.digest, relativePath: `${targetRoot}/blueprint.json` }];
      return { status: 'succeeded', inputRefs: [], outputRefs, reportRefs: [], effectReceipts: [{ kind: 'materialization-receipt', id: `${options.jobId}-dissect`, revision: 1, digest: digestObject(materialization), relativePath: `${targetRoot}/blueprint.json` }] };
    },
    replicate: async () => {
      const targetRoot = hasAdapt ? `${binding.scope.outDir}/source-replica` : binding.scope.outDir;
      let blueprint = input.blueprint ?? dissected?.blueprint;
      if (!blueprint) blueprint = JSON.parse(await readFile(path.join(binding.scope.baseDir, binding.scope.outDir, 'blueprint/blueprint.json'), 'utf8'));
      artifacts.source = await runBlueprintPipeline({ blueprint, baseDir: binding.scope.baseDir, outDir: targetRoot });
      return stageResult(artifacts.source, targetRoot, options.jobId, 'replicate');
    },
    adapt: async () => {
      let blueprint = input.blueprint ?? dissected?.blueprint;
      if (!blueprint && !input.sourceBundle) blueprint = JSON.parse(await readFile(path.join(binding.scope.baseDir, binding.scope.outDir, 'blueprint/blueprint.json'), 'utf8'));
      const sourceBundle = input.sourceBundle ?? artifacts.source?.bundle ?? generateSourceReplica(blueprint);
      const targetRoot = binding.request.inputKind === 'asset' ? binding.scope.outDir : `${binding.scope.outDir}/adapted`;
      artifacts.adapted = await runAssetAdaptPipeline({ sourceBundle, baseDir: binding.scope.baseDir, outDir: targetRoot, targetRef: input.targetRef });
      return stageResult(artifacts.adapted, targetRoot, options.jobId, 'adapt');
    },
    register: async ({ operationId }) => {
      const bundle = await adaptedBundleFor();
      if (!bundle) throw new DistillError('MISSING_ASSET_PACKAGE', 'register requires an adapted AssetPackage bundle');
      artifacts.registration = await registerLocalAsset({
        bundle,
        approval: payload.registrationApproval,
        baseDir: binding.scope.baseDir,
        libraryRoot,
      });
      const receipt = artifacts.registration.receipt;
      const receiptRef = { kind: 'registration-receipt', id: receipt.assetRef.id, revision: receipt.assetRef.revision, digest: receipt.digest, relativePath: `${receipt.rollback.targetRoot}/registration-receipt.json` };
      return { status: 'succeeded', inputRefs: [receipt.sourceRef], outputRefs: [receipt.assetRef], reportRefs: [receiptRef], effectReceipts: [receiptRef] };
    },
    publish: async ({ operationId }) => {
      artifacts.publication = await publishLocalAsset({
        registrationReceipt: await registrationReceiptFor(),
        metadata: payload.publication ?? input.libraryAsset?.publication,
        approval: payload.publicationApproval,
        baseDir: binding.scope.baseDir,
        libraryRoot,
        siteRoot,
      });
      const receipt = artifacts.publication.receipt;
      const receiptRef = { kind: 'publication-receipt', id: receipt.assetRef.id, revision: receipt.assetRef.revision, digest: receipt.digest, relativePath: `${receipt.rollback.targetRoot}/publication-receipt.json` };
      return { status: 'succeeded', inputRefs: [receipt.registrationReceiptRef], outputRefs: [receipt.projectionRef], reportRefs: [receiptRef], effectReceipts: [receiptRef] };
    },
  };
  for (const [stage, targetRoot] of [
    ['dissect', `${binding.scope.outDir}/blueprint`],
    ['replicate', hasAdapt ? `${binding.scope.outDir}/source-replica` : binding.scope.outDir],
    ['adapt', binding.request.inputKind === 'asset' ? binding.scope.outDir : `${binding.scope.outDir}/adapted`],
  ]) {
    handlers[stage].reconcile = async () => {
      const expected = await expectedStage(stage, targetRoot);
      const result = await reconcileMaterialization({ baseDir: binding.scope.baseDir, writeRoots: [targetRoot], targetRoot, expectedFiles: expected.expectedFiles });
      return result.classification === 'committed' ? { status: 'committed', result: expected.result }
        : { status: result.classification === 'retry' ? 'retry' : 'conflict' };
    };
  }
  handlers.register.reconcile = async () => {
    const bundle = await adaptedBundleFor();
    const receiptPath = path.resolve(binding.scope.baseDir, libraryRoot, 'assets', bundle.assetPackage.assetId, 'registration-receipt.json');
    try { await readFile(receiptPath); } catch { return { status: 'retry' }; }
    return { status: 'committed', result: await handlers.register({ operationId: `${options.jobId}:register:reconcile` }) };
  };
  handlers.publish.reconcile = async () => {
    const registration = await registrationReceiptFor();
    const slug = registration.assetRef.id.replace(/^local\//, '');
    const receiptPath = path.resolve(binding.scope.baseDir, siteRoot, 'publications', slug, 'publication-receipt.json');
    try { await readFile(receiptPath); } catch { return { status: 'retry' }; }
    return { status: 'committed', result: await handlers.publish({ operationId: `${options.jobId}:publish:reconcile` }) };
  };
  const chain = await executeStages({ jobId: options.jobId, requestedActions: plan.requestedActions, resolvedStages: plan.resolvedStages, handlers, store, binding });
  return { chain, artifacts };
}

async function run() {
  const options = parseArgs(process.argv.slice(2));
  if (options.command === 'check') {
    const releaseUrls = [
      new URL('../../release.json', import.meta.url),
      new URL('../release.json', import.meta.url),
    ];
    let release;
    let lastError;
    for (const releaseUrl of releaseUrls) {
      try {
        release = JSON.parse(await readFile(releaseUrl, 'utf8'));
        break;
      } catch (error) {
        lastError = error;
      }
    }
    if (!release) throw lastError;
    process.stdout.write(`${JSON.stringify(release)}\n`);
    return;
  }
  if (options.command === 'run') {
    const plan = resolveActionPlan(options);
    if (!options.outDir) throw new DistillError('MISSING_OUT_DIR', 'run requires an explicit --out-dir');
    assertRelativePath(options.outDir);
    assertRelativePath(options.libraryRoot);
    assertRelativePath(options.siteRoot);
    const payload = await readPayload(options);
    const supported = JSON.stringify(plan.resolvedStages);
    if (!['["replicate"]', '["replicate","adapt"]', '["adapt"]', '["dissect","replicate"]', '["dissect","replicate","adapt"]'].includes(supported) && !(options.jobRoot && options.jobId)) throw new DistillError('UNSUPPORTED_PIPELINE', 'run stages are unsupported without a resumable job');
    if (options.jobRoot || options.jobId) {
      const store = jobStore(options);
      const inputDigest = digestObject(payload);
      const binding = { request: { command: 'run', requestedActions: plan.requestedActions, inputKind: options.inputKind }, inputDigest, resolvedStages: plan.resolvedStages, scope: { baseDir: path.resolve(options.baseDir), outDir: options.outDir, libraryRoot: options.libraryRoot, siteRoot: options.siteRoot }, checksetDigest: null };
      await store.create(options.jobId, { inputDigest, binding });
      const result = await executeBoundPlan({ options, payload, plan, binding, store });
      process.stdout.write(`${JSON.stringify({ plan, binding, ...result })}\n`);
      return;
    }
    const input = pipelineInput(payload, options.inputKind);
    let dissected = null;
    if (supported.startsWith('["dissect"')) dissected = await dissectInput(payload, options.inputKind, options);
    const blueprint = input.blueprint ?? dissected?.blueprint;
    const result = supported === '["replicate"]' || supported === '["dissect","replicate"]'
      ? await runBlueprintPipeline({ blueprint, baseDir: options.baseDir, outDir: options.outDir })
      : supported === '["replicate","adapt"]' || supported === '["dissect","replicate","adapt"]'
        ? await runBlueprintAdaptPipeline({ blueprint, baseDir: options.baseDir, outDir: options.outDir, targetRef: input.targetRef })
        : await runAssetAdaptPipeline({ sourceBundle: input.sourceBundle, baseDir: options.baseDir, outDir: options.outDir, targetRef: input.targetRef });
    process.stdout.write(`${JSON.stringify({ plan, ...(dissected ?? {}), ...result })}\n`);
    return;
  }
  const payload = await readPayload(options);
  if (options.command === 'capture') {
    process.stdout.write(`${JSON.stringify(await captureSource(bindCaptureAuthority(payload, options)))}\n`);
    return;
  }
  if (options.command === 'compile') {
    process.stdout.write(`${JSON.stringify(compileCapture(payload.capture, payload.proposal))}\n`);
    return;
  }
  if (options.command === 'audit') {
    process.stdout.write(`${JSON.stringify(auditAsset(payload))}\n`);
    return;
  }
  if (options.command === 'optimize') {
    const store = jobStore(options);
    if (!options.operationId) throw new DistillError('MISSING_OPERATION_ID', 'optimize requires --operation-id');
    const report = payload.report;
    const result = await optimizeAssetWithJournal({
      store, jobId: options.jobId, operationId: options.operationId, ...payload,
      reaudit: (candidate) => auditAsset({
        bundle: candidate, profile: report.profile, checksetDigest: report.checksetDigest,
        baselineContext: report.baselineContext, targetContext: report.targetContext,
        allowedDeltaContext: report.allowedDeltaContext, contextArtifacts: payload.contextArtifacts,
      }),
    });
    process.stdout.write(`${JSON.stringify(result)}\n`);
    return;
  }
  if (options.command === 'authorize') {
    const result = await createDeliveryAuthorization({ ...payload, baseDir: options.baseDir });
    process.stdout.write(`${JSON.stringify(result)}\n`);
    return;
  }
  if (options.command === 'resume') {
    if (!payload.binding || !payload.input) throw new DistillError('MISSING_JOB_BINDING', 'resume requires the original canonical binding and input');
    if (digestObject(payload.input) !== payload.binding.inputDigest) throw new DistillError('RESUME_DRIFT', 'resume input differs from the original input');
    if (path.resolve(options.baseDir) !== payload.binding.scope.baseDir) throw new DistillError('RESUME_DRIFT', 'resume base directory differs from the original scope');
    const originalLibraryRoot = payload.binding.scope.libraryRoot ?? '.ui-distill/library';
    const originalSiteRoot = payload.binding.scope.siteRoot ?? '.ui-distill/site';
    if (options.libraryRoot !== originalLibraryRoot || options.siteRoot !== originalSiteRoot) throw new DistillError('RESUME_DRIFT', 'resume adapter roots differ from the original scope');
    const plan = { requestedActions: payload.binding.request.requestedActions, resolvedStages: payload.binding.resolvedStages };
    const result = await executeBoundPlan({ options, payload: payload.input, plan, binding: payload.binding, store: jobStore(options) });
    process.stdout.write(`${JSON.stringify({ plan, binding: payload.binding, ...result })}\n`);
    return;
  }
  const blueprint = buildBlueprint(payload);
  process.stdout.write(`${JSON.stringify({ blueprint, projection: projectBlueprintMarkdown(blueprint) })}\n`);
}

run().catch((error) => {
  const safe = error instanceof DistillError
    ? error.toJSON()
    : { code: 'INVALID_INPUT', subjectRef: null, retryable: false, nextAction: 'review-input', message: error.message };
  process.stderr.write(`${JSON.stringify(safe)}\n`);
  process.exitCode = 1;
});
