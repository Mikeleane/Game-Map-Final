const fs = require("fs");
const p  = require("path");
const crypto = require("crypto");

const H5P_FOLDER = "h5p-folder";
const CONTENT = p.join(H5P_FOLDER,"content","content.json");
const H5PJSON = p.join(H5P_FOLDER,"h5p.json");

// 1) Load JSONs (strip any BOM)
const read = f => fs.readFileSync(f,"utf8").replace(/^\uFEFF/,"");
const h5p = JSON.parse(read(CONTENT));
const meta = JSON.parse(read(H5PJSON));

// 2) Find the stage you want to replace (by label contains "drag and drop")
const want = (e) => typeof e.label==="string" && /drag\s*and\s*drop/i.test(e.label);
const stage = h5p.gamemapSteps.gamemap.elements.find(want);
if (!stage) { console.error("Stage not found (looking for 'drag and drop')."); process.exit(1); }

// 3) Build an AdvancedText item with your Wordwall iframe
const iframeHTML = `<iframe style="max-width:100%" src="https://wordwall.net/es/embed/715cab19ab954ff9b976634871ca2182?themeId=4&templateId=70&fontStackId=0" width="500" height="380" frameborder="0" allowfullscreen></iframe>`;

const item = {
  library: "H5P.AdvancedText 1.1",
  params: { text: iframeHTML },
  metadata: { contentType: "Advanced text", license: "U", title: "Wordwall", authors: [], changes: [], extraTitle: "Wordwall" },
  subContentId: (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()))
};

// 4) Replace the stage content (single item list)
stage.contentsList = [{ contentType: item }];

// 5) Ensure dependency exists in h5p.json
meta.preloadedDependencies = meta.preloadedDependencies || [];
const depName = "H5P.AdvancedText";
const dep = meta.preloadedDependencies.find(d => d && d.machineName===depName);
if (!dep) {
  meta.preloadedDependencies.push({ machineName: depName, majorVersion: 1, minorVersion: 1 });
} else {
  dep.majorVersion = 1; dep.minorVersion = 1;
}

// 6) Save files
fs.writeFileSync(CONTENT, JSON.stringify(h5p, null, 2));
fs.writeFileSync(H5PJSON, JSON.stringify(meta, null, 2));
console.log("✅ Replaced stage with Wordwall embed.");
