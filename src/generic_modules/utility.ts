import each from 'lodash-es/each';
import findIndex from 'lodash-es/findIndex';
import cloneDeep from 'lodash-es/cloneDeep';

export function defaultFor(arg: any, val: any, deep: boolean = false) {
    const argCopy = deep ? cloneDeep(arg) : arg;
    const valCopy = deep ? cloneDeep(val) : val;
    if (typeof arg !== 'undefined') { return argCopy; } else { return valCopy; }
}

export function oinArrayGeneric(array: any[], joinElement: any) {
    const copy = array.slice(0);
    for (let i = 1, end = (copy.length * 2) - 1; i < end; i += 2) {
        copy.splice(i, 0, joinElement);
    }
    return copy;
}

export function addArrayPushListener(array: any[], callback: () => void) {
    return array.push = function () {
        for (let i = 0, end = arguments.length - 1; i <= end; i++) {
            this[this.length] = arguments[i];
            callback();
        }
        return this.length;
    };
}

export function minDegreeDifference(d1: number, d2: number): number {
    const diff = Math.abs(d1 - d2) % 180;
    return Math.min(diff, Math.abs(diff - 180));
}

export function extendedMin(collection: any, selector: (x: any) => any = (obj) => obj) {
    let minObj = undefined as any;
    let minObj_i = 0;
    each(collection, (obj: any, i: number) => {
        if ((minObj == null) || (selector(obj) < selector(minObj))) {
            minObj = obj;
            minObj_i = i;
        }
    });
    return [minObj, minObj_i];
}

export function extendedMax(collection: any, selector: (x: any) => any = (obj) => obj) {
    let maxObj = undefined as any;
    let maxObj_i = 0;
    each(collection, (obj: any, i: number) => {
        if ((maxObj == null) || (selector(obj) > selector(maxObj))) {
            maxObj = obj;
            maxObj_i = i;
        }
    });
    return [maxObj, maxObj_i];
}

type PriorityQueueEntry = {
    item: any;
    priority: number;
}

export class PriorityQueue {
    private list: PriorityQueueEntry[];

    constructor() {
        this.list = [];
    }

    put(item: any, priority: number): void {
        const newPair = {
            item,
            priority
        };

        const index = findIndex(this.list, pair => pair.priority > newPair.priority);
        if (index === - 1) {
            this.list.push(newPair);
        } else {
            this.list.splice(index, 0, newPair);
        }
    }

    get() {
        return this.list.shift()!.item;
    }

    length() {
        return this.list.length;
    }
};
