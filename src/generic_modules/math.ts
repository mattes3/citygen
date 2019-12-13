/**
 * @author Peter Kelley
 * @author pgkelley4@gmail.com
 */

const Epsilon = 0.00000001;

export type Vector2 = {
    x: number;
    y: number;
};

/**
 * See if two line segments intersect. This uses the
 * vector cross product approach described below:
 * http://stackoverflow.com/a/565282/786339
 *
 * @param {Object} p point object with x and y coordinates
 *  representing the start of the 1st line.
 * @param {Object} p2 point object with x and y coordinates
 *  representing the end of the 1st line.
 * @param {Object} q point object with x and y coordinates
 *  representing the start of the 2nd line.
 * @param {Object} q2 point object with x and y coordinates
 *  representing the end of the 2nd line.
 */
export function doLineSegmentsIntersect(p: Vector2, p2: Vector2, q: Vector2, q2: Vector2, omitEnds: boolean) {
    var r = subtractPoints(p2, p);
    var s = subtractPoints(q2, q);

    var uNumerator = crossProduct(subtractPoints(q, p), r);
    var denominator = crossProduct(r, s);

    if (uNumerator === 0 && denominator === 0) {
        return false;
        // colinear, so do they overlap?
        // return ((q.x - p.x < 0) != (q.x - p2.x < 0) != (q2.x - p.x < 0) != (q2.x - p2.x < 0)) ||
        //   ((q.y - p.y < 0) != (q.y - p2.y < 0) != (q2.y - p.y < 0) != (q2.y - p2.y < 0));
    }

    if (denominator === 0) {
        // lines are paralell
        return false;
    }

    var u = uNumerator / denominator;
    var t = crossProduct(subtractPoints(q, p), s) / denominator;

    var doSegmentsIntersect;
    if (!omitEnds) {
        doSegmentsIntersect = (t >= 0) && (t <= 1) && (u >= 0) && (u <= 1);
    } else {
        doSegmentsIntersect = (t > 0.001) && (t < 1 - 0.001) && (u > 0.001) && (u < 1 - 0.001);
    }

    if (doSegmentsIntersect) {
        return { x: p.x + t * r.x, y: p.y + t * r.y, t: t }
    }

    return doSegmentsIntersect;
}

export function equalV(v1: Vector2, v2: Vector2) {
    var diff = subtractPoints(v1, v2);
    var length2 = lengthV2(diff);
    return length2 < Epsilon;
}

export function addPoints(point1: Vector2, point2: Vector2): Vector2 {
    return { x: point1.x + point2.x, y: point1.y + point2.y };
}

export function subtractPoints(point1: Vector2, point2: Vector2): Vector2 {
    return {
        x: point1.x - point2.x,
        y: point1.y - point2.y
    }
}

export function crossProduct(point1: Vector2, point2: Vector2) {
    return point1.x * point2.y - point1.y * point2.x;
}

export function dotProduct(point1: Vector2, point2: Vector2): number {
    return point1.x * point2.x + point1.y * point2.y;
}

export function length(point1: Vector2, point2: Vector2) {
    var v = subtractPoints(point2, point1);
    return lengthV(v);
}

export function length2(point1: Vector2, point2: Vector2) {
    var v = subtractPoints(point2, point1);
    return lengthV2(v);
}

export function lengthV(v: Vector2) {
    return Math.sqrt(lengthV2(v));
}

export function lengthV2(v: Vector2) {
    return v.x * v.x + v.y * v.y;
}

export function angleBetween(v1: Vector2, v2: Vector2) {
    const angleRad = Math.acos((v1.x * v2.x + v1.y * v2.y) /
        (lengthV(v1) * lengthV(v2)));
    const angleDeg = angleRad * 180 / Math.PI;
    return angleDeg;
}

export function sign(x: number) {
    if (x > 0) {
        return 1;
    } else if (x < 0) {
        return -1;
    } else {
        return 0;
    }
}

export function fractionBetween(v1: Vector2, v2: Vector2, fraction: number) {
    var v1ToV2 = subtractPoints(v2, v1);
    return { x: (v1.x + v1ToV2.x * fraction), y: (v1.y + v1ToV2.y * fraction) }
}

export function sinDegrees(deg: number) {
    return Math.sin(deg * Math.PI / 180);
}

export function cosDegrees(deg: number) {
    return Math.cos(deg * Math.PI / 180);
}

export function atanDegrees(val: number) {
    return Math.atan(val) * 180 / Math.PI;
}

/**
 * 
 * This is a seedable random number generator. It works like minstd_rand() in C++ 11, 
 * for the theory behind it, see http://www.firstpr.com.au/dsp/rand31/p1192-park.pdf
 */ 
const linearCongruentialGenerator = (seed: number) => () => ((2 ** 31 - 1) & (seed = Math.imul(48271, seed))) / 2 ** 31;

var currentRandom = linearCongruentialGenerator(42);

export function reseedRandom(seed: number): void {
    currentRandom = linearCongruentialGenerator(seed);
}

export function seededRandom(): number {
    return currentRandom();
}

export function randomRange(min: number, max: number) {
    return seededRandom() * (max - min) + min;
}

export function multVScalar(v: Vector2, n: number) {
    return { x: v.x * n, y: v.y * n };
}

export function divVScalar(v: Vector2, n: number) {
    return { x: v.x / n, y: v.y / n };
}

export function oldDistanceToLine(p: Vector2, q1: Vector2, q2: Vector2) {
    // https://en.wikipedia.org/wiki/Distance_from_a_point_to_a_line
    var qV = subtractPoints(q2, q1);
    var length = lengthV(qV);
    var qVNorm = divVScalar(qV, length);

    var eq2 = dotProduct(subtractPoints(q1, p), qVNorm);
    var qVNormMult = multVScalar(qVNorm, eq2);
    var vToLine = subtractPoints(subtractPoints(q1, p), qVNormMult);

    return {
        distance: lengthV(vToLine),
        pointOnLine: addPoints(p, vToLine),
        // distance along line of projected point
        lineProj: -eq2,
        length: length
    };
}

export function newDistanceToLine(P: Vector2, A: Vector2, B: Vector2) {
    var AP = subtractPoints(P, A);
    var AB = subtractPoints(B, A);
    var result = project(AP, AB);
    var AD = result.projected;
    var D = addPoints(A, AD);

    return {
        distance: length(D, P),
        pointOnLine: D,
        // distance along line of projected point
        lineProj: sign(result.dotProduct) * lengthV(AD),
        length: lengthV(AB)
    };
}

export function distanceToLine(P: Vector2, A: Vector2, B: Vector2) {
    var AP = subtractPoints(P, A);
    var AB = subtractPoints(B, A);
    var result = project(AP, AB);
    var AD = result.projected;
    var D = addPoints(A, AD);

    return {
        distance2: length2(D, P),
        pointOnLine: D,
        // distance along line of projected point
        lineProj2: sign(result.dotProduct) * lengthV2(AD),
        length2: lengthV2(AB)
    };
}

export function project(v: Vector2, onto: Vector2) {
    // http://en.wikipedia.org/wiki/Vector_projection
    const dProduct = dotProduct(v, onto);
    return {
        dotProduct: dProduct,
        projected: multVScalar(onto, dProduct / lengthV2(onto))
    }
}
