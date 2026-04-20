# StarForge Artwork Prompts

Reference prompt pack for manual image generation in ChatGPT or Gemini.

Source: extracted from `docs/plans/2026-03-07-artwork-implementation.md` Task 11, with an added revised prompt draft for `metalMine`.

## Shared style prefix

Use this at the start of every prompt:

> Old-school realistic sci-fi illustration, painted space art in the style of 1970s-80s science fiction book covers, dramatic lighting, highly detailed, no text, no logos, no watermarks

## Size guidance

- Card banners (buildings, ships, defences, research): `1792x1024`
- Page banners: `1792x1024`
- Planet portraits: `1024x1024`
- Planet icons: generate from the portrait art, then resize to `128x128`

For copy-paste prompts in ChatGPT, include the requested output size directly in the prompt text.

## Buildings

| ID | Prompt Subject |
|----|----------------|
| metalMine | Massive open-pit metal mine on an alien planet, industrial drilling rigs, glowing ore veins, harsh lighting |
| crystalMine | Crystal extraction facility carved into a crystalline cliff face, blue-purple crystal formations, laser cutters |
| deuteriumSynthesizer | Deuterium processing plant beside an alien ocean, atmospheric condensers, pipes and tanks |
| solarPlant | Solar energy farm on a sun-baked planet, enormous mirrored dishes, heat haze |
| fusionReactor | Underground fusion reactor complex, plasma containment rings, intense blue-white glow |
| metalStorage | Enormous metal storage silos on a barren plain, industrial scale, conveyor systems |
| crystalStorage | Crystal warehouse with transparent walls, stacked crystal formations glowing within |
| deuteriumTank | Pressurised deuterium storage tanks, frost-covered pipes, industrial landscape |
| roboticsFactory | Factory floor with robotic assembly arms building spacecraft components, sparks and welding arcs |
| naniteFactory | Gleaming nanite production facility, ultra-clean white chambers, microscale machinery visible in glowing vats |
| shipyard | Enormous orbital shipyard in space, skeletal ship frames under construction, welding torches, stars beyond |
| researchLab | High-tech research laboratory, holographic displays, scientists at work, alien technology samples |

## Ships

| ID | Prompt Subject |
|----|----------------|
| lightFighter | Sleek single-seat space fighter, delta-wing design, engine trails, deep space background |
| heavyFighter | Heavier armoured fighter with twin cannons, scarred hull, battle-worn, asteroid field |
| cruiser | Mid-size warship cruising through space, rotating gun turrets, running lights, nebula backdrop |
| battleship | Massive battleship dwarfing smaller craft, heavy armour plating, multiple gun batteries |
| bomber | Wide-bodied space bomber with torpedo bays open, menacing silhouette, approaching a planet |
| destroyer | Long sleek destroyer at speed, energy weapons charging, star field |
| battlecruiser | Hybrid warship, fast lines but heavy guns, racing through a debris field |
| smallCargo | Boxy utilitarian cargo shuttle, loading bay open, crates being loaded by robotic arms |
| largeCargo | Large freighter with modular cargo pods, slow and massive, docking at a space station |
| colonyShip | Massive colony vessel with habitat modules, generation ship scale, slow and majestic |
| recycler | Industrial recycler ship with large scoop arrays, debris field, harvesting wrecked ships |
| espionageProbe | Tiny stealth probe, barely visible, sleek and dark, slipping past a space station |
| solarSatellite | Orbital solar satellite with large photovoltaic panels, planet below, sunlight glinting |

## Defences

| ID | Prompt Subject |
|----|----------------|
| rocketLauncher | Ground-based rocket battery on a planet surface, launch tubes angled skyward, exhaust trails |
| lightLaser | Rapid-fire laser turret on a fortified platform, red-orange energy beams, targeting system |
| heavyLaser | Heavy industrial laser cannon, massive barrel, heat vents glowing, fortified bunker |
| gaussCannon | Railgun battery, electromagnetic coils visible, projectile accelerating in a blue flash |
| ionCannon | Ion cannon array, electric-blue discharge crackling, atmospheric distortion |
| plasmaTurret | Plasma turret charging, glowing sphere of superheated matter, dramatic energy arcs |
| smallShieldDome | Translucent energy shield dome over a small base, shimmering blue, repelling a laser hit |
| largeShieldDome | Enormous planetary shield dome, covering a city-sized area, visible from orbit |

## Research Technologies

| ID | Prompt Subject |
|----|----------------|
| energyTechnology | Energy research facility, high-voltage experiments, plasma coils, scientists observing |
| laserTechnology | Laser research lab, precision optics, ruby laser firing into a crystal array |
| ionTechnology | Ion drive research, blue ion exhaust in a vacuum chamber, engineers observing |
| plasmaTechnology | Plasma containment research, swirling plasma held in magnetic fields, observatory-style lab |
| espionageTechnology | Intelligence technology center, holographic displays of star maps, encrypted communications |
| computerTechnology | Advanced computer core, servers and processing arrays, blue data streams |
| weaponsTechnology | Weapons research range, scientists testing new beam weapons on armour samples |
| shieldingTechnology | Shield generator prototype, energy barrier forming around a test structure |
| armourTechnology | Materials lab, scientists testing new hull alloy plates with laser cutters |
| combustionDrive | Combustion drive test stand, rocket flame, engineers in heat-resistant suits |
| impulseDrive | Impulse drive prototype on a test rig, blue-white exhaust, space station hangar |
| hyperspaceTechnology | Hyperspace research station, distorted space around an experimental drive, swirling wormhole |
| hyperspaceDrive | Hyperdrive core installation, engineers working on the massive engine, ship interior |
| astrophysicsTechnology | Space observatory, enormous telescope array pointed at a nebula, researchers inside |
| intergalacticResearchNetwork | Massive deep-space communication array, multiple dishes, signal beams connecting star systems |

## Planets

| Type | Prompt |
|------|--------|
| hot | Volcanic alien planet from orbit, lava flows visible, scorched rock, thin atmosphere, dramatic shadow |
| temperate | Earth-like planet from orbit, blue oceans, green-brown continents, white cloud swirls |
| cold | Rocky grey-brown planet from orbit, thin wisps of atmosphere, cratered, desolate |
| frozen | Ice-covered planet from orbit, white and pale blue surface, frozen methane seas, distant sun |

## Page Banners

| Panel | Prompt |
|-------|--------|
| fleet | Formation of diverse warships in deep space, fighters, cruisers, battleships, dramatic lighting, nebula backdrop |
| defence | Planetary surface covered in defence installations, laser turrets, missile batteries, shield domes, at twilight |
| buildings | Colony base panorama on an alien planet, mines, factories, silos, research domes, industrial scale |
| research | Orbital research station complex, multiple modules, telescopes, labs, scientists visible through windows, planet below |
| galaxy | Deep space panorama, star field, nebulae, a spiral galaxy in the distance, sense of vast scale |

## Revised Prompt Drafts

### metalMine

Use case: stylized-concept  
Asset type: building card banner, wide landscape crop  
Primary request: Metal Mine  
Prompt:

> Generate as `1792x1024` wide landscape. Old-school realistic sci-fi illustration, painted space art in the style of 1970s-80s science fiction book covers, dramatic lighting, highly detailed, no text, no logos, no watermarks. A colossal shaft-based metal mine on an alien world, composed as a wide cinematic building card banner. The focus is a grand central mining complex built around a monumental headframe tower and massive industrial superstructure, with heavy lift elevators descending into a deep vertical mine shaft. Surrounding the main building are reinforced processing halls, ore crushers, conveyor lines, rail carts, exhaust stacks, floodlights, and rugged retro-futurist machinery integrated into rocky terrain. The architecture should feel monumental, functional, and imposing, more like a strategic resource building than a real-world quarry. Moody cold atmosphere, deep blue-grey shadows, dim industrial floodlights, steel, charcoal, and muted rust tones, faint cyan haze, sparse orange furnace glow only as small accent lights, overcast alien sky, smoky air, subtle mist, painterly detail. Emphasize the headframe, the shaft entrance, and the grand industrial building silhouette. The mine building must be the clear primary subject, centered and visually iconic, suitable for a strategy game building card. No open-pit mine, no terraced quarry, no giant circular excavation, no golden sunset, no warm orange overall grading, no foreground excavators dominating the frame, no characters, no interface elements.

Recommended size: `1792x1024`

### crystalMine

Use case: stylized-concept  
Asset type: building card banner, wide landscape crop  
Primary request: Crystal Mine  
Prompt:

> Generate as `1792x1024` wide landscape. Old-school realistic sci-fi illustration, painted space art in the style of 1970s-80s science fiction book covers, dramatic lighting, highly detailed, no text, no logos, no watermarks. A monumental crystal mining complex on an alien world, composed as a wide cinematic building card banner. The focus is a grand industrial extraction facility built directly into towering blue-violet crystal formations, with a central refinery structure and heavy mining superstructure embedded in the crystalline cliff face. Giant faceted crystals rise around and through the architecture, glowing from within with cold luminous energy. The complex includes laser cutting arrays, suspended mining platforms, conveyor lines, reinforced bridges, industrial gantries, and processing chambers collecting shattered crystal shards. Moody cold atmosphere, deep blue-grey shadows, cobalt and violet light scattering through translucent crystal surfaces, faint cyan haze, sparse warm industrial lights only as small accents, smoky air, subtle mist, painterly detail. Emphasize the contrast between dark steel machinery and radiant crystal formations. The crystal mine building must be the clear primary subject, centered and visually iconic, suitable for a strategy game building card. No generic cave interior, no small handheld crystals, no fantasy magic temple, no warm orange overall grading, no characters, no interface elements.

Recommended size: `1792x1024`

### deuteriumSynthesizer

Use case: stylized-concept  
Asset type: building card banner, wide landscape crop  
Primary request: Deuterium Synthesizer  
Prompt:

> Generate as `1792x1024` wide landscape. Old-school realistic sci-fi illustration, painted space art in the style of 1970s-80s science fiction book covers, dramatic lighting, highly detailed, no text, no logos, no watermarks. A monumental deuterium extraction and processing complex on an alien world, composed as a wide cinematic building card banner. The focus is a grand industrial refinery built beside a dark alien sea or frozen shoreline, with massive atmospheric condensers, cryogenic towers, pressure tanks, pipe networks, pumping stations, and heavy retro-futurist processing machinery. The architecture should feel like a strategic resource building, iconic and imposing, not a generic oil refinery. Cold vapor pours from condenser stacks, pale blue process lights glow through mist, reflective wet metal surfaces catch dim light, and the surrounding terrain feels harsh and inhospitable. Moody cold atmosphere, deep blue-grey shadows, steel, charcoal, muted teal, and icy cyan highlights, sparse warm industrial lights only as small accents, smoky air, subtle mist, painterly detail. Emphasize the central refinery building, the condenser structures, and the network of pipes and tanks. The deuterium synthesizer must be the clear primary subject, centered and visually iconic, suitable for a strategy game building card. No sunny sky, no warm orange overall grading, no modern real-world petrochemical plant look, no characters, no interface elements.

Recommended size: `1792x1024`

### solarPlant

Use case: stylized-concept  
Asset type: building card banner, wide landscape crop  
Primary request: Solar Plant  
Prompt:

> Generate as `1792x1024` wide landscape. Old-school realistic sci-fi illustration, painted space art in the style of 1970s-80s science fiction book covers, dramatic lighting, highly detailed, no text, no logos, no watermarks. A monumental solar power complex on an alien world, composed as a wide cinematic building card banner. Show the scene from an elevated three-quarter aerial view, not a straight-on symmetrical front view. The focus is a grand central energy station with a tall receiver tower, surrounded by a vast ordered field of realistic heliostat mirrors across a barren rocky plain. Use only believable solar-thermal engineering: thousands of flat reflective mirror panels on precise industrial tracking frames, arranged in a coherent engineered grid. Every mirror in the scene, including the nearest foreground rows, must share the same tracking logic and visibly tilt toward the same central receiver tower. Foreground mirrors must not become individually posed hero objects; they should match the same orientation pattern as the rest of the field. The architecture should feel iconic and strategic, like a flagship planetary power plant, but grounded in plausible industrial design. Cold moody atmosphere, deep blue-grey shadows, steel, charcoal, muted silver, faint cyan haze, and hard white sunlight glinting off mirror surfaces. Sparse warm industrial lights appear only as small accents within the main structure. Emphasize the central power station, the directional mirror field, and the sense of vast engineered scale. The solar plant must be the clear primary subject, visually iconic, suitable for a strategy game building card. No parabolic dishes, no radar-dish look, no flat front-facing panel grid, no foreground mirrors at random angles, no mirrors pointing in opposite directions, no perfect dead-center symmetry, no fantasy temple silhouette, no grassy landscape, no warm orange overall grading, no generic present-day solar farm, no characters, no interface elements.

Recommended size: `1792x1024`

### fusionReactor

Use case: stylized-concept  
Asset type: building card banner, wide landscape crop  
Primary request: Fusion Reactor  
Prompt:

> Generate as `1792x1024` wide landscape. Old-school realistic sci-fi illustration, painted space art in the style of 1970s-80s science fiction book covers, dramatic lighting, highly detailed, no text, no logos, no watermarks. A colossal fusion reactor complex on an alien world, composed as a wide cinematic building card banner. The focus is a grand central reactor building with massive containment rings, armored energy conduits, cooling towers, and heavy retro-futurist industrial architecture built into dark rocky terrain. At the heart of the structure, a brilliant blue-white fusion core glows through reinforced apertures and magnetic ring assemblies, casting cold light across steel surfaces and drifting vapor. The architecture should feel monumental, dangerous, and extremely powerful, like a late-game strategic power building rather than a normal factory. Moody cold atmosphere, deep blue-grey shadows, steel, charcoal, muted rust, faint cyan haze, intense electric blue and white reactor light, sparse warm industrial lights only as small accents, smoky air, subtle mist, painterly detail. Emphasize the main reactor structure, the containment rings, and the overwhelming sense of contained energy. The fusion reactor must be the clear primary subject, centered and visually iconic, suitable for a strategy game building card. No open lava pit, no orange fire-dominated scene, no generic nuclear cooling plant, no characters, no interface elements.

Recommended size: `1792x1024`

### solarSatellite

Use case: stylized-concept  
Asset type: ship or utility card banner, wide landscape crop  
Primary request: Solar Satellite  
Prompt:

> Generate as `1792x1024` wide landscape. Old-school realistic sci-fi illustration, painted space art in the style of 1970s-80s science fiction book covers, dramatic lighting, highly detailed, no text, no logos, no watermarks. A large orbital solar satellite above an alien planet, composed as a wide cinematic card banner. The focus is a single iconic retro-futurist solar satellite with a compact central hub and broad photovoltaic panel wings extending symmetrically from either side. The satellite should feel engineered, elegant, and functional, more like a strategic orbital power unit than a modern communications satellite. Show it in low orbit with the curve of the planet below, subtle atmospheric glow, distant stars, and cold reflected light across dark metal framing. Moody cold atmosphere, deep blue-grey shadows, steel, charcoal, muted silver, faint cyan haze, with sharp white sunlight glinting off the panel surfaces. Sparse warm utility lights appear only as tiny accents on the central hub. Emphasize the silhouette of the satellite, the geometry of the panel wings, and the sense of quiet orbital scale. The solar satellite must be the clear primary subject, centered and visually iconic, suitable for a strategy game card. No cluttered fleet scene, no weaponry, no radar dish, no random extra satellites, no warm orange overall grading, no characters, no interface elements.

Recommended size: `1792x1024`
