/** The written brains of the catalog: why each workout is built the way it
 * is, and — per plan — the full rationale plus a researched eating plan with
 * an explained shopping list. Kept in one file so the whole catalog's
 * coaching voice can be reviewed and edited in one place. Nutrition numbers
 * follow the mainstream evidence: ~1.6–2.2 g protein/kg/day for building or
 * keeping muscle, a 300–500 kcal deficit for sustainable fat loss, and fiber
 * at roughly 14 g per 1,000 kcal. */

export interface DietItem {
  name: string;
  quantity: string;
  why: string;
}

export interface PlanGuide {
  /** Paragraphs: who it's for, why this structure, how to progress it. */
  writeup: string[];
  diet: {
    headline: string;
    /** Paragraphs: why this way of eating makes the training work. */
    why: string[];
    /** The macro frame in plain words. */
    macros: string;
    /** A day's shape — meal-by-meal guidance, not a rigid menu. */
    dayShape: { meal: string; guidance: string }[];
    /** The plan's grocery list, each item with its job. */
    shopping: DietItem[];
  };
}

/* ------------------------------ Workouts ------------------------------ */

export const WORKOUT_WHY: Record<string, string> = {
  'str-foundations-a':
    'Squat, bench and row cover both halves of the body with the three most learnable barbell patterns, and at 3×5 the weight is heavy enough to drive strength without burying a beginner in soreness. The plank finisher builds the trunk stiffness the barbell lifts depend on.',
  'str-foundations-b':
    "The B-day mirrors A with the missing patterns — hinge, vertical press, vertical pull — so alternating A/B trains everything twice per week without repeating a lift two sessions running. Deadlifts stay at 3×5 because a beginner's limiting factor is positions, not capacity.",
  'str-squat-day':
    'One heavy pattern per day lets you spend your best effort where it counts: 5×5 squats first, then leg press adds quad volume without more spinal load, RDLs balance the hamstrings, and calves and abs ride along because they recover cheaply.',
  'str-bench-day':
    'Heavy flat pressing first, incline second to bias the upper chest at a friendlier joint angle, dips for loaded stretch, then face pulls — the antidote to a pressing-heavy week — to keep the shoulders balanced and healthy.',
  'str-deadlift-day':
    'Deadlifts at 5×3 keep every rep crisp — the hinge punishes sloppy fatigue reps more than any other lift. Rows and good mornings then build the back that holds your deadlift positions, and shrugs finish the traps the top of the pull depends on.',
  'str-overhead-day':
    "Strict press builds pressing strength you own; push press afterwards overloads the same pattern with leg drive so your nervous system feels heavier weight than strict pressing allows. Laterals, upright rows and pushdowns finish the shoulders and triceps that cap most people's press.",
  'str-heavy-lower':
    'Triples at 6 sets accumulate heavy practice without single-rep risk. Front squats then force the upright, braced posture back squats let you cheat, stiff-leg deadlifts load the hamstrings at length, and jump squats convert strength to speed.',
  'str-heavy-upper':
    'Powerlifting-style bench triples build the top end; close-grip work targets the triceps that finish a press. Rows and weighted-progression chin-ups keep the pulling side growing in step — a big bench needs a big back to press from.',
  'str-olympic-power':
    'Cleans and snatches teach force production at speed — power, not just strength. They come first because explosive quality dies with fatigue; push press and overhead squats then buy the shoulder and hip mobility the quick lifts demand.',
  'str-strongman':
    'Loaded carries and sled pushes build grip, trunk and work capacity in ways barbells miss, with almost no soreness cost. The trap bar keeps heavy pulling in the mix with a friendlier back angle, and box jumps keep the hips fast.',
  'mus-fullbody-starter':
    'Five movements, every major muscle, machine-and-dumbbell friendly: goblet squats teach squatting with built-in counterbalance, push and pull stay balanced rep-for-rep, and everything sits in the 10–15 rep range where beginners grow fastest with the least joint stress.',
  'mus-upper-basics':
    'A push, a pull, and the three vanity muscles beginners actually care about — delts, biceps, triceps — because training you enjoy is training you repeat. Dumbbells and cables keep every movement self-correcting.',
  'mus-lower-basics':
    'Machines on purpose: leg press, curls and extensions let a newcomer take legs near failure safely, which free-weight squats do not. Calves and a plank round it out; barbell squatting can come once the muscles know their jobs.',
  'mus-push':
    'Chest, shoulders and triceps in one day so they can be hit hard and then rest three days. Heavy bench leads, incline and overhead work spread the stimulus across the delts and upper chest, and cables plus laterals finish with tension where bars can’t reach.',
  'mus-pull':
    'Width first (pull-ups), thickness second (rows), then rear delts and arms. The order runs big-to-small because rows die when the biceps are pre-cooked, not the other way around. Face pulls are the posture insurance of a pulling day.',
  'mus-legs':
    'Squats lead while you’re fresh, the RDL covers the half of the thigh squats miss, leg press adds quad volume without more back fatigue, and curls, calves and hanging raises clean up the rest. Two hinges plus two knee-bends is the classic hypertrophy split of labor.',
  'mus-chest-back':
    'Antagonist pairing: pressing and pulling alternate, so one side rests while the other works and the shoulder never sees ten straight pressing sets. You get more quality volume per hour than either muscle trained alone.',
  'mus-arms-shoulders':
    "A dedicated pump day the big lifts can't provide: arms and delts get first-of-the-day energy for once. Presses lead, then curls and extensions alternate so neither arm muscle limits the other, finishing with cables for constant tension.",
  'mus-push-adv':
    'Volume is the advanced lever: five pressing movements wave from heavy barbell work down to strict cable flies, hitting the chest and delts from every angle before high-rep laterals empty the tank.',
  'mus-pull-adv':
    'Weighted chins turn back width into a strength lift; heavy rows and cable rows stack thickness volume behind it. Preacher curls isolate the biceps at their weakest angle, and face pulls keep the volume from turning into shoulder trouble.',
  'mus-glutes-hams':
    'Hip thrusts load the glutes at peak contraction, RDLs load them at length — together that is full-range coverage the squat alone never gives. Bridges, curls and kickbacks fill in the volume at low fatigue cost.',
  'fat-walk-tone':
    'Brisk walking burns real calories at zero recovery cost, and the three strength moves after it protect muscle while you lose weight. This is deliberately easy to finish — in week one, finishing is the entire goal.',
  'fat-beginner-circuit':
    "Bodyweight moves in a circuit keep the heart rate up without loading joints that aren't ready. Every exercise scales by reps, so bad days have an easy setting that still counts.",
  'fat-low-impact':
    'Three machines, steady effort, zero impact: the session for tired days, sore days, and bodies that jogging currently punishes. Calories burned on the elliptical count exactly as much as calories burned running.',
  'fat-hiit':
    'Short maximal intervals produce a large training effect per minute and an elevated burn after you stop. Jump squats and climbers keep it strength-flavored so the weight you lose stays fat, not muscle.',
  'fat-kettlebell':
    'Swings are the rare exercise that is a hinge, a cardio interval and a posterior-chain builder at once. Goblet squats and step-ups keep the legs honest, and the rope finisher empties whatever is left.',
  'fat-treadmill-intervals':
    'Run-walk intervals let you accumulate far more fast running than one continuous effort would allow — the walk segments are the point, not a failure. Core work afterwards uses time the treadmill already warmed up.',
  'fat-fullbody-sweat':
    'Real barbell and cable lifts at circuit pace: strength training is the best insurance that a calorie deficit burns fat instead of muscle, and the air-bike cap turns the leftover energy into extra expenditure.',
  'fat-metcon':
    'Power cleans and jumps at high heart rate — a demand most cardio never makes — for people whose base fitness can cash that check. The rowing block afterwards is the steady-state counterweight.',
  'fat-stairs-core':
    'Twenty minutes of climbing is brutal, simple and knee-friendlier than running downhill ever is. The ab block after it works the trunk when it is pre-fatigued, which is when core training bites hardest.',
  'fat-row-burn':
    'Rowing is the full-body cardio machine, sumo deadlifts keep heavy strength in the week, and sled pushes add hard work with no eccentric — meaning no soreness tax on the rest of your training.',
  'fit-first-steps':
    'Two sets of everything, generous rest, a ten-minute walk to finish: a complete session that a true beginner can repeat in two days without dreading it. Frequency beats heroics for the first month.',
  'fit-home-bodyweight':
    'Squat, lunge, push, brace — the four patterns that keep a body functional — with zero equipment so travel and busy weeks have no excuse. Dead bugs and side bridges build the trunk quietly.',
  'fit-machine-circuit':
    'A guided lap of the machine floor: every station is self-explanatory, self-spotting, and adjustable in five seconds. The ideal first month of gym membership.',
  'fit-express-30':
    'One compound per movement pattern, no redundancy, thirty minutes door to door. This is the session that survives the weeks when life wins.',
  'fit-core-stability':
    'Anti-extension (plank), anti-lateral-flexion (side bridge), anti-rotation (Pallof) — the trunk’s real jobs are resisting motion, not making it. Back extensions and the ab roller add the strength on top of the control.',
  'fit-athletic':
    'Jumps for power, lunges for single-leg strength, pull-ups for relative strength, carries for grip and gait — the qualities sport actually uses, in the order that fatigue allows them to be trained well.',
  'fit-balanced-fullbody':
    'The classic three-lift full body plus shoulders and abs: enough stimulus to progress for months, few enough moving parts to master. Three times a week, this quietly outperforms most complicated programs.',
  'fit-hybrid':
    'Strength and engine in one session: explosive cleans and heavy chins while fresh, then a fifteen-minute run when tired — teaching the body to endure after it has produced force, which is what "being in shape" means in practice.',
  'fit-total-challenge':
    'A benchmark day: heavy pulls, high-rep pushing, jumps and a timed row. Repeat it monthly and the logbook tells you plainly whether the training between attempts worked.',
  'ulppl-upper':
    'Heavy fives on bench and row while you are freshest all week — strength work leads the hybrid because it degrades fastest with fatigue. The 8–10 rep accessories behind it start the volume bill that the PPL back-half of the week finishes.',
  'ulppl-lower':
    'Squat fives then an 8-rep hinge: the two patterns that carry the lower body, at two intensities, in one day. Machines and calves mop up because they cost little recovery two days before the volume leg day.',
  'ulppl-push':
    'The second chest-and-shoulders exposure of the week runs lighter and higher-rep on purpose: Monday built strength, today builds size on top of it, finishing with push-ups because an honest AMRAP set is the cheapest volume there is.',
  'ulppl-pull':
    'Deadlift triples-to-fives open the day, then the back gets its width and thickness volume. Arms come last and get real attention — this is the only day of the week they are trained fresh enough to matter.',
  'ulppl-legs':
    'Front squats force the upright posture Monday’s back squats let you cheat; split squats find the leg-to-leg gaps; hip thrusts load the glutes at the top where hinges cannot. The week ends with legs because Sunday is for recovering from it.',
  'shred-chest-tri':
    'The trick is what happens between sets: 60 seconds of jump rope, marching or step-ups instead of sitting down. Lifting keeps the muscle; the never-stopping keeps the heart rate — and the calorie bill — high for the whole hour.',
  'shred-back-bi':
    'Pulling volume at pace: rows and pulldowns hold muscle through the deficit while the cardio minutes between sets do the burning. Face pulls stay in even here, because shoulder health does not take weeks off.',
  'shred-legs':
    'High-rep squats, lunges and hinges are the most expensive movements in the gym, metabolically — which is exactly why they anchor the shred week. Nothing burns more or defends muscle better.',
  'shred-shoulders':
    'Delts, traps and core at circuit pace. The direct core block sits here because it is the shortest lifting day — and abs are trained, not found, even in a deficit.',
  'shred-circuit':
    'The week ends with everything at once: eight stations, three rounds, then a ten-minute treadmill finisher. When form degrades from fatigue, drop the weight — not the standard.',
  'hiit-tabata':
    'The original 1996 Tabata protocol produced its famous results at genuinely maximal effort — 20 seconds all-out, 10 off, eight times. Four exercises, four blocks, and the honest version of “all-out” is the entire secret.',
  'hiit-kb-clock':
    'EMOM structure is self-regulating: work fast and you earn rest, slow down and the clock takes it away. Swings, squats, push-ups and presses cover the whole body while the minute format keeps intensity honest.',
  'hiit-chipper':
    'AMRAP scoring turns a circuit into a benchmark — the round count is your fitness, measured. Pace it steady: the goal is a score you can beat next week, not a first round you cannot repeat.',
  'hiit-102030':
    'The Copenhagen 10-20-30 study made runners faster on half their usual mileage: 30 easy, 20 cruising, 10 sprinting, five times, then walk. The 10-second surges work even at 80% — this is the interval session for people who hate interval sessions.',
  'mob-cooldown':
    'Static stretching lands best on warm tissue, which is why this lives at the end of training days: 20–30 second holds, top-down so nothing gets skipped, following the ACSM guidance of 2–4 rounds per muscle across the week.',
  'mob-hips':
    'Hips stiffen from sitting and pay it back during squats. The 90/90, deep squat holds, hip-flexor kneels and the World’s Greatest Stretch are the highest-yield positions physios prescribe — five minutes of them beats an hour of wishing.',
  'mob-desk':
    'Eight desk hours pull the head forward and the chest closed; this sequence pulls both back. Chest openers, upper-back extension, neck range and wrist care — run it on breaks or before upper-body days.',
  'run-c25k':
    'Every session is the same shape — walk, run/walk intervals, walk — while the intervals grow week by week. The plan guide holds the full nine-week table; your only job is conversational pace and showing up three times a week.',
  'cardio-5mile':
    'Distance as the whole workout: five miles of steady, conversational effort. The elliptical carries it by default because it is the joint-friendliest way to spend an hour — treadmill walking works the same shift.',
  'cb-upper':
    'Every load here is chosen to be moved with rhythmic breathing — exhale on the press, inhale on the return, never a breath-hold grind. Rows and band pull-aparts outnumber presses on purpose: back strength is the project. Ends on the elliptical, because on this plan cardio is non-negotiable.',
  'cb-lower':
    'Goblet squats and RDLs at loads you can breathe through, single-leg work for the joints, then swings for hip power. Bridges and dead bugs train the trunk without the abdominal compression sit-ups bring — the core work here protects, not provokes.',
  'cb-fullbody':
    'Every pattern once at moderate effort, then the trunk work that matters: carries for bracing under breath, supermans for the back line, dead bugs for control. Upright, breathing, repeatable — the Friday session that ends the training week strong.',
};

/* -------------------------------- Plans -------------------------------- */

const HIGH_PROTEIN_SHOPPING: DietItem[] = [
  { name: 'Chicken breast', quantity: '1.5 kg', why: 'The cheapest lean protein per gram — the backbone of lunches and dinners.' },
  { name: 'Eggs', quantity: '12', why: 'Complete protein plus the most flexible breakfast that exists.' },
  { name: 'Greek yogurt', quantity: '1 kg', why: '~10 g protein per 100 g and works as breakfast, snack or dessert.' },
  { name: 'Cottage cheese', quantity: '500 g', why: 'Slow-digesting casein — the classic pre-bed feeding for overnight recovery.' },
  { name: 'Canned tuna', quantity: '4 cans', why: 'Shelf-stable emergency protein for days that go sideways.' },
  { name: 'Whey protein', quantity: '1 tub', why: 'Not magic — just the most convenient way to hit your number on busy days.' },
  { name: 'Oats', quantity: '1 kg', why: 'Slow carbs to fuel the morning and carry the pre-workout meal.' },
  { name: 'White rice', quantity: '2 kg', why: 'Easy-digesting carbs around training when appetite is the bottleneck.' },
  { name: 'Bananas', quantity: '7', why: 'Pre-workout carbs that require zero preparation.' },
  { name: 'Frozen mixed vegetables', quantity: '1 kg', why: 'Micronutrients and fiber with no chopping — no excuse not to.' },
  { name: 'Olive oil', quantity: '1 bottle', why: 'Calorie-dense healthy fat to top meals up to a surplus.' },
  { name: 'Milk', quantity: '2 L', why: 'Liquid calories and protein — the easiest surplus there is.' },
];

const DEFICIT_SHOPPING: DietItem[] = [
  { name: 'Chicken breast', quantity: '1 kg', why: 'Maximum protein per calorie — the deficit dieter’s best friend.' },
  { name: 'White fish fillets', quantity: '600 g', why: 'Even leaner than chicken; variety keeps a deficit livable.' },
  { name: 'Eggs', quantity: '12', why: 'Highly satiating for their calories — hunger control is the whole game.' },
  { name: '0% Greek yogurt', quantity: '1 kg', why: 'Protein-dense dessert base that kills evening cravings.' },
  { name: 'Mixed salad greens', quantity: '2 bags', why: 'Near-zero calories, maximum plate volume — eat big, spend little.' },
  { name: 'Broccoli', quantity: '1 kg', why: 'Fiber and bulk that make meals filling at low cost.' },
  { name: 'Berries', quantity: '500 g', why: 'Sweetness for a fraction of the calories of dessert.' },
  { name: 'Potatoes', quantity: '1.5 kg', why: 'Among the most satiating foods measured per calorie — boiled, they fight hunger for you.' },
  { name: 'Canned beans or lentils', quantity: '3 cans', why: 'Protein plus fiber in one cheap ingredient.' },
  { name: 'Cottage cheese', quantity: '500 g', why: 'Late-night protein that fits the budget.' },
  { name: 'Zero-calorie sparkling water', quantity: '6', why: 'Scratches the soda itch for free.' },
  { name: 'Coffee or green tea', quantity: '1 pack', why: 'Blunts appetite and carries the low-calorie mornings.' },
];

const BALANCED_SHOPPING: DietItem[] = [
  { name: 'Oats', quantity: '1 kg', why: 'Whole-grain breakfast base with staying power.' },
  { name: 'Brown rice', quantity: '1 kg', why: 'Steady carbs plus fiber for main meals.' },
  { name: 'Chicken thighs', quantity: '1 kg', why: 'Affordable protein that survives batch cooking without drying out.' },
  { name: 'Canned or fresh fish', quantity: '3 portions', why: 'Twice-weekly fish is one of the most consistent findings in healthy-diet research.' },
  { name: 'Eggs', quantity: '12', why: 'Complete protein, endlessly flexible.' },
  { name: 'Mixed vegetables', quantity: '1.5 kg', why: 'The five-a-day engine — frozen counts just as much as fresh.' },
  { name: 'Fruit (whatever is cheap)', quantity: '10 pieces', why: 'The default snack — sweet, filling, and self-limiting.' },
  { name: 'Nuts', quantity: '400 g', why: 'Healthy fats and the snack that actually stops hunger.' },
  { name: 'Olive oil', quantity: '1 bottle', why: 'The default cooking fat of every diet pattern with good long-term data.' },
  { name: 'Greek yogurt', quantity: '1 kg', why: 'Protein and calcium with breakfast-to-dessert range.' },
  { name: 'Beans or lentils', quantity: '3 cans', why: 'Fiber, protein and B-vitamins at pennies per serving.' },
];

const MUSCLE_DIET_WHY = [
  'Muscle is built from two ingredients: a training stimulus and enough raw material. The evidence is unusually consistent on the material — around 1.6 to 2.2 g of protein per kilogram of body weight per day, spread over three to five feedings, is where muscle growth plateaus; more protein than that mostly just costs money.',
  'Calories decide the direction. A small surplus of roughly 200–300 kcal above maintenance is enough to build without smearing on fat; carbs cluster around training because they fuel the volume that makes this plan work, and fats fill the remainder for hormones and joints.',
];

const DEFICIT_DIET_WHY = [
  'Fat loss has one non-negotiable: a calorie deficit. The sustainable size is 300–500 kcal per day — roughly 0.25–0.5% of body weight per week — because bigger deficits trade short-term speed for muscle loss, rebound hunger and quitting.',
  'Protein goes UP while dieting, not down: 1.8–2.4 g/kg protects muscle when calories are scarce and is the most filling macronutrient per calorie. The rest of this list is chosen for satiety per calorie — high-volume, high-fiber foods that keep you full enough to stay in the deficit that does the actual work.',
];

const BALANCED_DIET_WHY = [
  'No deficit, no surplus — this is eating for energy, recovery and health at maintenance. The pattern with the best long-term evidence looks Mediterranean: mostly plants, whole grains, fish twice a week, olive oil as the default fat, and protein at every meal.',
  'Protein still matters at ~1.6 g/kg — it preserves muscle through the decades, not just through a program — and fiber at about 14 g per 1,000 kcal keeps the whole system running. Nothing here is forbidden; the list just makes the good default the easy default.',
];

const MUSCLE_DAY_SHAPE = [
  { meal: 'Breakfast', guidance: 'Oats cooked in milk plus eggs or yogurt — 30 g protein and slow carbs before the day starts.' },
  { meal: 'Lunch', guidance: 'Chicken and rice with vegetables and olive oil; the biggest carb meal sits closest to training.' },
  { meal: 'Around training', guidance: 'A banana before; a whey shake after if the next meal is more than two hours away.' },
  { meal: 'Dinner', guidance: 'Another palm-to-two-palms of protein with carbs sized to appetite.' },
  { meal: 'Before bed', guidance: 'Cottage cheese or Greek yogurt — slow protein for the overnight fast.' },
];

const DEFICIT_DAY_SHAPE = [
  { meal: 'Breakfast', guidance: 'Eggs or 0% Greek yogurt with berries — protein-first mornings blunt hunger all day.' },
  { meal: 'Lunch', guidance: 'A huge salad base with chicken or fish and beans; volume is the strategy.' },
  { meal: 'Snack', guidance: 'Fruit, or coffee/sparkling water when it is boredom rather than hunger talking.' },
  { meal: 'Dinner', guidance: 'Lean protein with boiled potatoes and greens — deliberately the fullest meal, because evenings are where deficits die.' },
  { meal: 'Late evening', guidance: 'Cottage cheese or yogurt if genuinely hungry; never nothing, because white-knuckling leads to bingeing.' },
];

const BALANCED_DAY_SHAPE = [
  { meal: 'Breakfast', guidance: 'Oats with fruit and yogurt, or eggs on whole-grain toast.' },
  { meal: 'Lunch', guidance: 'A grain bowl: brown rice, a protein, plenty of vegetables, olive oil.' },
  { meal: 'Snack', guidance: 'Fruit or a small handful of nuts.' },
  { meal: 'Dinner', guidance: 'Protein plus two vegetables; fish on at least two nights of the week.' },
];

const COMEBACK_SHOPPING: DietItem[] = [
  { name: 'Chicken breast & thighs', quantity: '2 kg', why: 'The lean-protein backbone — 190–200 g of protein a day starts here.' },
  { name: 'Salmon or white fish', quantity: '800 g', why: 'Protein plus omega-3s; the least reflux-provoking dinner protein.' },
  { name: 'Lean ground beef (93%+)', quantity: '1 kg', why: 'Iron-rich variety so lean eating never gets boring enough to quit.' },
  { name: 'Eggs', quantity: '18', why: 'The break-fast staple — satiating protein to open the 9am eating window.' },
  { name: 'Plain Greek yogurt (2%)', quantity: '1 kg', why: 'Slow casein protein that stretches amino availability into the evening fast.' },
  { name: 'Cottage cheese', quantity: '500 g', why: 'The 3:30pm final-meal protein on fast days.' },
  { name: 'Whey protein', quantity: '1 tub', why: 'The post-lift shake on Mon/Wed/Fri — check the label for corn syrup solids.' },
  { name: 'Spinach, peppers, zucchini, broccoli', quantity: 'a week’s worth', why: 'Organic where it matters — high-volume plates that make 2,700 kcal feel like plenty.' },
  { name: 'Berries, apples, melon', quantity: 'a week’s worth', why: 'The fruit priority, and dessert that fits a deficit.' },
  { name: 'Avocados & olive oil', quantity: '4 + 1 bottle', why: 'The approved fats — no seed oils to label-check when these are the default.' },
  { name: 'Potatoes & rice', quantity: '1.5 kg', why: 'The modest carb allowance, placed on lifting days where it earns its keep.' },
  { name: 'Electrolyte packets (unsweetened)', quantity: '1 box', why: 'For fast-day evening cardio — water and electrolytes carry the 5-milers.' },
];

const COMEBACK_DAY_SHAPE = [
  { meal: 'Lifting days (Mon/Wed/Fri)', guidance: 'Four meals plus a post-lift whey shake, ~2,700–2,800 kcal, carbs clustered around training. Last meal ends 3 h before bed.' },
  { meal: 'Fast days (Tue/Thu, eat 9am–4pm)', guidance: 'Three dense feedings, protein front-loaded (~50–60 g each); final meal by 3:45pm with slow proteins. Then water and electrolytes only.' },
  { meal: 'Fast-day evening', guidance: 'The 5-mile session at ~6:30pm lands 2.5–3 h after the last meal — empty stomach, minimal reflux, steady state handles fasting fine.' },
  { meal: 'Weekend', guidance: 'Saturday normal eating plus the stretch session; Sunday is the lowest-carb, lowest-calorie day of the week (~2,500).' },
  { meal: 'Always', guidance: 'No corn in any form, no seeds (watch seeded breads, granola, bars, whole-grain mustard, hummus); fruit, vegetables and organic first.' },
];

const COMEBACK_DIET_WHY = [
  'The math for a 6\'4", 330 lb frame: maintenance sits near 3,700 kcal, so 2,700–2,800 kcal creates the 700–900 kcal daily deficit that averages ~1.4 lb/week — exactly the pace that reaches ~220 lb in 18 months, and comfortably inside the safe 1–2 lb band. Recalibrate monthly against the scale: under 1 lb/week for a month, drop ~150 kcal; over 2.5, add them back.',
  'Protein is the muscle insurance: 190–200 g/day (about 0.9 g per pound of goal weight), split across 4–5 feedings. Lower-carb is the adherence tool, not magic — ~130–150 g of carbs fuels the five cardio days while protein and fat keep hunger quiet.',
  'The Tue/Thu 4pm–9am fast (~17 h) is working with the body, not against it: intermittent fasting measurably reduced nighttime acid exposure in GERD studies, largely because nothing is in the stomach at bedtime — which is precisely what a hiatal hernia wants. Training fasted in the evening steady-state zone costs nothing as long as the day\'s protein was banked before 4pm.',
];

export const PLAN_GUIDES: Record<string, PlanGuide> = {
  'plan-fat-comeback': {
    writeup: [
      'This plan is built around a constraint most programs ignore: a hiatal hernia. The rule that matters is pressure, not effort — sharp spikes of intra-abdominal pressure (breath-holding under load, crunching the torso, heavy grinding reps, anything head-below-stomach) are what push a hernia around. So every lift here lives in the 8–12+ rep range at loads you can move while breathing rhythmically: exhale on the exertion, inhale on the return, never hold a breath to finish a rep. That costs essentially nothing for muscle growth — it only rules out max-effort singles, which were never the point of a fat-loss year.',
      'The core and back work is chosen the same way: dead bugs, Pallof presses, carries, bridges and supermans train bracing, anti-rotation and the posterior chain without the abdominal compression of sit-ups and crunches — those stay out until the weight is down and the hernia is repaired. Also out: decline positions, long prone planks, and grinding overhead work. Also in, always: wait 2.5–3 hours after a full meal before training.',
      'The week: Monday upper + 30 elliptical minutes, Tuesday five miles as the whole workout, Wednesday lower + 30, Thursday five miles again, Friday full body + 30, Saturday the cool-down stretch (mobility is part of the program, not an accessory), Sunday completely off. Cardio five days a week, exactly as prescribed — the elliptical carries it because at a big bodyweight it is the highest-volume, lowest-risk engine there is.',
      'Progress in phases. Months 1–3: build to the full five miles (start at 2.5–3 if needed, add half a mile a week) and keep every lift at 2–3 reps in reserve — which doubles as hernia protection. Months 4–9: apply the 2-for-2 rule (two extra reps beyond target on the last set, two sessions running → add 5 lb upper / 10 lb lower); when the 35 lb dumbbells cap out, shift those lifts to the barbell at the same breathing standard. Months 10–18: this is the likely window for hernia repair once the weight is well down — after surgical clearance, planks, hanging core work and heavier lifting come off the banned list, and visible abs become a realistic finish line.',
    ],
    diet: {
      headline: 'Lean protein, lower carb, twice-weekly 17-hour fasts — engineered for a 110 lb loss',
      why: COMEBACK_DIET_WHY,
      macros: 'Phase 1 (months 1–6): ~2,700–2,800 kcal · protein 190–200 g · fat ~100 g · carbs 130–150 g. Step down ~200 kcal at months 7 and 13 as maintenance falls. No corn, no seeds; olive oil and avocado are the fats.',
      dayShape: COMEBACK_DAY_SHAPE,
      shopping: COMEBACK_SHOPPING,
    },
  },
  'plan-mus-ulppl': {
    writeup: [
      'The two most popular intermediate splits stitched into one five-day week: Upper/Lower up front for heavy strength work while you are fresh, Push/Pull/Legs at the back for the volume that grows muscle. Every muscle gets trained twice a week — the frequency sweet spot the research keeps landing on — without the recovery tax of a six-day grind.',
      'The intensity split is deliberate: days one and two run 4×5 on the big barbell lifts with long rests (2–3 minutes); days four through six run 8–15 rep hypertrophy work with shorter rests (60–90 seconds). Strength feeds the volume days — a heavier five-rep bench in March means heavier ten-rep sets in April.',
      'Progress the fives with weight (add 5 lb upper / 10 lb lower when all sets hit) and the volume work with reps first: reach the top of the rep range on every set, then add load and drop back down. Wednesday and Sunday are off on purpose — guard them.',
    ],
    diet: {
      headline: 'High protein at a small surplus — five training days need feeding',
      why: MUSCLE_DIET_WHY,
      macros: 'Protein 1.6–2.2 g/kg · calories at maintenance +200–300 · carbs biased around the five training days · fats to fill the rest.',
      dayShape: MUSCLE_DAY_SHAPE,
      shopping: HIGH_PROTEIN_SHOPPING,
    },
  },
  'plan-fat-shred5': {
    writeup: [
      'Metabolic lifting, borrowed from the cardio-acceleration playbook: you never actually rest. Every between-set break is 60 seconds of jump rope, running in place, step-ups or light dumbbell work — so an hour of lifting carries an hour of elevated heart rate, and the calorie bill of a cardio session rides along with the muscle-keeping stimulus of a lifting one.',
      'The week runs a body-part split at high pace — chest/triceps, back/biceps, legs, shoulders/core — and ends with a full-body circuit plus treadmill finisher. Run it as a six-week cycle: weeks 1–2 in the 9–11 rep range, 3–4 at 12–15, 5–6 at 15–20 on accessories while the first compound of each day stays heavier.',
      'Two honest warnings. This is an advanced plan: the work capacity to lift well while breathless takes months to build — if form degrades, drop the weight, never the standard. And it only works alongside the deficit: the training defends muscle and spends calories, but the eating creates the loss.',
    ],
    diet: {
      headline: 'A protected deficit — protein up, calories down, satiety everywhere',
      why: DEFICIT_DIET_WHY,
      macros: 'A 300–500 kcal deficit · protein 1.8–2.4 g/kg · carbs concentrated before the day\'s session · high-volume, high-fiber everything else.',
      dayShape: DEFICIT_DAY_SHAPE,
      shopping: DEFICIT_SHOPPING,
    },
  },
  'plan-run-c25k': {
    writeup: [
      'The plan that has taken millions of people from the sofa to a 30-minute run, in nine weeks of walk/run intervals that grow so gradually you barely notice. Three runs a week, a rest day between every one, and every session bracketed by a 5-minute warm-up walk and cool-down walk. Same run all week except weeks 5 and 6, which escalate within the week.',
      'The intervals — run/walk, repeated through ~20 minutes: Week 1: run 60 s / walk 90 s ×8. Week 2: run 90 s / walk 2 min ×6. Week 3: two rounds of [90 s run, 90 s walk, 3 min run, 3 min walk]. Week 4: run 3, walk 1½, run 5, walk 2½, run 3, walk 1½, run 5.',
      'Week 5 escalates per run: (1) 5 run / 3 walk / 5 / 3 / 5 · (2) 8 run / 5 walk / 8 · (3) the famous 20-minute continuous run. Week 6: (1) 5/3/8/3/5 · (2) 10 run / 3 walk / 10 · (3) 25 minutes continuous — the last walk break of the program. Week 7: 25 continuous, all runs. Week 8: 28. Week 9: 30 minutes continuous — graduation.',
      'Two rules carry the whole plan: conversational pace (if you cannot speak a full sentence, slow down — slower than feels dignified is correct), and never skip the rest day. Repeat a week any time it felt like a scrape rather than a step; nine weeks is the minimum, not the deadline.',
    ],
    diet: {
      headline: 'Balanced maintenance eating — fuel the habit, not a transformation',
      why: BALANCED_DIET_WHY,
      macros: 'Maintenance calories · protein ~1.6 g/kg · carbs comfortably around run days · fiber ~14 g per 1,000 kcal.',
      dayShape: BALANCED_DAY_SHAPE,
      shopping: BALANCED_SHOPPING,
    },
  },
  'plan-fit-365': {
    writeup: [
      'A year of showing up, structured as four 13-week phases that each raise the bar just enough. The premise, borrowed from year-long challenge programs: commit to one progressive plan, whole foods, and 7–8 hours of sleep — and refuse to program-hop. The weekly template in this plan is the Phase 1 shape; the phases below evolve it.',
      'Phase 1 — Show Up (weeks 1–13): three sessions a week, any type — the only win that counts is attendance. Start at 20 minutes if needed; by week 13, three 30–45 minute sessions should feel automatic. Milestones: first perfect week (wk 4), 20 workouts (wk 8), 35+ (wk 13).',
      'Phase 2 — Build (weeks 14–26): four sessions — two or three strength with tracked weights, the rest conditioning. Beat last week by a rep or a couple of kilos. Milestones: +10% on your main lifts (wk 18), 85+ total workouts at halfway (wk 26). Phase 3 — Push (weeks 27–39): five sessions — three strength, one HIIT, one endurance or mobility — plus one monthly challenge workout (max push-up test, 5K time trial). This is the peak-volume quarter.',
      'Phase 4 — Own It (weeks 40–52): two deload weeks, then retest every Phase 1 baseline — push-ups, 5K, main lifts, resting heart rate — and hold a 3-session minimum through the holidays. The finish line: around 200 workouts, twelve months, not a single zero-week. Swap the template\'s workouts freely as you level up; the streak is the program.',
    ],
    diet: {
      headline: 'Balanced, boring, sustainable — the eating that survives 52 weeks',
      why: BALANCED_DIET_WHY,
      macros: 'Maintenance calories · protein ~1.6 g/kg · fiber ~14 g per 1,000 kcal · nothing forbidden, defaults made easy.',
      dayShape: BALANCED_DAY_SHAPE,
      shopping: BALANCED_SHOPPING,
    },
  },
  'plan-str-beg': {
    writeup: [
      'This is the classic novice linear progression: two alternating full-body sessions, three days a week, built around the barbell lifts because they let a beginner add weight every single session — a privilege that only exists for the first few months of training and that this plan is designed to milk completely.',
      'Full-body frequency beats splits for novices because each lift is practiced three times in two weeks while the skill is still forming, and 3×5 keeps the weights heavy enough to drive strength but light enough that form holds. The rest days between sessions are part of the program: a novice grows between workouts, not during them.',
      'Run it simply: add 2.5 kg (5 lb) to squat and press movements and 5 kg (10 lb) to deadlifts whenever you complete every prescribed rep. When a lift stalls twice, deload it 10% and climb again. When deloads stop working, you have graduated — move to the 4-Day Strength Split.',
    ],
    diet: {
      headline: 'High protein at a small surplus — feed the fastest gains you will ever make',
      why: [
        'Novice lifters can gain strength and muscle faster than anyone else in the gym, but only if recovery keeps pace with three heavy sessions a week. That means protein at 1.6–2.2 g/kg every day — not just training days — and enough total food that body weight trends slightly up.',
        'A surplus of 200–300 kcal is plenty. The scale should crawl, not jump: gaining faster than about 1–2 kg a month as a novice mostly adds fat, and milk plus olive oil are on the list precisely because they make small, controllable surpluses easy.',
      ],
      macros: 'Protein 1.6–2.2 g/kg · calories at maintenance +200–300 · carbs biased around the three training days · fats to fill the rest.',
      dayShape: MUSCLE_DAY_SHAPE,
      shopping: HIGH_PROTEIN_SHOPPING,
    },
  },
  'plan-str-int': {
    writeup: [
      'When adding weight every session stops working, you periodize by the week instead: each of the four days owns one big lift — squat, bench, deadlift, overhead press — so every lift still gets a full-effort heavy day plus targeted accessories, and four sessions spread the fatigue that one brutal full-body day would concentrate.',
      'The accessories are not decoration: each one attacks the common weak link of its main lift — leg press for squat volume without spinal fatigue, close-grip pressing for the triceps that finish a bench, good mornings for the back that holds a deadlift together.',
      'Progress week to week, not session to session: add 2.5 kg (5 lb) to a main lift when all five sets hit, and every fourth week take an easy week at 80% if the bar speed is grinding. Intermediates plateau from unmanaged fatigue far more often than from too little effort.',
    ],
    diet: {
      headline: 'High protein, periodized like the training',
      why: [
        'Four heavy sessions a week is a real recovery bill. Protein stays at the 1.6–2.2 g/kg evidence range, and calories sit at maintenance or a hair above — intermediates gain muscle slowly, so aggressive surpluses just add bodyfat that a future cut has to pay back.',
        'Carbs deserve deliberate placement here: the squat and deadlift days are the most glycogen-hungry sessions in the plan, so the biggest carb meals belong the night before and the hours around those two days.',
      ],
      macros: 'Protein 1.6–2.2 g/kg · calories at maintenance to +200 · biggest carb days around squat and deadlift sessions.',
      dayShape: MUSCLE_DAY_SHAPE,
      shopping: HIGH_PROTEIN_SHOPPING,
    },
  },
  'plan-mus-beg': {
    writeup: [
      'Three days that teach the three shapes of hypertrophy training — a full-body day to learn the movements, an upper day and a lower day to learn concentrating effort — using machines and dumbbells so every set is self-correcting while form is still forming.',
      'Everything lives in the 10–15 rep range on purpose: it grows muscle just as well as heavy fives, with far less joint stress and much more feedback about which muscle is actually doing the work. The skill this plan really teaches is taking a set close to failure safely — one to two reps shy, every set.',
      'Progress by reps first: when the top of a rep range is reached on every set, add weight and drop back to the bottom. After eight to twelve weeks this plan hands off naturally to Push Pull Legs.',
    ],
    diet: {
      headline: 'High protein while learning the habit',
      why: [
        'New muscle needs the same 1.6–2.2 g/kg of protein whether you are a beginner or advanced — but beginners have the added job of making the number a habit. The list is deliberately convenience-heavy (yogurt, eggs, tuna, whey) because the protein target you can hit on a bad day is the one that builds muscle.',
        'Calories go to maintenance or slightly above. Beginners partially recomposition — building muscle and losing some fat at once — so a big surplus is unnecessary; consistency of the protein target matters far more than precision of the calorie one.',
      ],
      macros: 'Protein 1.6–2.2 g/kg every day · calories at maintenance to +200 · at least three protein feedings.',
      dayShape: MUSCLE_DAY_SHAPE,
      shopping: HIGH_PROTEIN_SHOPPING,
    },
  },
  'plan-mus-ppl': {
    writeup: [
      'Push, pull, legs is the most durable hypertrophy split there is, because it groups muscles that work together: everything that presses recovers while everything that pulls trains. Each muscle gets hammered once and then genuinely rests — with three sessions and four rest days, this is the maximum-recovery version of the split.',
      'Session order inside each day runs big-to-small — barbell compound first while fresh, cables and isolation last — because a fatigued chest can still fly, but a fatigued triceps caps every press. Rest periods are programmed per exercise and are part of the stimulus: long for the compounds, short for the pumps.',
      'Progress with the double-progression rule: add a rep per set until the top of the range, then add weight and restart. If a session ever feels empty, add one set to the first two exercises before touching anything else — volume is the growth lever.',
    ],
    diet: {
      headline: 'The classic muscle-building diet: 2 g/kg and a crawling surplus',
      why: MUSCLE_DIET_WHY,
      macros: 'Protein ~2 g/kg · calories at maintenance +200–300 · carbs concentrated on the three training days · 3–5 protein feedings of ~0.4 g/kg.',
      dayShape: MUSCLE_DAY_SHAPE,
      shopping: HIGH_PROTEIN_SHOPPING,
    },
  },
  'plan-mus-ppl6': {
    writeup: [
      'The six-day version doubles the frequency: every muscle trains twice a week, which the research on training frequency consistently favors once volume is high enough to need splitting. The advanced push/pull days carry the heavier variations; the second pass through uses the standard days plus a dedicated glute-and-hamstring day to balance all that pressing and squatting.',
      'This plan assumes the recovery infrastructure of an advanced trainee: sleep, food and stress actually managed. Its failure mode is not missed lifts but accumulated fatigue — so the single rest day is sacred, and every fifth week should be a deliberate deload at two-thirds volume.',
      'Progress the same double-progression way, but expect it to be slow and lift-by-lift — at this level, a rep gained on a weighted chin-up is a good week. The logbook, not the mirror, is the scoreboard.',
    ],
    diet: {
      headline: 'Eating is half this program — high protein, real carbs, no accidental deficit',
      why: [
        'Six training days make under-eating the biggest threat to this plan. The protein requirement is the same 1.6–2.2 g/kg, but total calories and especially carbohydrates have to cover the volume: training hard six days a week in an accidental deficit is how advanced lifters spin their wheels for a year.',
        'Distribution matters more at this frequency: four to five protein feedings of roughly 0.4 g/kg keep muscle protein synthesis elevated around near-daily training, and a pre-bed casein feeding (cottage cheese) covers the overnight window between an evening session and the next day’s.',
      ],
      macros: 'Protein 1.8–2.2 g/kg · calories at maintenance +300 · carbs high six days a week · 4–5 feedings plus pre-bed protein.',
      dayShape: MUSCLE_DAY_SHAPE,
      shopping: HIGH_PROTEIN_SHOPPING,
    },
  },
  'plan-fat-beg': {
    writeup: [
      'Three deliberately easy sessions: a walk-plus-strength day, a bodyweight circuit, and a low-impact cardio day. The design goal is adherence — for a beginner, the difference between a plan that burns 300 kcal a session and one that burns 500 is meaningless if the harder one gets abandoned in week three.',
      'Strength moves appear in every session on purpose: even small doses of resistance work signal the body to keep muscle while the calorie deficit strips fat, which is the difference between losing weight and actually changing shape.',
      'Progress by showing up: three sessions a week for four straight weeks is the win condition. Then extend the walks, add reps to the circuits, and when the low-impact day starts feeling easy, this plan hands off to Shred 4-Day.',
    ],
    diet: {
      headline: 'A gentle deficit that does the actual fat loss',
      why: DEFICIT_DIET_WHY,
      macros: 'Calories at maintenance −300 to −500 · protein 1.8–2.4 g/kg · fiber ~14 g per 1,000 kcal · weigh-ins weekly, adjust monthly.',
      dayShape: DEFICIT_DAY_SHAPE,
      shopping: DEFICIT_SHOPPING,
    },
  },
  'plan-fat-int': {
    writeup: [
      'Four sessions that attack fat loss from both ends: HIIT and treadmill intervals for calorie burn and conditioning, kettlebell and circuit-strength days so the weight that leaves is fat and not muscle. The split alternates high-impact and low-impact days so joints get a rhythm of stress and recovery.',
      'Intervals earn their place by economics — more energy per minute, plus an elevated after-burn — but the strength-flavored days are the quiet heroes: muscle retained during a deficit is what makes the "after" photo look trained rather than merely smaller.',
      'Progress by density: same work in less time, shorter rests, or one extra round. When the scale stalls for two weeks straight, the adjustment belongs in the kitchen, not another training day — this plan is already enough stimulus.',
    ],
    diet: {
      headline: 'The researched cut: protein up, calories down, satiety everywhere',
      why: DEFICIT_DIET_WHY,
      macros: 'Calories −400 to −500 · protein 2+ g/kg (it protects muscle AND kills hunger) · carbs kept around the interval days · fiber high.',
      dayShape: DEFICIT_DAY_SHAPE,
      shopping: DEFICIT_SHOPPING,
    },
  },
  'plan-fit-beg': {
    writeup: [
      'Three sessions built to make training a normal part of a week: a guided first-steps day, a no-equipment home day so travel and closed gyms change nothing, and a machine-circuit day that turns an intimidating gym floor into a friendly checklist.',
      'Every session trains the patterns that keep a body working — squat, push, pull, hinge, carry, brace — at an effort of about seven out of ten. Nothing here chases exhaustion, because the research on exercise habits is blunt: intensity impresses, frequency transforms.',
      'Progress by widening the base: a rep here, a little more weight there, a slightly longer walk. After a couple of months, pick the direction that pulled at you most — strength, muscle or conditioning — and graduate to that plan.',
    ],
    diet: {
      headline: 'Balanced maintenance eating — the pattern with the best long-term evidence',
      why: BALANCED_DIET_WHY,
      macros: 'Calories at maintenance · protein ~1.6 g/kg · fish twice a week · fiber ~14 g per 1,000 kcal · nothing forbidden.',
      dayShape: BALANCED_DAY_SHAPE,
      shopping: BALANCED_SHOPPING,
    },
  },
};
