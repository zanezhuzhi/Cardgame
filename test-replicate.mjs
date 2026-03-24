import fs from "node:fs/promises";
import Replicate from "replicate";

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

const styleBase =
  "japanese anime cel-shaded style, fine lineart, soft shadows, mysterious elegant eastern fantasy mood, deep purple-blue gradient background, subtle japanese cloud pattern, golden and sakura pink particle glow, ultra detailed character illustration, no text, no watermark";

const tasks = [
  {
    filename: "shikigami_ssr_01_yato.png",
    prompt:
      `${styleBase}, young female warrior, long black hair to waist, stern sharp eyes, dark wa-fu battle outfit in black with silver armor accents, worn sleeves, black scabbard with dark red patterns, giant cursed katana with blood-red gradient blade and glowing runes, iaido slash pose, body leaning right, blade arc from upper-right to lower-left, crimson blade trails and petals swirling`,
  },
  {
    filename: "shikigami_ssr_02_tengu.png",
    prompt:
      `${styleBase}, powerful male tengu yokai with deep red skin and long nose, dignified expression, huge black raven wings fully spread with purple sheen, traditional dark hunting robe, wide sleeves flowing in wind, floating stance, golden wind blades circling, leaves and stone fragments lifted, storm mist around legs, dramatic centered composition`,
  },
  {
    filename: "shikigami_ssr_03_shuten.png",
    prompt:
      `${styleBase}, muscular oni male, rough charismatic face with slight beard, bronze skin with oni markings, thick curved horns with ring patterns and gold ornaments at roots, dark red leather armor with dark-gold metal parts and bone spikes, small sake gourd at waist, giant cracked floating sake gourd glowing golden light, tipsy but imposing pose, one hand on waist one hand pointing to gourd, dark purple and crimson flame atmosphere`,
  },
];

const outputDir = "assets";
await fs.mkdir(outputDir, { recursive: true });

for (const task of tasks) {
  const output = await replicate.run("black-forest-labs/flux-2-pro", {
    input: {
      prompt: task.prompt,
      aspect_ratio: "2:3",
      output_format: "png",
    },
  });

  const file = Array.isArray(output) ? output[0] : output;
  const ab = await new Response(file).arrayBuffer();
  const savePath = `${outputDir}/${task.filename}`;

  await fs.writeFile(savePath, Buffer.from(ab));
  console.log(`已保存: ${savePath}`);
}