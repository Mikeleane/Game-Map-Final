const fs = require("fs"), path = require("path");
const read  = f => JSON.parse(fs.readFileSync(f,"utf8").replace(/^\uFEFF/,""));
const write = (f,o) => fs.writeFileSync(f, JSON.stringify(o,null,2));

const root=".";
const contentPath = path.join(root,"h5p-folder","content","content.json");
const h5pPath     = path.join(root,"h5p-folder","h5p.json");
const libsDir     = path.join(root,"h5p-folder","libraries");

// choose installed speak lib (prefer Set)
const speakDir = fs.readdirSync(libsDir).find(d=>/^H5P\.SpeakTheWordsSet/i.test(d)) ||
                 fs.readdirSync(libsDir).find(d=>/^H5P\.SpeakTheWords/i.test(d));
if(!speakDir) throw new Error("No H5P.SpeakTheWords* library installed.");

const lib = read(path.join(libsDir, speakDir, "library.json"));
const libString = `${lib.machineName} ${lib.majorVersion}.${lib.minorVersion}`;

// minimal, valid params for both variants
const params = (lib.machineName==="H5P.SpeakTheWordsSet")
  ? { questions:[{ question:"Say the word 'greenland'", answers:["greenland"] }] }
  : { question:"Say the word 'greenland'", answers:["greenland"] };

// locate the elements array for the map
function findElementsArray(node){
  if (!node || typeof node!=="object") return null;
  if (Array.isArray(node.elements) && node.elements.every(e => e && e.type==="stage")) return node.elements;
  for (const k of Object.keys(node)){
    const r = findElementsArray(node[k]);
    if (r) return r;
  }
  return null;
}

const content = read(contentPath);
const elements = findElementsArray(content);
if (!elements || elements.length < 2) throw new Error("Need at least 2 stages.");

// pick stage #2 (index 1)
const stage = elements[1];

// choose first subcontent slot; create if missing
stage.contentsList = Array.isArray(stage.contentsList) ? stage.contentsList : [];
if (!stage.contentsList[0]) stage.contentsList[0] = { contentType: {} };

const prev = stage.contentsList[0].contentType || {};
stage.contentsList[0].contentType = {
  library: libString,
  params: params,
  // keep subContentId/metadata if they exist (optional but nice)
  subContentId: prev.subContentId || undefined,
  metadata: prev.metadata || { title: stage.label, license: "U" }
};

write(contentPath, content);

// ensure dependency in h5p.json
const h5p = read(h5pPath);
h5p.preloadedDependencies = h5p.preloadedDependencies || [];
if (!h5p.preloadedDependencies.some(d =>
  d.machineName===lib.machineName && d.majorVersion===lib.majorVersion && d.minorVersion===lib.minorVersion
)) {
  h5p.preloadedDependencies.push({
    machineName: lib.machineName,
    majorVersion: lib.majorVersion,
    minorVersion: lib.minorVersion
  });
  write(h5pPath, h5p);
}

console.log(`✅ Replaced stage 2 (${stage.label}) with ${libString}`);
