const fs = require("fs");
const path = require("path");

function requireJson(p){ return JSON.parse(fs.readFileSync(p,"utf8")); }

const root = ".";
const dstContentPath = path.join(root,"h5p-folder","content","content.json");
const dstH5pJsonPath = path.join(root,"h5p-folder","h5p.json");

// Source params: prefer _tmp_speak/**/content/content.json; fallback to the mis-copied one under libraries/content/content.json
function findSourceParams(){
  const tmp = path.join(root,"_tmp_speak");
  function findFile(startDir, endsWith){
    if(!fs.existsSync(startDir)) return null;
    const st=[startDir];
    while(st.length){
      const d=st.pop();
      for(const e of fs.readdirSync(d,{withFileTypes:true})){
        const p=path.join(d,e.name);
        if(e.isDirectory()) st.push(p);
        else if(p.replace(/\\/g,"/").endsWith(endsWith)) return p;
      }
    }
    return null;
  }
  const a = findFile(tmp,"content/content.json");
  if(a) return requireJson(a);

  const b = path.join(root,"h5p-folder","libraries","content","content.json");
  if(fs.existsSync(b)) return requireJson(b);

  throw new Error("No Speak-the-Words params found. Put a speak.h5p and Expand-Archive to _tmp_speak OR ensure h5p-folder/libraries/content/content.json exists.");
}

const srcParams = findSourceParams();

// Find installed Speak library folder
const libsDir = path.join(root,"h5p-folder","libraries");
const libFolder = fs.readdirSync(libsDir).find(d => /^H5P\.SpeakTheWords(Set)?(?:-\d+\.\d+)?$/i.test(d));
if(!libFolder) throw new Error("No H5P.SpeakTheWords* library in h5p-folder/libraries");
const libJson = requireJson(path.join(libsDir,libFolder,"library.json"));
const libString = `${libJson.machineName} ${libJson.majorVersion}.${libJson.minorVersion}`;

// Titles to match (second stage)
const targets = [
  "Animals ongreenland quiz",
  "Animals on greenland quiz",
  "Animals on Greenland quiz"
].map(s=>s.toLowerCase());

function replaceStage(node){
  if(!node || typeof node!=="object") return false;
  if(typeof node.title==="string" && targets.includes(node.title.toLowerCase())){
    const key = ["h5p","activity","content","task","question","embed","game","stage","widget"]
      .find(k => Object.prototype.hasOwnProperty.call(node,k));
    if(!key) throw new Error("Found the stage but no embedded H5P payload key.");
    node[key] = { library: libString, params: srcParams };
    return true;
  }
  return Object.values(node).some(replaceStage);
}

// Update main content.json
const dstContent = requireJson(dstContentPath);
if(!replaceStage(dstContent)) throw new Error("Couldn't find the target stage title. Use Select-String to get the exact title.");
fs.writeFileSync(dstContentPath, JSON.stringify(dstContent, null, 2));

// Ensure dependency in h5p.json
const h5p = requireJson(dstH5pJsonPath);
h5p.preloadedDependencies = h5p.preloadedDependencies || [];
if(!h5p.preloadedDependencies.some(d =>
  d.machineName===libJson.machineName && d.majorVersion===libJson.majorVersion && d.minorVersion===libJson.minorVersion
)){
  h5p.preloadedDependencies.push({
    machineName: libJson.machineName,
    majorVersion: libJson.majorVersion,
    minorVersion: libJson.minorVersion
  });
  fs.writeFileSync(dstH5pJsonPath, JSON.stringify(h5p, null, 2));
}

// Clean up the mis-copied params under libraries if present
const stray = path.join(root,"h5p-folder","libraries","content","content.json");
if(fs.existsSync(stray)){
  try { fs.rmSync(path.dirname(stray), { recursive:true, force:true }); } catch(e){}
}

console.log("✅ Replaced stage with", libString);
