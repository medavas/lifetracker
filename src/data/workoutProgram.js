/**
 * The strength program's STARTING POINT, and the rules behind it.
 *
 * This file is a seed, not the program. The live program is ITEMs: a session
 * is a parent item (bucket 'Sessions', carrying `weekday`) and each exercise
 * is one of its sub-items (carrying `sets`, `low`, `high`, `step`) — the same
 * one-level nesting Projects uses. That is what makes every part of it
 * editable at the gym: rename an exercise, change a rep range, move a day,
 * add or drop a movement, all without touching code.
 *
 * `DEFAULT_PROGRAM` below is only what `seedWorkoutProgram()` builds the first
 * time, and editing it afterwards changes nothing that already exists.
 *
 * The RULES are different, and deliberately stay static: they are the method
 * (how hard to push, how to progress, how long to hold a plan), not Ryan's
 * schedule. Nothing about a gym's machine selection changes what "1-2 reps
 * shy of failure" means.
 */

/** JS getDay(): Sun 0 … Sat 6. */
export const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
export const WEEKDAY_LONG = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
]

/**
 * Defaults for an exercise the user adds by hand, and the fallback for any
 * field a seeded one somehow lacks. `step` is the weight jump taken when the
 * rep range tops out, and it is SIGNED: negative means an assistance machine,
 * where less weight is more strength.
 */
export const EXERCISE_DEFAULTS = { sets: 3, low: 8, high: 12, step: 5 }

/** A program exercise item's spec, with every missing field defaulted. */
export const exerciseSpec = (item) => ({
  sets: item.sets ?? EXERCISE_DEFAULTS.sets,
  low: item.low ?? EXERCISE_DEFAULTS.low,
  high: item.high ?? EXERCISE_DEFAULTS.high,
  step: item.step ?? EXERCISE_DEFAULTS.step,
})

export const DEFAULT_PROGRAM = [
  {
    name: 'Upper Body',
    weekday: 6,
    exercises: [
      { title: 'Smith machine bench press', sets: 3, low: 6, high: 10, step: 5,
        details: 'Bar touches mid-chest, not your neck. Shoulder blades squeezed and pinned to the bench the whole set, feet flat. Lower ~2s, press without bouncing.' },
      { title: 'Lat pulldown', sets: 3, low: 8, high: 12, step: 10,
        details: 'Chest up, lean back ~15°, pull to your upper chest by driving the elbows down to your ribs. Torso swinging means it is too heavy.' },
      { title: 'Seated dumbbell shoulder press', sets: 3, low: 8, high: 12, step: 5,
        details: 'Start at ear height, press up and slightly in. Do not arch your lower back to grind reps out — that turns it into a bad incline press.' },
      { title: 'Seated cable row', sets: 3, low: 10, high: 12, step: 10,
        details: 'Swap: plate-loaded row. Sit tall, pull to the lower ribs, squeeze the shoulder blades at the end. No rowing-machine body swing.' },
      { title: 'Pec fly machine', sets: 2, low: 12, high: 15, step: 5,
        details: 'Slight bend in the elbows, think "hug a tree". Stretch at the back, do not slam the handles together at the front.' },
      { title: 'Cable curl', sets: 2, low: 12, high: 15, step: 5,
        details: 'Superset with the rope pushdown below. Elbows pinned to your sides, no swinging.' },
      { title: 'Rope pushdown', sets: 2, low: 12, high: 15, step: 5,
        details: 'Superset with the cable curl above. Elbows locked in place, spread the rope at the bottom.' },
    ],
  },
  {
    name: 'Lower Body',
    weekday: 0,
    exercises: [
      { title: 'Leg press', sets: 3, low: 8, high: 12, step: 10,
        details: 'Feet shoulder-width, middle of the platform. Lower to ~90° or slightly deeper, but stop before your lower back rolls off the pad. Knees track over toes, never cave in. No slamming into lockout.' },
      { title: 'Smith machine Romanian deadlift', sets: 3, low: 8, high: 10, step: 5,
        details: 'The most technical lift here and the best hamstring/glute builder the gym offers. Soft knees, push the hips straight back, bar slides down the thighs staying in contact. Flat back throughout. Stop at a strong hamstring stretch — depth comes from hip mobility, not back rounding.' },
      { title: 'Leg extension', sets: 3, low: 12, high: 15, step: 10,
        details: 'Full range, 1s squeeze at the top. Control the way down — the lowering is half the exercise.' },
      { title: 'Seated leg curl', sets: 3, low: 12, high: 15, step: 10,
        details: 'Swap: lying leg curl. Squeeze hard, lower slow, hips stay down on the seat.' },
      { title: 'Calf raise on leg press', sets: 3, low: 12, high: 15, step: 10,
        details: 'Swap: standing calf machine. Heels drop for a full stretch, pause 1s, full squeeze at the top. Bouncing is a wasted set.' },
      { title: 'Cable crunch', sets: 3, low: 12, high: 15, step: 5,
        details: 'Swap: ab machine. Crunch the ribs toward the hips — this is not a hip hinge.' },
    ],
  },
  {
    name: 'Full Body',
    weekday: 3,
    exercises: [
      { title: 'Smith machine squat', sets: 3, low: 6, high: 10, step: 10,
        details: 'Because the bar path is fixed, set your feet slightly in front of the bar so you can sit back. Bar on the upper traps, not the neck. Brace like you are about to be punched, at least parallel, drive up through mid-foot. Depth over weight, always.' },
      { title: 'Incline dumbbell press', sets: 3, low: 8, high: 12, step: 5,
        details: 'Bench at ~30°, same shoulder-blade rule as flat bench. Each side works independently — expect less weight than you think.' },
      { title: 'Assisted pull-up machine', sets: 3, low: 8, high: 12, step: -5,
        details: 'Swap: lat pulldown with a different grip from Saturday. Log the ASSIST weight — the step is negative because less assistance is progress. Full hang at the bottom, chin over the bar at the top.' },
      { title: 'Smith machine split squat (per leg)', sets: 2, low: 10, high: 10, step: 5,
        details: 'Swap: dumbbell walking lunge. Long stance, back foot on the toes, back knee straight down. The front leg does the work. These will hurt — that is the point.' },
      { title: 'Dumbbell lateral raise', sets: 2, low: 12, high: 15, step: 5,
        details: 'Light weight, strict form. Raise to shoulder height with a slight elbow bend, leading with the elbows. Shrugging or swinging means go lighter.' },
      { title: 'Back extension', sets: 2, low: 12, high: 15, step: 5,
        details: 'Bodyweight is fine — log 0. Controlled up, squeeze the glutes at the top, never hyperextend past straight.' },
    ],
  },
]

/** The standing rules — the method, not the schedule, so these stay fixed. */
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
    text: 'Machines vary by gym. If yours lacks one, edit that exercise to whatever it does have — keep the slot, change the movement.' },
  { title: 'Patience',
    text: 'Hold a plan 8–12 weeks. Weeks 1–2 are for finding working weights, roughly 20% lighter than you think. Swap only an exercise that has stalled 3+ weeks.' },
]

/** Why the default week looks like this. Reasoning, not a constraint. */
export const SCHEDULE_NOTE =
  'The starter split is Sat upper, Sun lower, Wed full body. Back-to-back days cannot both be full-body, and Sat/Sun/Wed spaces recovery evenly instead of stacking three days then resting four. Move any day to whatever your week actually allows — a suboptimal session beats a skipped one.'

/** The bucket that marks an item as a program session rather than tracking. */
export const SESSION_BUCKET = 'Sessions'
