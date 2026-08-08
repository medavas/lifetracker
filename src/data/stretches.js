/**
 * Stretch categories — a starting point, not the list.
 *
 * Same shape as the workout program: a category is a parent ITEM in
 * STRETCH_BUCKET and each stretch is one of its sub-items, so both are
 * renameable, reorderable and deletable from the UI. This file only seeds
 * the first set of categories; editing it afterwards changes nothing that
 * already exists.
 *
 * Categories seed EMPTY on purpose. Which stretches matter is the one part
 * of this nobody can guess for you, and a list of stretches you did not pick
 * is noise you would have to delete before the feature became useful.
 *
 * The defaults are named for what actually limits the lifts in the program —
 * hips and ankles cap Smith squat depth, hamstrings cap the RDL, and the
 * shoulder/t-spine work is what keeps benching and pressing healthy.
 */

/** The bucket that marks an item as a stretch category rather than tracking. */
export const STRETCH_BUCKET = 'Stretch categories'

export const DEFAULT_STRETCH_CATEGORIES = [
  'Hips & glutes',
  'Hamstrings',
  'Shoulders & chest',
  'Back & t-spine',
  'Calves & ankles',
]
