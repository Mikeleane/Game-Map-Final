const fs = require("fs"), p=require("path");
const content = JSON.parse(fs.readFileSync(p.join(".","h5p-folder","content","content.json"),"utf8"));

function* walk(o){ if(o && typeof o==="object"){ yield o;
  if(Array.isArray(o)) for(const v of o) yield* walk(v);
  else for(const k of Object.keys(o)) yield* walk(o[k]); } }

const stages=[];
for (const obj of walk(content)){
  if (obj && typeof obj==="object" && typeof obj.title==="string"){
    const k = Object.keys(obj).find(x=>obj[x] && typeof obj[x]==="object" && typeof obj[x].library==="string" && obj[x].params);
    if (k) stages.push({title: obj.title, key: k});
  }
}
stages.forEach((s,i)=>console.log(`${i+1}. ${s.title}  [payload: ${s.key}]`));
