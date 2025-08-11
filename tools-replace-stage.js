const fs = require("fs");
const path = require("path");

function findFile(startDir, endsWith) {
  const st=[startDir]; while(st.length){ const d=st.pop();
    for(const e of fs.readdirSync(d,{withFileTypes:true})) {
      const p=path.join(d,e.name);
      if(e.isDirectory()) st.push(p);
      else if(p.replace(/\\/g,"/").endsWith(endsWith)) return p;
    }
  } return null;
}

const root = ".";
const dstContent = path.join(root,"h5p-folder","content","content.json");
const dstH5P    = path.join(root,"h5p-folder","h5p.json");
const srcParamsPath = findFile(path.join(root,"_tmp_speak"), "content/content.json");
if(!srcParamsPath) throw new Error("Couldn't find _tmp_speak/**/content/content.json");

const srcParams = JSON.parse(fs.readFileSync(srcParamsPath,"utf8"));

const libsDir = path.join(root,"h5p-folder","libraries");
// Prefer SpeakTheWordsSet, fall back to SpeakTheWords
const libFolder = fs.readdirSync(libsDir).find(d => /^H5P\.SpeakTheWords(Set)?$/i.test(d));
if(!libFolder) throw new Error("No H5P.SpeakTheWords* library found under h5p-folder/libraries");
const libJson = JSON.parse(fs.readFileSync(path.join(libsDir,libFolder,"library.json"),"utf8"));
const libString = `${libJson.machineName} ${libJson.majorVersion}.${libJson.minorVersion}`;

const targets = [
  "Animals ongreenland quiz",
  "Animals on greenland quiz",
  "Animals on Greenland quiz"
].map(s=>s.toLowerCase());

function replaceStage(node){
  if(!node || typeof node!=="object") return false;
  if(typeof node.title==="string" && targets.includes(node.title.toLowerCase())){
    const key = ["h5p","activity","content","task","question","embed","game"]
      .find(k => Object.prototype.hasOwnProperty.call(node,k));
    if(!key) throw new Error("Found the stage but no embedded H5P payload key.");
    node[key] = { library: libString, params: srcParams };
    return true;
  }
  return Object.values(node).some(replaceStage);
}

const content = JSON.parse(fs.readFileSync(dstContent,"utf8"));
if(!replaceStage(content)) throw new Error("Couldn't find the target stage title. Use Select-String to get the exact title.");
fs.writeFileSync(dstContent, JSON.stringify(content,null,2));

// Ensure dependency in h5p.json
const h5p = JSON.parse(fs.readFileSync(dstH5P,"utf8"));
h5p.preloadedDependencies = h5p.preloadedDependencies || [];
if(!h5p.preloadedDependencies.some(d =>
  d.machineName===libJson.machineName && d.majorVersion===libJson.majorVersion && d.minorVersion===libJson.minorVersion
)){
  h5p.preloadedDependencies.push({
    machineName: libJson.machineName,
    majorVersion: libJson.majorVersion,
    minorVersion: libJson.minorVersion
  });
  fs.writeFileSync(dstH5P, JSON.stringify(h5p,null,2));
}
console.log("✅ Replaced stage with", libString);
