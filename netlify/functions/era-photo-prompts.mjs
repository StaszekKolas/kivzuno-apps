// KIVZUNO: one photorealistic, reference-guided transformation.
// Pure prompt builder; it neither calls providers nor consumes credits.
export const ERA_SCENES=Object.freeze({
 egypt:"sunlit ancient Egyptian temple court beside the Nile, painted sandstone columns, carved hieroglyphs, distant date palms and warm desert haze",
 rome:"Imperial Roman forum with travertine arches, red roof tiles, marble columns and lively but distant city details",
 viking:"Viking Age Scandinavian harbour with timber longhouses, a traditional wooden longship, rugged fjord cliffs and overcast Nordic light",
 medieval:"13th-century European stone castle courtyard with towering battlements, cobblestones, wooden gates, straw and natural afternoon sunlight",
 renaissance:"16th-century Florence piazza with pale palazzo façades, hand-laid stone paving, Renaissance arches and warm Italian sunlight",
 west:"1880s Wild West frontier street with weathered wooden storefronts, hitching posts, dusty tracks and golden-hour prairie light",
 victorian:"1890 Victorian London side street with authentic stone terraces, iron railings, cobbles, gas lamps and soft mist",
 artdeco:"late-1920s grand Art Deco city entrance with elegant bronze doors, geometric stone ornament and golden evening light",
 cinema:"1940s film-noir city scene in cinematic black and white, dramatic studio chiaroscuro, wet cobblestones and smoky period architecture",
 retro:"real 1970s neighbourhood with period shopfronts, soft faded analogue film tones, vintage cars in the distance and warm afternoon light",
 neon:"1980s city arcade street with period shop signs, soft neon glow reflecting on pavement and authentic analogue film atmosphere",
 future:"2088 futuristic city street with luminous architectural details, layered skybridges, wet pavement reflections and believable cinematic realism"
});
export function createImagePrompt(era,{hasCompanion=false}={}){
 if(!Object.hasOwn(ERA_SCENES,era))throw new Error("unsupported_era");
 return [
  "TASK: PHOTOGRAPH-TO-PHOTOGRAPH ENVIRONMENT TRANSFORMATION. Create exactly ONE newly rendered photorealistic scene.",
  "Use @main as the primary reference subject, NOT as a new unrelated character. Keep the subject recognisably the SAME individual animal or person: preserve facial structure, fur or hair colouring, distinguishing marks, species, approximate age, body proportions and original pose.",
  "Preserve the primary subject's natural gesture and camera viewpoint; reposition only if necessary for a believable integrated scene.",
  hasCompanion?"Also include @companion as the same recognisable second individual, naturally at an appropriate distance and scale. Do not blend identities.":"Do not add other people, pets or animals.",
  "Completely replace the modern background, ground and lighting with this historically inspired environment: "+ERA_SCENES[era]+".",
  "For a human subject, adjust only clothing and accessories to match that era, without changing the face. For an animal, KEEP its ordinary natural fur and anatomy; do NOT dress the animal, turn it human, add limbs or change its breed.",
  "Match the subject's shadows, contact with ground, perspective, fine texture and light direction to the new scene so it looks like a real photograph, not a cut-out or sticker.",
  "Eye-level, natural photographic realism, detailed subject, inviting polished composition, coherent scale, sharp subject, cinematic yet believable lighting.",
  "No modern buildings or objects, no split screen, no collage, no duplicated subject, no extra legs, no distorted anatomy, no text, no logos, no graphic borders."
 ].join(" ");
}
