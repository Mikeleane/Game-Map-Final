const fs = require("fs"), p = require("path");
const read = f => JSON.parse(fs.readFileSync(f,"utf8").replace(/^\uFEFF/,""));
const c = read(p.join(".","h5p-folder","content","content.json"));

// Find the elements array that holds { type:"stage", label, contentsList: [...] }
function findElementsArray(node){
  if (!node || typeof node!=="object") return null;
  if (Array.isArray(node.elements) && node.elements.every(e => e && e.type==="stage")) return node.elements;
  for (const k of Object.keys(node)){
    const v = node[k];
    if (v && typeof v==="object"){
      const r = findElementsArray(v);
      if (r) return r;
    }
  }
  return null;
}

const elements = findElementsArray(c);
if (!elements) throw new Error("Couldn't find gamemap elements array.");

elements.forEach((st, i) => {
  const lib = st?.contentsList?.[0]?.contentType?.library || "(no library)";
  console.log(`${i+1}. ${st.label}  [${lib}]`);
});
