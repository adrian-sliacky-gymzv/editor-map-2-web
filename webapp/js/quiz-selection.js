/* ------------------------------------------------------------------------- */
/* Original quiz/target selection helpers                                    */
/*                                                                           */
/* These mirror the ActionScript in mxm.exam.TestBase and mxm.exam.Test:     */
/* groups are cycled in order, only unused nodes can become the target, and   */
/* the candidate set is a random sample of the whole group with the target    */
/* pinned first. Distance and puzzle rounds use the same random sequence      */
/* without repetition.                                                       */
/* ------------------------------------------------------------------------- */

/**
 * Original TestBase.getRandomSeq: assign a random value to every node, pin the
 * required index to the first position, then sort by those values and slice.
 * The pinned index is used for quiz targets and is optional.
 */
export function randomSequence(total, count, pinnedIndex = -1, rng = Math.random) {
  const size = Math.max(0, Math.trunc(Number(total) || 0));
  const wanted = Math.max(0, Math.min(size, Math.trunc(Number(count) || 0)));
  if (!size || !wanted) return [];
  const values = Array.from({ length: size }, () => rng());
  if (pinnedIndex >= 0 && pinnedIndex < size) values[pinnedIndex] = 0;
  const indices = Array.from({ length: size }, (_, index) => index);
  indices.sort((a, b) => values[a] - values[b]);
  return indices.slice(0, wanted);
}

/**
 * Original Test.getNextGroup: advance to the next group, wrapping around, and
 * skip groups whose nodes have all been used. Returns -1 when every group is
 * exhausted (the original would loop forever, which cannot happen with a
 * question count capped at the total number of nodes).
 */
export function nextGroupIndex(currentIndex, groups) {
  if (!Array.isArray(groups) || !groups.length) return -1;
  let index = Number.isInteger(currentIndex) ? currentIndex : -1;
  for (let guard = 0; guard < groups.length; guard += 1) {
    index += 1;
    if (index >= groups.length) index = 0;
    const group = groups[index];
    if (!group || !Array.isArray(group.nodes)) continue;
    if (group.nodes.some((node) => !group.used?.has(node))) return index;
  }
  return -1;
}

/** Pick one unused node index, exactly like the original unusedNodes sample. */
export function pickUnusedIndex(nodes, used, rng = Math.random) {
  if (!Array.isArray(nodes) || !nodes.length) return -1;
  const unused = [];
  nodes.forEach((node, index) => {
    if (!used?.has(node)) unused.push(index);
  });
  if (!unused.length) return -1;
  return unused[Math.floor(rng() * unused.length)];
}

/** Build the candidate list: target first, then a random sample of the group. */
export function candidatesFor(nodes, chosenIndex, count, rng = Math.random) {
  if (!Array.isArray(nodes) || chosenIndex < 0 || chosenIndex >= nodes.length) return [];
  return randomSequence(nodes.length, count, chosenIndex, rng).map((index) => nodes[index]);
}
