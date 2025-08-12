const fs=require("fs"), p=require("path");
const read=f=>fs.readFileSync(f,"utf8").replace(/^\uFEFF/,"");
const write=(f,obj)=>fs.writeFileSync(f, JSON.stringify(obj,null,2), "utf8");

const mainPath = p.join("h5p-folder","content","content.json");
const speakPath= p.join("_tmp_speak","content","content.json");

const content   = JSON.parse(read(mainPath));
const speak     = JSON.parse(read(speakPath));   // usually { library: "H5P.SpeakTheWordsSet 1.3", params: {...}, ... }

const stage = content.gamemapSteps?.gamemap?.elements?.find(e => e.label === "Animals on Greenland quiz");
if(!stage) { throw new Error("Stage 'Animals on Greenland quiz' not found"); }

// Replace the stage’s payload with Speak-the-Words (wrapped in the shape GameMap expects)
stage.contentsList = [
  { contentType: {
      library: speak.library,
      params:  speak.params,
      metadata: speak.metadata || {}
  }}
];

write(mainPath, content);
console.log("✅ Replaced stage #2 with", speak.library);
