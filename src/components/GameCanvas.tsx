import MapActions from 'actions/MapActions';
import { Building } from 'game_modules/build';
import config from 'game_modules/config';
import { Segment } from 'game_modules/mapgen';
import { calc, PathLocation } from 'generic_modules/astar';
import { Limit } from 'generic_modules/collision';
import { distanceToLine, fractionBetween, lengthV2, Vector2 } from 'generic_modules/math';
import { defaultFor } from 'generic_modules/utility';
import each from 'lodash-es/each';
import * as PIXI from 'pixi.js';
import React from 'react';
import { MapStore } from 'stores/MapStore';

import { Quadtree } from '../third_party/quadtree';


let pixiRenderer: PIXI.PixiRenderer | undefined = undefined;

// create an new instance of a pixi stage with a grey background
const stage = new PIXI.Stage(0x3D7228);
const heatmaps = new PIXI.DisplayObjectContainer();
const debugDrawables = new PIXI.DisplayObjectContainer();
const debugSegments = new PIXI.DisplayObjectContainer();
const debugMapData = new PIXI.DisplayObjectContainer();
const zoomContainer = new PIXI.DisplayObjectContainer();
const drawables = new PIXI.DisplayObjectContainer();

// for roads and buildings
const dynamicDrawables = new PIXI.DisplayObjectContainer();

stage.addChild(heatmaps);

debugDrawables.addChild(debugSegments);
debugDrawables.addChild(debugMapData);

drawables.addChild(dynamicDrawables);
zoomContainer.addChild(drawables);
stage.addChild(zoomContainer);

const routePartialSelectionMode = true;
let firstSelection = true;
let pathSelectionStart: PathLocation | undefined = undefined;

let segments: Segment[] = [];
let qTree: Quadtree<Limit<Segment | Building>> | undefined = undefined;
let heatmap: any = undefined;

let debugSegmentI: number | undefined = undefined;
let initialised = false;
let touchDown = false;
let diffX = 0;
let diffY = 0;
const cumulDiff = {
    x: 0,
    y: 0
};
let prevX: number | null = null;
let prevY: number | null = null;
let zoom = 0.01 * window.devicePixelRatio;
let debugDrawablesAdded = false;
let populationHeatMap: any = undefined;
let debugLinksGraphics: PIXI.DisplayObjectContainer | undefined = undefined;
let pathGraphics: PIXI.Graphics | undefined = undefined;
let pickupRangeIndicator: PIXI.Graphics | undefined = undefined;

const camera = {
    x: 0,
    y: -500,
    vx: 0,
    vy: 0
};

stage.touchstart = stage.mousedown = function (data) {
    touchDown = true;
    prevX = data.global.x;
    return prevY = data.global.y;
};

stage.touchend = stage.touchendoutside = stage.mouseup = stage.mouseupoutside = function (data) {
    touchDown = false;

    if (lengthV2(cumulDiff) <= config.gameLogic.SELECT_PAN_THRESHOLD) {
        // not the exact location of the beginning of the click, good enough
        clickEvent(data.global.x, data.global.y);
    }
    cumulDiff.x = 0;
    return cumulDiff.y = 0;
};

// --- debug graphics start ---
let graphics = new PIXI.Graphics();
graphics.lineStyle(4, PIXI.rgb2hex([0, 1, 0]));
graphics.moveTo(0, 50);
graphics.lineTo(0, 0);
graphics.lineStyle(4, PIXI.rgb2hex([1, 0, 1]));
graphics.moveTo(0, 0);
graphics.lineTo(50, 0);
debugDrawables.addChild(graphics);

function segmentsOnly(segmentsOrBuilds: Limit<Segment | Building>[]): Limit<Segment>[] {
    return segmentsOrBuilds.filter(sb => sb.o.hasOwnProperty('r')) as Limit<Segment>[];
}

function closestSegment(location: Vector2) {
    const { x, y } = location;
    const matches = segmentsOnly(qTree!.retrieve({
        x,
        y,
        width: 1,
        height: 1
    }));

    let minVal: number | undefined = undefined;
    let closestMatch: Limit<Segment> | undefined = undefined;
    let minDistance2: number | undefined = undefined;
    let matchFraction: number | undefined = undefined;
    each(matches, (match, i) => {
        const { distance2, lineProj2, length2 } = distanceToLine({ x, y }, (match.o as Segment).r.start, (match.o as Segment).r.end);
        const val = lineProj2 <= length2 && lineProj2 >= 0 ? distance2 : Number.POSITIVE_INFINITY;
        if (closestMatch == null || val < minVal!) {
            minVal = val;
            closestMatch = matches[i];
            minDistance2 = distance2;
            matchFraction = Math.sqrt(lineProj2) / match.o.length()!;
        }
    });

    return {
        closestMatch: closestMatch!,
        minDistance2: minDistance2!,
        matchFraction: matchFraction!
    };
}

var clickEvent = function (clickX: number, clickY: number) {
    const worldClick = {
        x: (clickX - zoomContainer.x) / zoom + camera.x,
        y: (clickY - zoomContainer.y) / zoom + camera.y
    };

    const { closestMatch, minDistance2, matchFraction } = closestSegment(worldClick);

    // draw mouse click
    graphics = new PIXI.Graphics();
    drawables.addChild(graphics);
    graphics.beginFill(0xFFFFFF, 1);
    graphics.drawCircle(worldClick.x, worldClick.y, 4);
    graphics.endFill();

    if (closestMatch != null && Math.sqrt(minDistance2!) * zoom < config.gameLogic.SELECTION_RANGE) {
        if (routePartialSelectionMode) {
            if (firstSelection) {
                pathSelectionStart = new PathLocation(closestMatch.o, matchFraction);
                firstSelection = false;
            } else {
                const pathSelectionEnd = new PathLocation(closestMatch.o, matchFraction);
                firstSelection = true;

                const path = calc().find(pathSelectionStart!, pathSelectionEnd);
                if (pathGraphics == null) {
                    pathGraphics = new PIXI.Graphics();
                    drawables.addChild(pathGraphics);
                } else if (pathGraphics.children.length > 0) {
                    pathGraphics.removeChildren();
                }

                each(path, pathSegment => pathGraphics!.addChild(drawSegment(pathSegment, 0xFFFFFF, 25)));
            }
        }

        console.log(`${segments.indexOf(closestMatch.o).toString()} clicked`);

        if (config.mapGeneration.DEBUG) {
            if (debugLinksGraphics) {
                debugDrawables.removeChild(debugLinksGraphics);
            }

            debugLinksGraphics = new PIXI.DisplayObjectContainer();
            closestMatch.o.debugLinks();
            debugLinksGraphics.addChild(drawSegment(closestMatch.o));
            each(closestMatch.o.links.f, link => debugLinksGraphics!.addChild(drawSegment(link)));
            each(closestMatch.o.links.b, link => debugLinksGraphics!.addChild(drawSegment(link)));
            return debugDrawables.addChild(debugLinksGraphics);
        }
    }
};

function drawSegment(segment: Segment, color?: number, width?: number) {
    color = defaultFor(color, segment.q.color);
    width = defaultFor(width, segment.width);

    graphics = new PIXI.Graphics();
    graphics.beginFill(0x000000, 0);
    graphics.lineStyle(width, color);

    graphics.drawCircle(segment.r.start.x, segment.r.start.y, 2);
    graphics.moveTo(segment.r.start.x, segment.r.start.y);
    graphics.lineTo(segment.r.end.x, segment.r.end.y);
    graphics.drawCircle(segment.r.end.x, segment.r.end.y, 2);
    graphics.endFill();
    return graphics;
};

var animate = function () {
    if (initialised) {
        let end, x, y;

        zoom = (zoom + MapStore.getTargetZoom()) / 2.0;

        zoomContainer.scale.x = zoom;
        zoomContainer.scale.y = zoom;

        if (config.mapGeneration.DRAW_HEATMAP && heatmap != null) {
            let asc, step;
            if (populationHeatMap == null) {
                populationHeatMap = new PIXI.Graphics();
                heatmaps.addChild(populationHeatMap);
            } else {
                populationHeatMap.clear();
            }
            const w = pixiRenderer!.width;
            const h = pixiRenderer!.height;

            for (x = 0, end = w, step = config.mapGeneration.HEAT_MAP_PIXEL_DIM, asc = step > 0; asc ? x < end : x > end; x += step) {
                var asc1, end1, step1;
                for (y = 0, end1 = h, step1 = config.mapGeneration.HEAT_MAP_PIXEL_DIM, asc1 = step1 > 0; asc1 ? y < end1 : y > end1; y += step1) {
                    const xSample = (x + config.mapGeneration.HEAT_MAP_PIXEL_DIM / 2 - zoomContainer.x) / zoom + camera.x;
                    const ySample = (y + config.mapGeneration.HEAT_MAP_PIXEL_DIM / 2 - zoomContainer.y) / zoom + camera.y;
                    const value = heatmap.populationAt(xSample, ySample);
                    populationHeatMap.beginFill(PIXI.rgb2hex([0, value, 0]));
                    populationHeatMap.drawRect(x, y, config.mapGeneration.HEAT_MAP_PIXEL_DIM, config.mapGeneration.HEAT_MAP_PIXEL_DIM);
                    populationHeatMap.endFill();
                }
            }
        } else if (populationHeatMap != null) {
            heatmaps.removeChild(populationHeatMap);
            populationHeatMap = undefined;
        }

        if (config.mapGeneration.DEBUG && !debugDrawablesAdded && debugDrawables != null) {
            debugDrawablesAdded = true;
            drawables.addChild(debugDrawables);
        } else if (!config.mapGeneration.DEBUG && debugDrawablesAdded && debugDrawables != null) {
            debugDrawablesAdded = false;
            drawables.removeChild(debugDrawables);
        }

        if (config.mapGeneration.DEBUG && debugSegmentI! < segments.length) {
            const toDraw = segments[debugSegmentI!++];
            debugSegments.addChild(drawSegment(toDraw, 0x77AA77, 25));
        } else if (!config.mapGeneration.DEBUG && debugSegmentI! > 0) {
            debugSegmentI = 0;
            if (debugSegments.children.length > 0) {
                debugSegments.removeChildren();
            }
        }

        const touchX = stage.getMousePosition().x;
        const touchY = stage.getMousePosition().y;

        if (routePartialSelectionMode) {
            if (pickupRangeIndicator == null) {
                pickupRangeIndicator = new PIXI.Graphics();
                pickupRangeIndicator.beginFill(0xFF0000, 0.3);
                pickupRangeIndicator.lineStyle(4, 0xFF0000);
                pickupRangeIndicator.drawCircle(0, 0, config.gameLogic.DEFAULT_PICKUP_RANGE);
                pickupRangeIndicator.endFill();
                drawables.addChild(pickupRangeIndicator);
            }
            const { closestMatch, minDistance2, matchFraction } = closestSegment({ x: (touchX - zoomContainer.x) / zoom + camera.x, y: (touchY - zoomContainer.y) / zoom + camera.y });
            if (closestMatch != null && minDistance2 <= config.gameLogic.DEFAULT_PICKUP_RANGE * config.gameLogic.DEFAULT_PICKUP_RANGE) {
                const matchPoint = fractionBetween(closestMatch.o.r.start, closestMatch.o.r.end, matchFraction);
                pickupRangeIndicator.x = matchPoint.x;
                pickupRangeIndicator.y = matchPoint.y;
            }
        }

        if (touchDown) {
            // check if outside area
            if (touchX > 0 && touchY > 0) {
                diffX = touchX - prevX!;
                diffY = touchY - prevY!;

                prevX = touchX;
                prevY = touchY;
            }

            cumulDiff.x += diffX;
            cumulDiff.y += diffY;

            // invert for swiping motion
            camera.vx = -diffX / zoom;
            camera.vy = -diffY / zoom;

            camera.x += camera.vx;
            camera.y += camera.vy;
        }

        if (!touchDown) {
            camera.x += camera.vx;
            camera.y += camera.vy;
            // stickiness
            camera.vx *= 0.8;
            camera.vy *= 0.8;
        }

        drawables.x = -camera.x;
        drawables.y = -camera.y;

        pixiRenderer!.render(stage);
    }

    return requestAnimationFrame(animate);
};

export class GameCanvas extends React.Component {

    private canvasContainerRef: React.RefObject<HTMLDivElement>;
    private canvasElRef: React.RefObject<HTMLCanvasElement>;

    constructor(props: any) {
        super(props);
        this.canvasContainerRef = React.createRef();
        this.canvasElRef = React.createRef();
    }

    componentDidMount() {
        MapStore.addChangeListener(this._onMapChange);

        const seed = new Date().getTime();
        console.log(`seed: ${seed.toString()}`);

        MapActions.generate(seed);

        const canvasContainer = this.canvasContainerRef.current;
        const canvasEl = this.canvasElRef.current;
        if (canvasContainer && canvasEl) {
            canvasEl.style.width = `${canvasContainer.offsetWidth}px`;
            canvasEl.style.height = `${canvasContainer.offsetHeight}px`;
            const rendererWidth = canvasContainer.offsetWidth * window.devicePixelRatio;
            const rendererHeight = canvasContainer.offsetHeight * window.devicePixelRatio;

            pixiRenderer = PIXI.autoDetectRenderer(rendererWidth, rendererHeight, { view: canvasEl, transparent: false, antialias: true });
            canvasContainer.appendChild(pixiRenderer.view);

            zoomContainer.x = pixiRenderer.width / 2;
            zoomContainer.y = pixiRenderer.height / 2;

            requestAnimationFrame(animate);

            return window.addEventListener('resize', this._handleResize);
        }
    }

    componentWillUnmount() {
        MapStore.removeChangeListener(this._onMapChange);
        return window.removeEventListener('resize', this._handleResize);
    }

    shouldComponentUpdate(nextProps: any, nextState: any) {
        return false;
    } // never update DOM, would destroy PIXI setup

    render() {
        return <div id="canvas-container" ref={this.canvasContainerRef}><canvas ref={this.canvasElRef} /></div>;
    }

    _handleResize = () => {
        const canvasContainer = this.canvasContainerRef.current;
        const canvasEl = this.canvasElRef.current;
        if (canvasContainer && canvasEl) {
            canvasEl.style.width = `${canvasContainer.offsetWidth}px`;
            canvasEl.style.height = `${canvasContainer.offsetHeight}px`;
            const rendererWidth = canvasContainer.offsetWidth * window.devicePixelRatio;
            const rendererHeight = canvasContainer.offsetHeight * window.devicePixelRatio;
            if (pixiRenderer != null) {
                pixiRenderer.resize(rendererWidth, rendererHeight);

                zoomContainer.x = pixiRenderer.width / 2;
                return zoomContainer.y = pixiRenderer.height / 2;
            }
        }
    }

    _onMapChange() {
        let building, i, segment;
        let end;
        let end1;

        if (pathGraphics != null && pathGraphics.children.length > 0) {
            pathGraphics.removeChildren();
        }

        if (dynamicDrawables.children.length > 0) {
            dynamicDrawables.removeChildren();
        }

        segments = MapStore.getSegments();
        qTree = MapStore.getQTree();
        heatmap = MapStore.getHeatmap();
        const debugData = MapStore.getDebugData();

        if (debugMapData.children.length > 0) {
            debugMapData.removeChildren();
        }

        debugSegmentI = 0;
        if (debugSegments.children.length > 0) {
            debugSegments.removeChildren();
        }

        each(debugData.snaps, function (point) {
            graphics = new PIXI.Graphics();
            graphics.beginFill(0x00FF00);
            graphics.moveTo(point.x, point.y);
            graphics.drawCircle(point.x, point.y, 20);
            graphics.endFill();
            return debugMapData.addChild(graphics);
        });

        each(debugData.intersectionsRadius, function (point) {
            graphics = new PIXI.Graphics();
            graphics.beginFill(0x0000FF);
            graphics.moveTo(point.x, point.y);
            graphics.drawCircle(point.x, point.y, 20);
            graphics.endFill();
            return debugMapData.addChild(graphics);
        });

        each(debugData.intersections, function (point) {
            graphics = new PIXI.Graphics();
            graphics.beginFill(0xFF0000);
            graphics.moveTo(point.x, point.y);
            graphics.drawCircle(point.x, point.y, 20);
            graphics.endFill();
            return debugMapData.addChild(graphics);
        });

        let buildings: Building[] = [];
        for (i = 0, end = segments.length; i < end; i += 10) {
            segment = segments[i];

            const newBuildings = Building.factory.aroundSegment(() => Building.factory.fromProbability(new Date().getTime()), segment, 10, 400, qTree!);
            for (building of newBuildings) {
                qTree!.insert(building.collider.limits()!);
            }
            buildings = buildings.concat(newBuildings);
        }

        for (building of buildings) {
            const buildingGraphics = new PIXI.Graphics();
            buildingGraphics.beginFill(0x0C161F);
            buildingGraphics.lineStyle(5, 0x555555);
            buildingGraphics.moveTo(building.corners[0].x, building.corners[0].y);
            buildingGraphics.lineTo(building.corners[1].x, building.corners[1].y);
            buildingGraphics.lineTo(building.corners[2].x, building.corners[2].y);
            buildingGraphics.lineTo(building.corners[3].x, building.corners[3].y);
            buildingGraphics.lineTo(building.corners[0].x, building.corners[0].y);
            dynamicDrawables.addChild(buildingGraphics);
        }

        for (i = 0, end1 = segments.length; i < end1; i++) {
            segment = segments[i];

            const lineColor = segment.q.color || 0xA1AFA9;

            dynamicDrawables.addChild(drawSegment(segment, lineColor));
        }

        return initialised = true;
    }
}
