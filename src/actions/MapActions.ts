import { AppDispatcher } from '../dispatcher/AppDispatcher';
import { ActionTypes } from '../dispatcher/Constants';

const MapActions = {
    generate(seed: number) {
        return AppDispatcher.handleLogicAction({
            actionType: ActionTypes.MAP_GENERATE,
            seed
        });
    },
    factorTargetZoom(factor: number) {
        return AppDispatcher.handleLogicAction({
            actionType: ActionTypes.MAP_FACTOR_TARGET_ZOOM,
            factor
        });
    }
};

export default MapActions;
