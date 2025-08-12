const fs = require("fs"), p = require("path");
const json = fs.readFileSync(p.join("h5p-folder","content","content.json"), "utf8").replace(/^\uFEFF/,"");
const h5p = JSON.parse(json);

const stage = h5p.gamemapSteps?.gamemap?.elements?.find(e => e.label === "Animals on Greenland quiz");
if (!stage) { console.log("Stage not found"); process.exit(1); }

const entry = stage.contentsList?.[0]?.contentType;
console.log("Has contentType:", !!entry);
console.log("Library:", entry?.library);
console.log("Has params:", !!entry?.params);
