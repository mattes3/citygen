import { Dispatcher } from 'flux';

import { Action } from '../dispatcher/AppDispatcher';
import { ActionTypes } from '../dispatcher/Constants';
import { FluxStore } from './FluxStore';
import { generate } from '../game_modules/mapgen';
import { AppDispatcher } from '../dispatcher/AppDispatcher';

type MapState = {
    _segments: any[];
    _segmentsById: {
        [index: string]: any;
    }
    _qTree: any;
    _heatmap: any;
    _debugData: any;
    _targetZoom: number;
}

class MapStoreClass extends FluxStore<MapState> {

    constructor(dispatcher: Dispatcher<Action>) {

        const onDispatch = (action: Action) => {
            switch (action.action.actionType) {
                case ActionTypes.MAP_GENERATE:
                    var { segments, qTree, heatmap, debugData } = generate(action.action.seed);
                    this._state._segments = segments;
                    this._state._qTree = qTree;
                    this._state._heatmap = heatmap;
                    this._state._debugData = debugData;

                    this._state._segmentsById = {};
                    for (let segment of segments) {
                        this._state._segmentsById[segment.id] = segment;
                    }
                    this.emitChange();
                    break;
                case ActionTypes.MAP_FACTOR_TARGET_ZOOM:
                    this._state._targetZoom = this._state._targetZoom * action.action.factor;
                    this.emitChange();
                    break;
            }
        }

        super(dispatcher, onDispatch, () => ({
            _segments: [],
            _segmentsById: {},
            _qTree: undefined,
            _heatmap: undefined,
            _debugData: undefined,
            _targetZoom: 0.05 * window.devicePixelRatio
        }));
    }


    public get(id: any) {
        return this._state._segmentsById[id];
    }

    // NB: returns an array, should not be indexed by segment_id
    public getSegments() {
        return this._state._segments;
    }

    public getQTree() {
        return this._state._qTree;
    }

    public getHeatmap() {
        return this._state._heatmap;
    }

    public getDebugData() {
        return this._state._debugData;
    }

    public getTargetZoom() {
        return this._state._targetZoom;
    }
}

export const MapStore = new MapStoreClass(AppDispatcher);
