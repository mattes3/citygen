// author: tmwhere.com
import { Quadtree } from '../third_party/quadtree';
import { CollisionObject, Limit } from '../generic_modules/collision';
import { addPoints, atanDegrees, cosDegrees, randomRange, sinDegrees, Vector2 } from '../generic_modules/math';
import { defaultFor } from '../generic_modules/utility';
import config from './config';
import { Segment } from './mapgen';

export class Building {
    static Type = {
        RESIDENTIAL: "residential",
        IMPORT: "import"
    }

    static nextId = 0;

    private aspectDegree: number;
    //TODO: why must these be public?
    public corners: Vector2[];
    public collider: CollisionObject<Building>;
    private id: number;

    constructor(private center: Vector2, private dir: number, private diagonal: number, private type: string, aspectRatio: number) {
        aspectRatio = defaultFor(aspectRatio, 1);
        // degrees to deviate either end to produce desired aspect ratio
        this.aspectDegree = atanDegrees(aspectRatio);
        this.corners = this.generateCorners();

        this.collider = new CollisionObject<Building>(this, CollisionObject.Type.RECT, { corners: this.corners });

        this.id = Building.nextId++;
    }

    private generateCorners(): Vector2[] {
        return [
            { x: this.center.x + (this.diagonal * sinDegrees(+this.aspectDegree + this.dir)), y: this.center.y + (this.diagonal * cosDegrees(+this.aspectDegree + this.dir)) },
            { x: this.center.x + (this.diagonal * sinDegrees(-this.aspectDegree + this.dir)), y: this.center.y + (this.diagonal * cosDegrees(-this.aspectDegree + this.dir)) },
            { x: this.center.x + (this.diagonal * sinDegrees(180 + this.aspectDegree + this.dir)), y: this.center.y + (this.diagonal * cosDegrees(180 + this.aspectDegree + this.dir)) },
            { x: this.center.x + (this.diagonal * sinDegrees((180 - this.aspectDegree) + this.dir)), y: this.center.y + (this.diagonal * cosDegrees((180 - this.aspectDegree) + this.dir)) }
        ];
    }

    private setCenter(val: Vector2) {
        this.center = val;
        this.corners = this.generateCorners();
        this.collider.updateCollisionProperties({ corners: this.corners });
    }

    private setDir(val: number) {
        this.dir = val;
        this.corners = this.generateCorners();
        this.collider.updateCollisionProperties({ corners: this.corners });
    }

    static factory = {
        fromProbability(time: number): Building {
            if (Math.random() < 0.4) {
                return this.byType(Building.Type.IMPORT, time);
            } else {
                return this.byType(Building.Type.RESIDENTIAL, time);
            }
        },

        byType(type: string, time: number): Building {
            let building: Building | null;
            switch (type) {
                case Building.Type.RESIDENTIAL:
                    building = new Building({ x: 0, y: 0 }, 0, 80, Building.Type.RESIDENTIAL, randomRange(0.5, 2));
                    break;
                case Building.Type.IMPORT:
                    building = new Building({ x: 0, y: 0 }, 0, 150, Building.Type.IMPORT, randomRange(0.5, 2));
                    break;
                default:
                    building = null;
            }
            if (!building) {
                throw new Error('Unknown type of building');
            }
            return building!;
        },

        aroundSegment(buildingTemplate: () => Building, segment: Segment, count: number, radius: number, quadtree: Quadtree<Limit<Segment | Building>>): Building[] {
            const buildings: Building[] = [];
            for (let j = 0, i = j, end = count; j < end; j++ , i = j) {
                var end1;
                const randomAngle = Math.random() * 360;
                const randomRadius = Math.random() * radius;
                const buildingCenter = {
                    x: (0.5 * (segment.r.start.x + segment.r.end.x)) + (randomRadius * sinDegrees(randomAngle)),
                    y: (0.5 * (segment.r.start.y + segment.r.end.y)) + (randomRadius * cosDegrees(randomAngle))
                };
                const building = buildingTemplate();
                building.setCenter(buildingCenter);
                building.setDir(segment.dir()!);

                let permitBuilding = false;
                for (i = 0, end1 = config.mapGeneration.BUILDING_PLACEMENT_LOOP_LIMIT; i < end1; i++) {
                    let collisionCount = 0;
                    // must query quadtree here, since building limits may have changed due to collision in previous iteration
                    let potentialCollisions: { collider: CollisionObject<any> }[] = quadtree.retrieve(building.collider.limits()!).map(coll => coll.o);
                    potentialCollisions = potentialCollisions.concat(buildings);
                    for (let obj of potentialCollisions) {
                        const result = building.collider.collide(obj.collider);
                        if (result !== false) {
                            collisionCount += 1;
                            // no point continuing if on final loop
                            if (i === (config.mapGeneration.BUILDING_PLACEMENT_LOOP_LIMIT - 1)) {
                                break;
                            }

                            // shift building to avoid colliding with existing object
                            building.setCenter(addPoints(building.center, result as Vector2));
                        }
                    }

                    // no further checks necessary
                    if (collisionCount === 0) {
                        permitBuilding = true;
                        break;
                    }
                }

                if (permitBuilding) {
                    buildings.push(building);
                }
            }

            return buildings;
        }

    }
}
