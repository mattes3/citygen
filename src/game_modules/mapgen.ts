// author: tmwhere.com
import cloneDeep from 'lodash-es/cloneDeep';
import each from 'lodash-es/each';
import some from 'lodash-es/some';

import { Quadtree } from '../third_party/quadtree';
import { CollisionObject, Limit } from '../generic_modules/collision';
import {
    angleBetween,
    cosDegrees,
    crossProduct,
    distanceToLine,
    doLineSegmentsIntersect,
    equalV,
    length,
    sign,
    sinDegrees,
    subtractPoints,
    Vector2,
} from '../generic_modules/math';
import { defaultFor, minDegreeDifference } from '../generic_modules/utility';
import config from './config';
import SimplexNoise from 'simplex-noise';

var random: () => number = Math.random;
var noise: SimplexNoise;

const heatmap = {
    popOnRoad(r: Road) {
        return (this.populationAt(r.start.x, r.start.y) + this.populationAt(r.end.x, r.end.y)) / 2;
    },
    populationAt(x: number, y: number) {
        const value1 = (noise.noise2D(x / 10000, y / 10000) + 1) / 2;
        const value2 = (noise.noise2D((x / 20000) + 500, (y / 20000) + 500) + 1) / 2;
        const value3 = (noise.noise2D((x / 20000) + 1000, (y / 20000) + 1000) + 1) / 2;
        return Math.pow(((value1 * value2) + value3) / 2, 2);
    }
}

type MetaInfo = {
    highway: boolean;
    color: number;
    severed: boolean;
}

type Road = {
    start: Vector2;
    end: Vector2;
    setStart(val: Vector2): void;
    setEnd(val: Vector2): void;
}

type DebugData = {
    intersections?: Vector2[];
    intersectionsRadius?: Vector2[];
    snaps?: Vector2[];
}

enum SegmentEndKind {
    START = 'start',
    END = 'end'
}

export class Segment {

    public id: number = -1;

    // TODO: why must these be public?
    public r: Road;
    public q: MetaInfo;

    private t: number;

    private users: any[];
    private maxSpeed: number;
    private capacity: number;

    // TODO: why must these be public?
    public width: number;
    public collider: CollisionObject<Segment>;
    public links: { b: Segment[], f: Segment[] };

    private roadRevision: number;
    private dirRevision: number | undefined;
    private lengthRevision: number | undefined;
    private cachedDir: number | undefined;
    private cachedLength: number | undefined;

    private setupBranchLinks?: () => void;

    constructor(start: Vector2, end: Vector2, t?: number, q?: MetaInfo) {
        const obj = this;

        start = cloneDeep(start);
        end = cloneDeep(end);
        t = defaultFor(t, 0);
        q = defaultFor(q, {}, true);

        this.width = q!.highway ? config.mapGeneration.HIGHWAY_SEGMENT_WIDTH : config.mapGeneration.DEFAULT_SEGMENT_WIDTH;
        this.collider = new CollisionObject<Segment>(this, CollisionObject.Type.LINE, { start, end, width: this.width });

        this.roadRevision = 0;
        this.dirRevision = undefined;
        this.lengthRevision = undefined;

        this.cachedDir = undefined;
        this.cachedLength = undefined;

        // representation of road
        this.r = {
            start,
            end,
            setStart(val) {
                this.start = val;
                obj.collider.updateCollisionProperties({ start: this.start });
                return obj.roadRevision++;
            },
            setEnd(val) {
                this.end = val;
                obj.collider.updateCollisionProperties({ end: this.end });
                return obj.roadRevision++;
            }
        };

        // time-step delay before this road is evaluated
        this.t = t!;
        // meta-information relevant to global goals
        this.q = q!;
        // links backwards and forwards
        this.links = {
            b: [],
            f: []
        };

        this.users = [];
        [this.maxSpeed, this.capacity] = q!.highway ? [1200, 12] : [800, 6];
    }

    currentSpeed() {
        // subtract 1 from users length so that a single user can go full speed
        return Math.min(config.gameLogic.MIN_SPEED_PROPORTION, 1 - (Math.max(0, this.users.length - 1) / this.capacity)) * this.maxSpeed;
    }

    // clockwise direction
    dir() {
        if (this.dirRevision !== this.roadRevision) {
            this.dirRevision = this.roadRevision;
            const vector = subtractPoints(this.r.end, this.r.start);
            this.cachedDir = -1 * sign(crossProduct({ x: 0, y: 1 }, vector)) * angleBetween({ x: 0, y: 1 }, vector);
        }
        return this.cachedDir;
    }

    length() {
        if (this.lengthRevision !== this.roadRevision) {
            this.lengthRevision = this.roadRevision;
            this.cachedLength = length(this.r.start, this.r.end);
        }
        return this.cachedLength;
    }

    debugLinks() {
        this.q.color = 0x00FF00;
        each(this.links.b, backwards => backwards.q.color = 0xFF0000);
        return each(this.links.f, forwards => forwards.q.color = 0x0000FF);
    }

    startIsBackwards() {
        if (this.links.b.length > 0) {
            return equalV(this.links.b[0].r.start, this.r.start) ||
                equalV(this.links.b[0].r.end, this.r.start);
        } else {
            return equalV(this.links.f[0].r.start, this.r.end) ||
                equalV(this.links.f[0].r.end, this.r.end);
        }
    }

    cost() {
        return this.length()! / this.currentSpeed();
    }

    costTo(other: Segment, fromFraction?: number) {
        const segmentEnd = this.endContaining(other);

        function fraction() {
            if (fromFraction !== undefined) {
                switch (segmentEnd) {
                    case SegmentEndKind.START: return fromFraction;
                    case SegmentEndKind.END: return (1 - fromFraction);
                    default: return 0.5;
                }
            }
            else {
                return 0.5;
            }
        }

        return this.cost() * fraction();
    }

    neighbours() {
        return this.links.f.concat(this.links.b);
    }

    endContaining(segment: Segment) {
        const startBackwards = this.startIsBackwards();
        if (this.links.b.indexOf(segment) !== -1) {
            if (startBackwards) { return SegmentEndKind.START; } else { return SegmentEndKind.END; }
        } else if (this.links.f.indexOf(segment) !== -1) {
            if (startBackwards) { return SegmentEndKind.END; } else { return SegmentEndKind.START; }
        } else {
            return undefined;
        }
    }

    linksForEndContaining(segment: Segment) {
        if (this.links.b.indexOf(segment) !== -1) {
            return this.links.b;
        } else if (this.links.f.indexOf(segment) !== -1) {
            return this.links.f;
        } else {
            return undefined;
        }
    }

    split(point: Vector2, segment: Segment, segmentList: Segment[], qTree: Quadtree<Limit<Segment>>) {
        let firstSplit, fixLinks: Segment[], secondSplit;
        const startIsBackwards = this.startIsBackwards();

        const splitPart = Segment.segmentFactory.fromExisting(this);
        splitPart.addSegment(segmentList, qTree);
        splitPart.r.setEnd(point);
        this.r.setStart(point);

        // links are not copied using the preceding factory method
        // copy link array for the split part, keeping references the same
        splitPart.links.b = this.links.b.slice(0);
        splitPart.links.f = this.links.f.slice(0);

        // work out which links correspond to which end of the split segment
        if (startIsBackwards) {
            firstSplit = splitPart;
            secondSplit = this;
            fixLinks = splitPart.links.b;
        } else {
            firstSplit = this;
            secondSplit = splitPart;
            fixLinks = splitPart.links.f;
        }

        each(fixLinks, (link: Segment) => {
            let index = link.links.b.indexOf(this);
            if (index !== -1) {
                return link.links.b[index] = splitPart;
            } else {
                index = link.links.f.indexOf(this);
                return link.links.f[index] = splitPart;
            }
        });

        firstSplit.links.f = [];
        firstSplit.links.f.push(segment);
        firstSplit.links.f.push(secondSplit);

        secondSplit.links.b = [];
        secondSplit.links.b.push(segment);
        secondSplit.links.b.push(firstSplit);

        segment.links.f.push(firstSplit);
        return segment.links.f.push(secondSplit);
    }

    static segmentFactory = {
        fromExisting(segment: Segment, t?: number, r?: Road, q?: MetaInfo): Segment {
            t = defaultFor(t, segment.t);
            r = defaultFor(r, segment.r);
            q = defaultFor(q, segment.q);

            return new Segment(r!.start, r!.end, t!, q!);
        },

        usingDirection(start: Vector2, dir: number, length: number, t: number, q?: MetaInfo): Segment {
            // default to east
            dir = defaultFor(dir, 90);
            length = defaultFor(length, config.mapGeneration.DEFAULT_SEGMENT_LENGTH);

            const end = {
                x: start.x + (length * sinDegrees(dir)),
                y: start.y + (length * cosDegrees(dir))
            };
            return new Segment(start, end, t, q);
        }
    }

    static localConstraints(segment: Segment, segments: Segment[], qTree: Quadtree<Limit<Segment>>, debugData: DebugData) {
        interface QAction {
            priority: number;
            func?: () => boolean;
            q: {
                t?: number;
            }
        };

        const action: QAction = {
            priority: 0,
            func: undefined,
            q: {}
        };

        const matches = qTree.retrieve(segment.collider.limits()!);
        for (let i = 0, end = matches.length - 1; i <= end; i++) {
            const other = matches[i].o;

            // intersection check
            if (action.priority <= 4) {
                const intersection = doRoadSegmentsIntersect(segment.r, other.r);
                if (intersection) {
                    if ((action.q.t == null) || (intersection.t < action.q.t)) {
                        action.q.t = intersection.t;

                        (function (other, intersection) {
                            action.priority = 4;
                            return action.func = function () {
                                // if intersecting lines are too similar don't continue
                                if (minDegreeDifference(other.dir()!, segment.dir()!) < config.mapGeneration.MINIMUM_INTERSECTION_DEVIATION) {
                                    return false;
                                }

                                other.split(intersection, segment, segments, qTree);
                                segment.r.end = intersection;
                                segment.q.severed = true;

                                if (debugData != null) {
                                    if (!debugData.intersections) {
                                        debugData.intersections = [];
                                    }
                                    debugData.intersections.push({
                                        x: intersection.x,
                                        y: intersection.y
                                    });
                                }

                                return true;
                            };
                        })(other, intersection);
                    }
                }
            }

            // snap to crossing within radius check
            if (action.priority <= 3) {
                // current segment's start must have been checked to have been created.
                // other segment's start must have a corresponding end.
                if (length(segment.r.end, other.r.end) <= config.mapGeneration.ROAD_SNAP_DISTANCE) {

                    (function (other) {
                        const point = other.r.end;
                        action.priority = 3;
                        return action.func = function () {
                            segment.r.end = point;
                            segment.q.severed = true;

                            // update links of otherSegment corresponding to other.r.end
                            const links = other.startIsBackwards() ? other.links.f : other.links.b;
                            // check for duplicate lines, don't add if it exists
                            // this should be done before links are setup, to avoid having to undo that step
                            if (some(links, link => (equalV(link.r.start, segment.r.end) && equalV(link.r.end, segment.r.start)) ||
                                (equalV(link.r.start, segment.r.start) && equalV(link.r.end, segment.r.end)))) {
                                return false;
                            }

                            each(links, function (link) {
                                // pick links of remaining segments at junction corresponding to other.r.end
                                link.linksForEndContaining(other)!.push(segment);

                                // add junction segments to snapped segment
                                return segment.links.f.push(link);
                            });

                            links.push(segment);
                            segment.links.f.push(other);

                            if (debugData != null) {
                                if (!debugData.snaps) {
                                    debugData.snaps = [];
                                }
                                debugData.snaps.push({
                                    x: point.x,
                                    y: point.y
                                });
                            }

                            return true;
                        };
                    })(other);
                }
            }

            // intersection within radius check
            if (action.priority <= 2) {

                var { distance2, pointOnLine, lineProj2, length2 } = distanceToLine(segment.r.end, other.r.start, other.r.end);
                if ((distance2 < (config.mapGeneration.ROAD_SNAP_DISTANCE * config.mapGeneration.ROAD_SNAP_DISTANCE)) &&
                    (lineProj2 >= 0) && (lineProj2 <= length2)) {

                    const point = pointOnLine;
                    action.priority = 2;
                    return action.func = function () {
                        segment.r.end = point;
                        segment.q.severed = true;

                        // if intersecting lines are too similar don't continue
                        if (minDegreeDifference(other.dir()!, segment.dir()!) < config.mapGeneration.MINIMUM_INTERSECTION_DEVIATION) {
                            return false;
                        }

                        other.split(point, segment, segments, qTree);

                        if (debugData != null) {
                            if (!debugData.intersectionsRadius) {
                                debugData.intersectionsRadius = [];
                            }
                            debugData.intersectionsRadius.push({
                                x: point.x,
                                y: point.y
                            });
                        }

                        return true;
                    };
                }
            }
        }

        return (action.func && action.func()) || true;
    };

    static globalGoals = {
        generate(previousSegment: Segment) {
            const newBranches: Segment[] = [];
            if (!previousSegment.q.severed) {

                const template = (direction: number, length: number, t: number, q?: MetaInfo) => Segment.segmentFactory.usingDirection(previousSegment.r.end, direction, length, t, q);

                // used for highways or going straight on a normal branch
                const templateContinue = (direction: number) => template(direction, previousSegment.length()!, 0, previousSegment.q);
                // not using q, i.e. not highways
                const templateBranch = (direction: number) => template(direction, config.mapGeneration.DEFAULT_SEGMENT_LENGTH, previousSegment.q.highway ? config.mapGeneration.NORMAL_BRANCH_TIME_DELAY_FROM_HIGHWAY : 0);

                const continueStraight = templateContinue(previousSegment.dir()!);
                const straightPop = heatmap.popOnRoad(continueStraight.r);

                if (previousSegment.q.highway) {
                    let roadPop;
                    const randomStraight = templateContinue(previousSegment.dir()! + config.mapGeneration.RANDOM_STRAIGHT_ANGLE());

                    const randomPop = heatmap.popOnRoad(randomStraight.r);
                    if (randomPop > straightPop) {
                        newBranches.push(randomStraight);
                        roadPop = randomPop;
                    }
                    else {
                        newBranches.push(continueStraight);
                        roadPop = straightPop;
                    }
                    if (roadPop > config.mapGeneration.HIGHWAY_BRANCH_POPULATION_THRESHOLD) {

                        if (Math.random() < config.mapGeneration.HIGHWAY_BRANCH_PROBABILITY) {
                            const leftHighwayBranch = templateContinue((previousSegment.dir()! - 90) + config.mapGeneration.RANDOM_BRANCH_ANGLE());
                            newBranches.push(leftHighwayBranch);
                        }
                        else if (Math.random() < config.mapGeneration.HIGHWAY_BRANCH_PROBABILITY) {
                            const rightHighwayBranch = templateContinue(previousSegment.dir()! + 90 + config.mapGeneration.RANDOM_BRANCH_ANGLE());
                            newBranches.push(rightHighwayBranch);
                        }
                    }

                } else if (straightPop > config.mapGeneration.NORMAL_BRANCH_POPULATION_THRESHOLD) {
                    newBranches.push(continueStraight);
                }

                if (straightPop > config.mapGeneration.NORMAL_BRANCH_POPULATION_THRESHOLD) {
                    if (Math.random() < config.mapGeneration.DEFAULT_BRANCH_PROBABILITY) {
                        const leftBranch = templateBranch((previousSegment.dir()! - 90) + config.mapGeneration.RANDOM_BRANCH_ANGLE());
                        newBranches.push(leftBranch);
                    }
                    else if (Math.random() < config.mapGeneration.DEFAULT_BRANCH_PROBABILITY) {
                        const rightBranch = templateBranch(previousSegment.dir()! + 90 + config.mapGeneration.RANDOM_BRANCH_ANGLE());
                        newBranches.push(rightBranch);
                    }
                }
            }

            for (let i = 0, end = newBranches.length - 1; i <= end; i++) {
                ((branch => branch.setupBranchLinks = function () {
                    // setup links between each current branch and each existing branch stemming from the previous segment
                    each(previousSegment.links.f, link => {
                        branch.links.b.push(link);
                        link.linksForEndContaining(previousSegment)!.push(branch);
                    });
                    previousSegment.links.f.push(branch);
                    return branch.links.b.push(previousSegment);
                }))(newBranches[i]);
            }

            return newBranches;
        }
    }

    public addSegment(segmentList: Segment[], qTree: Quadtree<Limit<Segment>>): void {
        segmentList.push(this);
        qTree.insert(this.collider.limits()!);
    }

    static generate(seed: number) {
        const debugData: DebugData = {};

        noise = new SimplexNoise('' + seed);

        const priorityQ = [];
        // setup first segments in queue
        const rootSegment = new Segment({ x: 0, y: 0 }, { x: config.mapGeneration.HIGHWAY_SEGMENT_LENGTH, y: 0 }, 0, { highway: true, color: 0, severed: false });
        const oppositeDirection = Segment.segmentFactory.fromExisting(rootSegment);
        const newEnd = {
            x: rootSegment.r.start.x - config.mapGeneration.HIGHWAY_SEGMENT_LENGTH,
            y: oppositeDirection.r.end.y
        };
        oppositeDirection.r.setEnd(newEnd);
        oppositeDirection.links.b.push(rootSegment);
        rootSegment.links.b.push(oppositeDirection);
        priorityQ.push(rootSegment);
        priorityQ.push(oppositeDirection);

        const segments: Segment[] = [];
        const qTree = new Quadtree<Limit<Segment>>(config.mapGeneration.QUADTREE_PARAMS,
            config.mapGeneration.QUADTREE_MAX_OBJECTS, config.mapGeneration.QUADTREE_MAX_LEVELS);

        while ((priorityQ.length > 0) && (segments.length < config.mapGeneration.SEGMENT_COUNT_LIMIT)) {
            // pop smallest r(ti, ri, qi) from Q (i.e., smallest ‘t’)
            let minT = 1e10;
            let minT_i = 0;
            each(priorityQ, function (segment, i) {
                if (segment.t < minT) {
                    minT = segment.t;
                    return minT_i = i;
                }
            });

            let minSegment = priorityQ.splice(minT_i, 1)[0];

            const accepted = Segment.localConstraints(minSegment, segments, qTree, debugData);
            if (accepted) {
                if (minSegment.setupBranchLinks != null) {
                    minSegment.setupBranchLinks();
                }
                minSegment.addSegment(segments, qTree);
                each(Segment.globalGoals.generate(minSegment), (newSegment) => {
                    newSegment.t = minSegment.t + 1 + newSegment.t;
                    priorityQ.push(newSegment);
                });
            }
        }

        let id = 0;
        for (let segment of segments) {
            segment.id = id++;
        }

        console.log(`${segments.length} segments generated.`);

        return {
            segments,
            qTree,
            heatmap,
            debugData
        };
    }
}

function doRoadSegmentsIntersect(r1: Road, r2: Road) {
    return doLineSegmentsIntersect(r1.start, r1.end, r2.start, r2.end, true);
}

export function generate(seed: number) {
    return Segment.generate(seed);
}
