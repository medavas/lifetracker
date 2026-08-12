/**
 * Academia topics — replace the old Read/Watch/Listen buckets. A topic is a
 * parent ITEM in TOPIC_BUCKET and each entry (book, video, podcast, course,
 * whatever) is one of its sub-items, so both are renameable, reorderable
 * and deletable from the UI. This file only seeds the first set of topics;
 * editing it afterwards changes nothing that already exists.
 *
 * These seed populated — the subjects worth learning about are not
 * something only the user could guess. A topic that turns out unused can be
 * archived once it is empty, same as any other item.
 */

/** The bucket that marks an item as a topic rather than an entry filed under one. */
export const TOPIC_BUCKET = 'Academia topics'

export const DEFAULT_ACADEMIA_TOPICS = [
  'Design',
  'Physics',
  'AI',
  'Engineering',
  'Stoicism',
  'Music',
  'Metaphysics',
]
