import { PriorityQueue } from './utility';

// author: tmwhere.com

export class PathLocation {
    constructor(private o: any, private fraction: number) { }

    static calc() {
        const cost = function (current: any, next: any, start: PathLocation, end: PathLocation) {
            let fraction;
            let currentFraction = undefined;
            let nextFraction = undefined;
            if (start.o === end.o) {
                fraction = Math.abs(start.fraction - end.fraction);
                return fraction * current.cost();
            } else {
                if (current === start.o) {
                    currentFraction = start.fraction;
                }
                if (next === end.o) {
                    nextFraction = end.fraction;
                }
            }
            return current.costTo(next, currentFraction) + next.costTo(current, nextFraction);
        };

        return {
            find(start: PathLocation, end: PathLocation) {
                let current;
                const frontier = new PriorityQueue();
                frontier.put(start.o, 0);
                const came_from = new Map();
                came_from.set(start.o, null);
                const cost_so_far = new Map();
                cost_so_far.set(start.o, 0);

                while (frontier.length() > 0) {
                    current = frontier.get();

                    if (current === end.o) {
                        break;
                    }

                    for (let next of current.neighbours()) {
                        const new_cost = cost_so_far.get(current) + cost(current, next, start, end);
                        if ((cost_so_far.get(next) == null) || (new_cost < cost_so_far.get(next))) {
                            cost_so_far.set(next, new_cost);
                            const priority = new_cost; // + heuristic(goal, next)
                            frontier.put(next, priority);
                            came_from.set(next, current);
                        }
                    }
                }

                console.log(`path cost: ${cost_so_far.get(end.o)}`);
                // reconstruct path
                current = end.o;
                const path = [current];
                while (current !== start.o) {
                    current = came_from.get(current);
                    path.unshift(current);
                }

                return path;
            }
        }
    }
}

export const calc = PathLocation.calc;
