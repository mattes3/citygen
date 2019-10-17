import assign from 'lodash-es/assign';
import maxBy from 'lodash-es/maxBy';
import minBy from 'lodash-es/minBy';

import {
    addPoints,
    distanceToLine,
    dotProduct,
    length2,
    lengthV,
    lengthV2,
    multVScalar,
    project,
    subtractPoints,
    Vector2,
} from './math';
import { extendedMax, extendedMin } from './utility';

// author: tmwhere.com

export type Limit<WrappedObject> = {
    x: number;
    y: number;
    width: number;
    height: number;
    o: WrappedObject;
}

type Point = {
    x: number;
    y: number;
}

type CollisionProperties = {
    corners?: Point[];
    start?: Point;
    end?: Point;
    width?: number;
    center?: Point;
    radius?: number;
}

export class CollisionObject<WrappedObject> {
    static Type = {
        RECT: "rect",
        LINE: "line",
        CIRCLE: "circle"
    };

    private collisionRevision: number;
    private limitsRevision: number | undefined;
    private cachedLimits: Limit<WrappedObject> | undefined;

    constructor(private o: WrappedObject, private collisionType: any, private collisionProperties: CollisionProperties) {
        this.collisionRevision = 0;
        this.limitsRevision = undefined;
        this.cachedLimits = undefined;
    }

    updateCollisionProperties(props: any) {
        this.collisionRevision++;
        return this.collisionProperties = assign(this.collisionProperties, props);
    }

    limits() {
        if (this.collisionRevision !== this.limitsRevision) {
            this.limitsRevision = this.collisionRevision;
            this.cachedLimits = (() => {
                switch (this.collisionType) {
                    case CollisionObject.Type.RECT:
                        var minX = minBy(this.collisionProperties.corners, 'x')!.x;
                        var minY = minBy(this.collisionProperties.corners, 'y')!.y;
                        return {
                            x: minX,
                            y: minY,
                            width: maxBy(this.collisionProperties.corners, 'x')!.x - minX,
                            height: maxBy(this.collisionProperties.corners, 'y')!.y - minY,
                            o: this.o
                        };
                    case CollisionObject.Type.LINE:
                        return {
                            x: Math.min(this.collisionProperties.start!.x, this.collisionProperties.end!.x),
                            y: Math.min(this.collisionProperties.start!.y, this.collisionProperties.end!.y),
                            width: Math.abs(this.collisionProperties.start!.x - this.collisionProperties.end!.x),
                            height: Math.abs(this.collisionProperties.start!.y - this.collisionProperties.end!.y),
                            o: this.o
                        };
                    case CollisionObject.Type.CIRCLE:
                        return {
                            x: this.collisionProperties.center!.x - this.collisionProperties.radius!,
                            y: this.collisionProperties.center!.y - this.collisionProperties.radius!,
                            width: this.collisionProperties.radius! * 2,
                            height: this.collisionProperties.radius! * 2,
                            o: this.o
                        };
                    default: throw new Error('Invalid collision type: ' + this.collisionType);
                }
            })();
        }

        return this.cachedLimits;
    }

    collide(other: CollisionObject<WrappedObject>): boolean | Vector2 {
        // avoid expensive collision check if possible
        const objLimits = this.limits();
        const otherLimits = other.limits();
        if ((objLimits != null) && (otherLimits != null) &&
            (((objLimits.x + objLimits.width) < otherLimits.x) || ((otherLimits.x + otherLimits.width) < objLimits.x)) &&
            (((objLimits.y + objLimits.height) < otherLimits.y) || ((otherLimits.y + otherLimits.height) < objLimits.y))) {
            return false;
        }

        switch (this.collisionType) {
            case CollisionObject.Type.CIRCLE:
                switch (other.collisionType) {
                    case CollisionObject.Type.RECT:
                        return this.rectCircleCollision(other.collisionProperties, this.collisionProperties);
                }
                break;
            case CollisionObject.Type.RECT:
                switch (other.collisionType) {
                    case CollisionObject.Type.RECT:
                        return this.rectRectIntersection(this.collisionProperties, other.collisionProperties);
                    case CollisionObject.Type.LINE:
                        return this.rectRectIntersection(this.collisionProperties, this.rectPropsFromLine(other.collisionProperties));
                    case CollisionObject.Type.CIRCLE:
                        return this.rectCircleCollision(this.collisionProperties, other.collisionProperties);
                }
                break;
            case CollisionObject.Type.LINE:
                switch (other.collisionType) {
                    case CollisionObject.Type.RECT:
                        return this.rectRectIntersection(this.rectPropsFromLine(this.collisionProperties), other.collisionProperties);
                    case CollisionObject.Type.LINE:
                        return this.rectRectIntersection(this.rectPropsFromLine(this.collisionProperties), this.rectPropsFromLine(other.collisionProperties));
                }
                break;
        }

        return false;
    }

    rectCircleCollision(rectProps: CollisionProperties, circleProps: CollisionProperties) {
        let i;
        let end1;
        let end2;
        const {
            corners
        } = rectProps;

        // check for corner intersections with circle
        for (i = 0, end1 = corners!.length; i < end1; i++) {
            if (length2(corners![i], circleProps.center!) <= (circleProps.radius! * circleProps.radius!)) {
                return true;
            }
        }

        // check for edge intersections with circle
        // from http://stackoverflow.com/a/1079478
        for (i = 0, end2 = corners!.length; i < end2; i++) {
            const start = corners![i];
            const end = corners![(i + 1) % corners!.length];
            const { distance2, lineProj2, length2 } = distanceToLine(circleProps.center!, start, end);
            if ((lineProj2 > 0) && (lineProj2 < length2) && (distance2 <= (circleProps.radius! * circleProps.radius!))) {
                return true;
            }
        }

        // check that circle is not enclosed by rectangle
        const axes = [
            subtractPoints(corners![3], corners![0]),
            subtractPoints(corners![3], corners![2])
        ];

        const projections = [
            project(subtractPoints(circleProps.center!, corners![0]), axes[0]),
            project(subtractPoints(circleProps.center!, corners![2]), axes[1])
        ];

        if ((projections[0].dotProduct < 0) || (lengthV2(projections[0].projected) > lengthV2(axes[0])) ||
            (projections[1].dotProduct < 0) || (lengthV2(projections[1].projected) > lengthV2(axes[1]))) {
            return false;
        }

        return true;
    }

    rectPropsFromLine(lineProps: CollisionProperties): CollisionProperties {
        const dir = subtractPoints(lineProps.end!, lineProps.start!);
        const perpDir = { x: -dir.y, y: dir.x };
        const halfWidthPerpDir = multVScalar(perpDir, (0.5 * lineProps.width!) / lengthV(perpDir));
        return {
            corners: [
                addPoints(lineProps.start!, halfWidthPerpDir),
                subtractPoints(lineProps.start!, halfWidthPerpDir),
                subtractPoints(lineProps.end!, halfWidthPerpDir),
                addPoints(lineProps.end!, halfWidthPerpDir)
            ]
        };
    }

    rectRectIntersection(rectAProps: CollisionProperties, rectBProps: CollisionProperties): false | Vector2 {

        const cA = rectAProps.corners!;
        const cB = rectBProps.corners!;
        // generate axes
        const axes = [
            subtractPoints(cA[3], cA[0]),
            subtractPoints(cA[3], cA[2]),
            subtractPoints(cB[0], cB[1]),
            subtractPoints(cB[0], cB[3])
        ];

        // list used to find axis with the minimum overlap
        // that axis is used as the response translation vector
        const axisOverlaps = [];

        for (let axis of axes) {
            // project rectangle points to axis
            var corner, v;
            const projectedVectorsA = [];
            const projectedVectorsB = [];

            for (corner of cA) {
                projectedVectorsA.push(project(corner, axis).projected);
            }
            for (corner of cB) {
                projectedVectorsB.push(project(corner, axis).projected);
            }

            // calculate relative positions of rectangles on axis
            const positionsOnAxisA = [];
            const positionsOnAxisB = [];

            for (v of projectedVectorsA) {
                positionsOnAxisA.push(dotProduct(v, axis));
            }
            for (v of projectedVectorsB) {
                positionsOnAxisB.push(dotProduct(v, axis));
            }

            const [maxA, maxA_i] = extendedMax(positionsOnAxisA);
            const [minA, minA_i] = extendedMin(positionsOnAxisA);
            const [maxB, maxB_i] = extendedMax(positionsOnAxisB);
            const [minB, minB_i] = extendedMin(positionsOnAxisB);
            // if the rectangles don't overlap on at least one axis
            // they are not colliding
            if ((maxA < minB) || (maxB < minA)) {
                return false;
            } else {
                // calculate the overlap between the rectangles on this axis
                const diff1 = subtractPoints(projectedVectorsA[maxA_i], projectedVectorsB[minB_i]);
                const diff2 = subtractPoints(projectedVectorsB[maxB_i], projectedVectorsA[minA_i]);

                if (lengthV2(diff1) < lengthV2(diff2)) {
                    axisOverlaps.push(diff1);
                } else {
                    // the rectangles overlap on the other side
                    // invert the vector so that it will push out of the collision
                    axisOverlaps.push(multVScalar(diff2, -1));
                }
            }
        }

        // find axis with the minimum overlap
        const minVector = minBy(axisOverlaps, v => lengthV2(v));

        // return displacement required to pull rectA from collision
        return multVScalar(minVector!, -1);
    }
}
