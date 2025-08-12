const fs=require("fs"), p=require("path");
const read=f=>fs.readFileSync(f,"utf8").replace(/^\uFEFF/,"");
const c=JSON.parse(read(p.join("h5p-folder","content","content.json")));

function* walk(o, path=[]){
  if(o && typeof o==="object"){
    yield {o, path};
    for(const [k,v] of Object.entries(o)) yield* walk(v, path.concat(k));
  }
}

const bad=[];
for(const {o,path} of walk(c)){
  if (o && typeof o==="object" && Object.prototype.hasOwnProperty.call(o,"library")){
    if (typeof o.library!=="string" || !o.library.trim()){
      bad.push({ path: path.join("."), library: o.library });
    }
  }
}
console.log("Bad entries:", bad);
