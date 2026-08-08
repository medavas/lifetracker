/**
 * The strength program — static config, never stored in the DB.
 *
 * Same standing as `areas.js`: the program is a *definition*, not user data.
 * Changing the plan (new exercise, new rep range, a different day split) is an
 * edit to this file and nothing else; the views are generic over it and no
 * migration is needed, because nothing here is persisted.
 *
 * The one thing that must NEVER change casually is an exercise `id`. Every
 * logged set references it (`log.exercise`), so renaming an id orphans that
 * exercise's whole history. Renaming `name` is free — change the label, keep
 * the id.
 *
 * Fields on an exercise:
 *   id         stable key, referenced by every set log — do not rename
 *   name       display label
 *   sets       target working sets
 *   low, high  the double-progression rep range (inclusive)
 *   step       lb added when the range is topped out (default 5)
 *   alt        the swap when a gym lacks the machine
 *   cue        the one thing that makes or breaks the movement
 *   perSide    reps are per leg/side
 *   bodyweight weight is optional (0 = just you)
 *   assisted   HIGHER weight = EASIER, so progress means the number going DOWN
 *   superset   exercises sharing a tag are run back to back
 */

/** JS getDay(): Sun 0 … Sat 6. */
export const SESSIONS = [
  {
    id: 'upper',
    name: 'Upper Body',
    weekday: 6,
    exercises: [
      { id: 'smith-bench', name: 'Smith machine bench press', sets: 3, low: 6, high: 10,
        cue: 'Bar touches mid-chest. Shoulder blades pinned. Lower ~2s, press without bouncing.' },
      { id: 'lat-pulldown', name: 'Lat pulldown', sets: 3, low: 8, high: 12,
        cue: 'Chest up, lean back ~15°, drive elbows down to your ribs. No torso swing.' },
      { id: 'db-shoulder-press', name: 'Seated dumbbell shoulder press', sets: 3, low: 8, high: 12, step: 5,
        cue: 'Start at ear height, press up and slightly in. Do not arch to grind reps out.' },
      { id: 'cable-row', name: 'Seated cable row', sets: 3, low: 10, high: 12,
        alt: 'Plate-loaded row',
        cue: 'Sit tall, pull to the lower ribs, squeeze the blades. No body swing.' },
      { id: 'pec-fly', name: 'Pec fly machine', sets: 2, low: 12, high: 15,
        cue: 'Slight elbow bend, hug a tree. Stretch at the back, no slamming at the front.' },
      { id: 'cable-curl', name: 'Cable curl', sets: 2, low: 12, high: 15, step: 5, superset: 'arms',
        cue: 'Elbows pinned to your sides. No swinging.' },
      { id: 'rope-pushdown', name: 'Rope pushdown', sets: 2, low: 12, high: 15, step: 5, superset: 'arms',
        cue: 'Elbows locked in place, spread the rope at the bottom.' },
    ],
  },
  {
    id: 'lower',
    name: 'Lower Body',
    weekday: 0,
    exercises: [
      { id: 'leg-press', name: 'Leg press', sets: 3, low: 8, high: 12, step: 10,
        cue: 'Feet shoulder-width, mid-platform. Stop before your lower back rolls off the pad. Knees track over toes.' },
      { id: 'smith-rdl', name: 'Smith machine Romanian deadlift', sets: 3, low: 8, high: 10,
        cue: 'Soft knees, hips straight back, bar slides down the thighs. Flat back. Stop at a strong hamstring stretch.' },
      { id: 'leg-extension', name: 'Leg extension', sets: 3, low: 12, high: 15,
        cue: 'Full range, 1s squeeze at the top, control the way down.' },
      { id: 'leg-curl', name: 'Seated leg curl', sets: 3, low: 12, high: 15,
        alt: 'Lying leg curl',
        cue: 'Squeeze hard, lower slow, hips stay down on the seat.' },
      { id: 'calf-raise', name: 'Calf raise on leg press', sets: 3, low: 12, high: 15, step: 10,
        alt: 'Standing calf machine',
        cue: 'Heels drop for a full stretch, pause 1s, full squeeze up top. No bouncing.' },
      { id: 'cable-crunch', name: 'Cable crunch', sets: 3, low: 12, high: 15,
        alt: 'Ab machine',
        cue: 'Crunch the ribs toward the hips — this is not a hip hinge.' },
    ],
  },
  {
    id: 'full',
    name: 'Full Body',
    weekday: 3,
    exercises: [
      { id: 'smith-squat', name: 'Smith machine squat', sets: 3, low: 6, high: 10, step: 10,
        cue: 'Feet slightly in front of the bar, bar on upper traps, brace hard, at least parallel. Depth over weight.' },
      { id: 'incline-db-press', name: 'Incline dumbbell press', sets: 3, low: 8, high: 12, step: 5,
        cue: 'Bench at ~30°, blades pinned. Expect less weight than you think.' },
      { id: 'assisted-pullup', name: 'Assisted pull-up machine', sets: 3, low: 8, high: 12, assisted: true,
        alt: 'Lat pulldown, grip varied from Saturday',
        cue: 'Full hang at the bottom, chin over the bar at the top. Log the ASSIST weight — less assist is progress.' },
      { id: 'split-squat', name: 'Smith machine split squat', sets: 2, low: 10, high: 10, perSide: true,
        alt: 'Dumbbell walking lunge',
        cue: 'Long stance, back foot on the toes, back knee straight down. The front leg does the work.' },
      { id: 'lateral-raise', name: 'Dumbbell lateral raise', sets: 2, low: 12, high: 15, step: 5,
        cue: 'Light and strict, lead with the elbows to shoulder height. Shrugging means go lighter.' },
      { id: 'back-extension', name: 'Back extension', sets: 2, low: 12, high: 15, bodyweight: true,
        cue: 'Controlled up, squeeze the glutes at the top, never hyperextend past straight.' },
    ],
  },
]

/** The standing rules — read once, applied every session. */
export const RULES = [
  { title: 'Effort',
    text: 'Every set ends 1–2 reps shy of failure. If you had 5 more in you, it did not count.' },
  { title: 'Progression',
    text: 'Double progression: start at the bottom of the rep range on all sets, add reps each week, and when you hit the top of the range on every set, add weight and drop back to the bottom.' },
  { title: 'Rest',
    text: '2–3 min after the big compounds, 60–90 sec after machine and isolation work.' },
  { title: 'Log everything',
    text: 'Weight and reps, every set. Progression is impossible while you are guessing what you did last week.' },
  { title: 'Swaps',
    text: 'Machines vary by gym. If yours lacks one, use the listed alternate — do not rebuild the plan around it.' },
  { title: 'Patience',
    text: 'Hold the program 8–12 weeks. Weeks 1–2 are for finding working weights, roughly 20% lighter than you think. Swap only an exercise that has stalled 3+ weeks.' },
]

/** Why the week looks like this — shown once, under the rules. */
export const SCHEDULE_NOTE =
  'Sat upper, Sun lower, Wed full body. Back-to-back days cannot both be full-body, and Sat/Sun/Wed spaces recovery evenly instead of stacking three days then resting four. If a week forces Monday, take Monday — a suboptimal session beats a skipped one.'

export const sessionById = (id) => SESSIONS.find((s) => s.id === id)

/** The session scheduled for a JS weekday, or undefined on a rest day. */
export const sessionForWeekday = (dow) => SESSIONS.find((s) => s.weekday === dow)

/** Every exercise across every session, for history lookups. */
export const ALL_EXERCISES = SESSIONS.flatMap((s) =>
  s.exercises.map((e) => ({ ...e, sessionId: s.id })),
)

export const exerciseById = (id) => ALL_EXERCISES.find((e) => e.id === id)

/** Weight increment when the rep range is topped out. */
export const stepFor = (exercise) => exercise.step ?? 5
