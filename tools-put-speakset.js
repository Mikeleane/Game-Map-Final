const fs = require("fs"), p = require("path"), crypto = require("crypto");

// Helpers
const readJSON = f => JSON.parse(fs.readFileSync(f,"utf8").replace(/^\uFEFF/,""));
const writeJSON = (f, o) => fs.writeFileSync(f, JSON.stringify(o, null, 2));
const libDir = p.join("h5p-folder","libraries");
const contentDir = p.join("h5p-folder","content");
const stageLabel = "Animals on Greenland quiz";

// 1) Load current gamemap content
const contentPath = p.join(contentDir, "content.json");
const root = readJSON(contentPath);

// find the target stage
const stage = root?.gamemapSteps?.gamemap?.elements?.find(e => e.label === stageLabel);
if (!stage) { throw new Error(`Stage "${stageLabel}" not found`); }

// 2) Pull Speak-the-Words Set params from your export
const tmp = "_tmp_speak";
const tmpContentPath = p.join(tmp, "content", "content.json");
const tmpH5PPath     = p.join(tmp, "h5p.json");
if (!fs.existsSync(tmpContentPath) || !fs.existsSync(tmpH5PPath)) {
  throw new Error("Could not find _tmp_speak/content/content.json or _tmp_speak/h5p.json");
}
const speakParams = readJSON(tmpContentPath);
const tmpH5P = readJSON(tmpH5PPath);
const mainLib = tmpH5P.mainLibrary; // expect "H5P.SpeakTheWordsSet"

// 3) Determine exact version installed locally for mainLib and the single-item lib
function getLibVersion(machineName){
  // Find a folder like H5P.Something-1.2 and read its library.json
  const prefix = machineName + "-";
  const entries = fs.readdirSync(libDir).filter(n => n.startsWith(prefix));
  if (!entries.length) return null;
  const libJson = p.join(libDir, entries[0], "library.json");
  const lj = readJSON(libJson);
  return { major: Number(lj.majorVersion)||0, minor: Number(lj.minorVersion)||0, folder: entries[0] };
}

const setInfo  = getLibVersion("H5P.SpeakTheWordsSet");
const itemInfo = getLibVersion("H5P.SpeakTheWords");
if (!setInfo) throw new Error("H5P.SpeakTheWordsSet library not found under h5p-folder/libraries");

// 4) Copy any assets used by the speak set from _tmp_speak/content/** into h5p-folder/content/**
function copyDir(src, dst){
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dst, { recursive: true });
  for (const name of fs.readdirSync(src)){
    const s = p.join(src, name), d = p.join(dst, name);
    const stat = fs.statSync(s);
    if (stat.isDirectory()) copyDir(s,d);
    else fs.copyFileSync(s,d);
  }
}
// Copy everything except content.json (we already read it)
const tmpContentDir = p.join(tmp, "content");
for (const name of fs.readdirSync(tmpContentDir)){
  if (name.toLowerCase() === "content.json") continue;
  copyDir(p.join(tmpContentDir, name), p.join(contentDir, name));
}

// 5) Build the subcontent entry for the stage
const libString = `${mainLib} ${setInfo.major}.${setInfo.minor}`;
const subId = (crypto.randomUUID ? crypto.randomUUID() : (Date.now()+"-xxxx-xxxx").replace(/x/g,()=>Math.floor(Math.random()*16).toString(16)));

const entry = {
  contentType: {
    library: libString,
    params: speakParams,
    metadata: { title: "Speak the Words Set", license: "U" },
    subContentId: subId
  }
};

// Replace stage payload
stage.contentsList = [entry];

// 6) Ensure dependencies in h5p.json include the set (and single item lib if present)
const h5pPath = p.join("h5p-folder","h5p.json");
const h5p = readJSON(h5pPath);
h5p.preloadedDependencies = h5p.preloadedDependencies || [];

function ensureDep(name, info){
  if (!info) return;
  const exists = h5p.preloadedDependencies.some(d => d && d.machineName === name);
  if (!exists) h5p.preloadedDependencies.push({ machineName: name, majorVersion: info.major, minorVersion: info.minor });
}
ensureDep("H5P.SpeakTheWordsSet", setInfo);
ensureDep("H5P.SpeakTheWords",    itemInfo);

// 7) Save
writeJSON(contentPath, root);
writeJSON(h5pPath, h5p);

console.log("✅ Inserted Speak-the-Words Set into stage and ensured dependencies.");
