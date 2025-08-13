const fs = require("fs"), p = require("path");
const f = p.join("h5p-folder","content","content.json");
const h = JSON.parse(fs.readFileSync(f,"utf8").replace(/^\uFEFF/, ""));

const TARGET = "Fill in the missing words about animals in South America"; // Stage 4 label
const e = h?.gamemapSteps?.gamemap?.elements?.find(x => x.label === TARGET);
if (!e) { console.error("Stage not found:", TARGET); process.exit(1); }

e.contentsList = [{
  contentType: {
    library: "H5P.AdvancedText 1.1",
    params: {
      text: `<div style="text-align:center;">
<iframe src="https://en.islcollective.com/english-esl-video-lessons/family-verb-to-be-pronouns-possession/1138832"
        width="800" height="450" frameborder="0" allowfullscreen style="max-width:100%;"></iframe>
</div>`
    },
    metadata: { title: "iSLCollective video", license: "U" }
  }
}];

fs.writeFileSync(f, JSON.stringify(h, null, 2));
console.log("✅ Replaced stage:", TARGET);