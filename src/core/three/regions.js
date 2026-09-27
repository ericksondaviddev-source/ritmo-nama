// Orden fijo: define el materialIndex de cada grupo (0=wood, 1=head, 2=trim)
export const REGION_ORDER = ['wood', 'head', 'trim'];

export function classifyVertex({ nx, ny, x, z }, opts = {}) {
  const { normalThreshold = 0.7, radiusThreshold = Infinity } = opts;
  if (Math.abs(ny) > normalThreshold) return 'head';
  if (Math.hypot(x, z) > radiusThreshold) return 'trim';
  return 'wood';
}

function majority(votes) {
  const tally = {};
  for (const v of votes) tally[v] = (tally[v] || 0) + 1;
  let best = REGION_ORDER[0];
  let bestN = -1;
  for (const region of REGION_ORDER) {
    const n = tally[region] || 0;
    if (n > bestN) {
      bestN = n;
      best = region;
    }
  }
  return best;
}

/**
 * Reordena el índice (en triplets = triángulos) agrupando por región.
 * Devuelve { index: Uint32Array, groups: [{region,start,count}], counts: {region: nº triángulos} }.
 * Nunca parte un triángulo: cada grupo es una cantidad de índices divisible por 3.
 */
export function partitionTriangles(index, positions, normals, opts = {}) {
  const buckets = { wood: [], head: [], trim: [] };
  const triCount = Math.floor(index.length / 3);
  for (let t = 0; t < triCount; t++) {
    const votes = [];
    for (let k = 0; k < 3; k++) {
      const vi = index[t * 3 + k];
      votes.push(
        classifyVertex(
          { nx: normals[vi * 3], ny: normals[vi * 3 + 1], x: positions[vi * 3], z: positions[vi * 3 + 2] },
          opts
        )
      );
    }
    const bucket = buckets[majority(votes)];
    bucket.push(index[t * 3], index[t * 3 + 1], index[t * 3 + 2]);
  }

  const out = new Uint32Array(index.length);
  const groups = [];
  const counts = {};
  let cursor = 0;
  for (const region of REGION_ORDER) {
    const arr = buckets[region];
    if (!arr.length) continue;
    out.set(arr, cursor);
    groups.push({ region, start: cursor, count: arr.length });
    counts[region] = arr.length / 3;
    cursor += arr.length;
  }
  return { index: out, groups, counts };
}
