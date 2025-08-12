#!/usr/bin/env node
/**
 * Stage utility — list, replace, rename, move
 *
 * Usage examples:
 *   node tools/stage.js list
 *   node tools/stage.js replace --stage "Animals on Greenland quiz" --wordwall "https://wordwall.net/es/embed/715cab19ab954ff9b976634871ca2182?themeId=4&templateId=70&fontStackId=0"
 *   node tools/stage.js replace --stage "Animals on Greenland quiz" --h5p "_tmp_speak"
 *   node tools/stage.js rename  --stage "Animals on Greenland quiz" --to "Speak the words — Greenland"
 *   node tools/stage.js move    --stage "Speak the words — Greenland" --x 36.2 --y 34.1
 *   node tools/stage.js replace --index 3 --wordwall <url>
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

// ---------- helpers ----------
const H5P_DIR = path.join("h5p-folder");
const CONTENT_JSON = path.join(H5P_DIR, "content", "content.json");
const H5P_JSON = path.join(H5P_DIR, "h5p.json");
const LIBS_DIR = path.join(H5P_DIR, "libraries");

function readText(p) {
  return fs.readFileSync(p, "utf8").replace(/^\uFEFF/, "");
}
function readJSON(p) {
  return JSON.parse(readText(p));
}
function writeJSON(p, obj) {
  fs.writeFileSync(p, JSON.stringify(obj, null, 2));
}
function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}
function uuid() {
  return crypto.randomUUID ? crypto.randomUUID() : (Date.now() + "-xxxx-xxxx").replace(/x/g, () => (Math.random() * 16 | 0).toString(16));
}

function getElements(root) {
  // GameMap stores stages under root.gamemapSteps.gamemap.elements
  const els = root?.gamemapSteps?.gamemap?.elements;
  if (!Array.isArray(els)) throw new Error("Couldn't find GameMap elements array in content.json");
  return els;
}

function stageByLabelOrIndex(root, opts) {
  const els = getElements(root);
  if (opts.index != null) {
    const idx = Number(opts.index) - 1; // 1-based external
    if (!(idx >= 0 && idx < els.length)) throw new Error(`Index ${opts.index} out of range (1..${els.length})`);
    return { stage: els[idx], index: idx };
  }
  const label = String(opts.stage || "");
  const idx = els.findIndex(e => (e && typeof e.label === "string" && e.label.trim() === label.trim()));
  if (idx === -1) throw new Error(`Stage '${label}' not found`);
  return { stage: els[idx], index: idx };
}

function currentLibraryString(stage) {
  const ct = stage?.contentsList?.[0]?.contentType;
  return ct && typeof ct.library === "string" ? ct.library : "(none)";
}

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const k = a.slice(2);
      const v = (i + 1 < argv.length && !argv[i + 1].startsWith("--")) ? argv[++i] : true;
      out[k] = v;
    } else {
      out._.push(a);
    }
  }
  return out;
}

function findInstalledVersion(machineName) {
  // search libraries folder for folder starting with machineName-
  const prefix = machineName + "-";
  if (!fs.existsSync(LIBS_DIR)) return null;
  const entries = fs.readdirSync(LIBS_DIR).filter(n => n.startsWith(prefix));
  if (!entries.length) return null;
  const lj = readJSON(path.join(LIBS_DIR, entries[0], "library.json"));
  return { folder: entries[0], major: Number(lj.majorVersion) || 0, minor: Number(lj.minorVersion) || 0 };
}

function ensureDependency(h5pJson, machineName, defMajor, defMinor) {
  if (!machineName) return;
  h5pJson.preloadedDependencies = h5pJson.preloadedDependencies || [];
  let dep = h5pJson.preloadedDependencies.find(d => d && d.machineName === machineName);
  if (!dep) {
    const info = findInstalledVersion(machineName);
    const major = info ? info.major : defMajor;
    const minor = info ? info.minor : defMinor;
    h5pJson.preloadedDependencies.push({ machineName, majorVersion: major, minorVersion: minor });
  } else {
    if (dep.majorVersion == null || dep.minorVersion == null) {
      const info = findInstalledVersion(machineName);
      dep.majorVersion = info ? info.major : defMajor;
      dep.minorVersion = info ? info.minor : defMinor;
    }
  }
}

function cleanPreloadedDeps(h5pJson) {
  if (!Array.isArray(h5pJson.preloadedDependencies)) return;
  h5pJson.preloadedDependencies = h5pJson.preloadedDependencies.filter(d => d && d.machineName && d.machineName.trim().length > 0 && d.majorVersion != null && d.minorVersion != null);
  // normalize number types
  for (const d of h5pJson.preloadedDependencies) {
    d.majorVersion = Number(d.majorVersion);
    d.minorVersion = Number(d.minorVersion);
  }
}

function copyAndFlattenLibraries(fromFolder) {
  // Accept either <from>/libraries/* or top-level library folders under <from>
  const roots = [];
  if (fs.existsSync(path.join(fromFolder, "libraries"))) roots.push(path.join(fromFolder, "libraries"));
  roots.push(fromFolder);

  ensureDir(LIBS_DIR);

  for (const root of roots) {
    if (!fs.existsSync(root)) continue;
    for (const name of fs.readdirSync(root)) {
      const src = path.join(root, name);
      if (!fs.statSync(src).isDirectory()) continue;
      const libJson = path.join(src, "library.json");
      if (!fs.existsSync(libJson)) continue; // not a library folder
      const dest = path.join(LIBS_DIR, name);
      // copy folder (merge/overwrite)
      copyDir(src, dest);
      // flatten nested duplicate folder (e.g., H5P.X-1.0/H5P.X-1.0/*)
      const nested = path.join(dest, name);
      if (fs.existsSync(path.join(nested, "library.json"))) {
        copyDir(nested, dest);
        rmrf(nested);
      }
    }
  }
}

function copyContentAssets(fromFolder) {
  const src = path.join(fromFolder, "content");
  if (!fs.existsSync(src)) return;
  const dst = path.join(H5P_DIR, "content");
  ensureDir(dst);
  for (const name of fs.readdirSync(src)) {
    if (name.toLowerCase() === "content.json") continue;
    copyDir(path.join(src, name), path.join(dst, name));
  }
}

function copyDir(src, dst) {
  ensureDir(dst);
  if (!fs.existsSync(src)) return;
  for (const entry of fs.readdirSync(src)) {
    const s = path.join(src, entry);
    const d = path.join(dst, entry);
    const st = fs.statSync(s);
    if (st.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}
function rmrf(pth) {
  if (!fs.existsSync(pth)) return;
  for (const n of fs.readdirSync(pth)) {
    const s = path.join(pth, n);
    const st = fs.statSync(s);
    if (st.isDirectory()) rmrf(s);
    else fs.unlinkSync(s);
  }
  fs.rmdirSync(pth);
}

// ---------- commands ----------
function cmdList() {
  const root = readJSON(CONTENT_JSON);
  const els = getElements(root);
  els.forEach((st, i) => {
    const lib = currentLibraryString(st);
    console.log(`${String(i + 1).padStart(2)}. ${st.label}  [${lib}]`);
  });
}

function cmdReplaceWordwall(opts) {
  const url = String(opts.wordwall || "").trim();
  if (!url) throw new Error("--wordwall <embedUrl> is required");
  const width = Number(opts.width || 500);
  const height = Number(opts.height || 380);
  const iframe = `<iframe style="max-width:100%" src="${url}" width="${width}" height="${height}" frameborder="0" allowfullscreen></iframe>`;

  const content = readJSON(CONTENT_JSON);
  const { stage } = stageByLabelOrIndex(content, opts);

  // determine AdvancedText version if installed
  const v = findInstalledVersion("H5P.AdvancedText") || { major: 1, minor: 1 };
  const libString = `H5P.AdvancedText ${v.major}.${v.minor}`;

  stage.contentsList = [{
    contentType: {
      library: libString,
      params: { text: iframe },
      metadata: { contentType: "Advanced text", license: "U", title: stage.label }
    }
  }];

  const h5p = readJSON(H5P_JSON);
  ensureDependency(h5p, "H5P.AdvancedText", 1, 1);
  cleanPreloadedDeps(h5p);

  writeJSON(CONTENT_JSON, content);
  writeJSON(H5P_JSON, h5p);
  console.log(`✅ Replaced stage '${stage.label}' with Wordwall embed using ${libString}`);
}

function cmdReplaceFromH5P(opts) {
  const src = String(opts.h5p || "").trim();
  if (!src) throw new Error("--h5p <folder> is required (unpacked .h5p)");
  if (!fs.existsSync(src)) throw new Error(`Folder not found: ${src}`);

  // import libs and assets
  copyAndFlattenLibraries(src);
  copyContentAssets(src);

  const content = readJSON(CONTENT_JSON);
  const { stage } = stageByLabelOrIndex(content, opts);

  // determine the main library string: read from src/h5p.json (mainLibrary) and use installed version
  let mainLib = null;
  try {
    const srcH5p = readJSON(path.join(src, "h5p.json"));
    mainLib = srcH5p.mainLibrary || null;
  } catch {}
  if (!mainLib) throw new Error("Could not determine mainLibrary from source h5p.json");
  const v = findInstalledVersion(mainLib);
  if (!v) throw new Error(`Library ${mainLib} not installed in ${LIBS_DIR}`);
  const libString = `${mainLib} ${v.major}.${v.minor}`;

  // load params from src/content/content.json
  const srcParamsPath = path.join(src, "content", "content.json");
  if (!fs.existsSync(srcParamsPath)) throw new Error(`Missing ${srcParamsPath}`);
  const params = readJSON(srcParamsPath);

  stage.contentsList = [{
    contentType: {
      library: libString,
      params: params,
      metadata: { title: stage.label, license: "U" },
      subContentId: uuid()
    }
  }];

  // ensure deps: the main lib + (optionally) the single-question lib if set variant
  const h5p = readJSON(H5P_JSON);
  ensureDependency(h5p, mainLib, v.major, v.minor);
  // common companion lib for SpeakTheWordsSet
  if (/H5P\.SpeakTheWordsSet/.test(mainLib)) {
    const sv = findInstalledVersion("H5P.SpeakTheWords");
    if (sv) ensureDependency(h5p, "H5P.SpeakTheWords", sv.major, sv.minor);
  }
  cleanPreloadedDeps(h5p);

  writeJSON(CONTENT_JSON, content);
  writeJSON(H5P_JSON, h5p);
  console.log(`✅ Replaced stage '${stage.label}' with ${libString} from ${src}`);
}

function cmdRename(opts) {
  if (!opts.stage && !opts.index) throw new Error("Provide --stage <label> or --index <n>");
  const to = String(opts.to || "").trim();
  if (!to) throw new Error("--to <new label> is required");
  const content = readJSON(CONTENT_JSON);
  const { stage } = stageByLabelOrIndex(content, opts);
  const old = stage.label;
  stage.label = to;
  // if metadata exists, mirror it
  const ct = stage?.contentsList?.[0]?.contentType;
  if (ct && ct.metadata) ct.metadata.title = to;
  writeJSON(CONTENT_JSON, content);
  console.log(`✅ Renamed stage '${old}' -> '${to}'`);
}

function cmdMove(opts) {
  if (!opts.stage && !opts.index) throw new Error("Provide --stage <label> or --index <n>");
  const x = opts.x != null ? String(opts.x) : null;
  const y = opts.y != null ? String(opts.y) : null;
  if (x == null || y == null) throw new Error("--x and --y are required (numbers)");
  const content = readJSON(CONTENT_JSON);
  const { stage } = stageByLabelOrIndex(content, opts);
  stage.telemetry = stage.telemetry || {};
  stage.telemetry.x = x; stage.telemetry.y = y;
  // preserve existing width/height
  if (!stage.telemetry.width) stage.telemetry.width = "4.375";
  if (!stage.telemetry.height) stage.telemetry.height = "7.777799959863713";
  writeJSON(CONTENT_JSON, content);
  console.log(`✅ Moved stage '${stage.label}' to x=${x}, y=${y}`);
}

function help() {
  console.log(`\nStage utility\n\nCommands:\n  list\n  replace --stage <label>|--index <n> --wordwall <embedUrl> [--width 500 --height 380]\n  replace --stage <label>|--index <n> --h5p <folder>\n  rename  --stage <label>|--index <n> --to <newLabel>\n  move    --stage <label>|--index <n> --x <num> --y <num>\n\nExamples:\n  node tools/stage.js list\n  node tools/stage.js replace --index 3 --wordwall "https://wordwall.net/es/embed/..."\n  node tools/stage.js replace --stage "Animals on Greenland quiz" --h5p "_tmp_speak"\n  node tools/stage.js rename  --stage "Old" --to "New"\n  node tools/stage.js move    --stage "New" --x 36.2 --y 34.1\n`);
}

// ---------- entry ----------
(function main(){
  try {
    if (!fs.existsSync(CONTENT_JSON)) throw new Error("Missing h5p-folder/content/content.json");
    const args = parseArgs(process.argv);
    const cmd = (args._[0] || "").toLowerCase();
    if (!cmd || cmd === "help" || cmd === "-h" || cmd === "--help") return help();

    switch (cmd) {
      case "list":
        return cmdList();
      case "replace":
        if (args.wordwall) return cmdReplaceWordwall(args);
        if (args.h5p) return cmdReplaceFromH5P(args);
        throw new Error("replace requires --wordwall <url> or --h5p <folder>");
      case "rename":
        return cmdRename(args);
      case "move":
        return cmdMove(args);
      default:
        return help();
    }
  } catch (err) {
    console.error("\u274C ", err.message || err);
    process.exit(1);
  }
})();
