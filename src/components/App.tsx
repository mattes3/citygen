import React, { useState } from 'react';

import MapActions from '../actions/MapActions';
import config from '../game_modules/config';
import { GameCanvas } from './GameCanvas';
import { ToggleButton } from './ToggleButton';

export const App: React.FunctionComponent = (props) => {
    const [segmentCountLimit, setSegmentCountLimit] = useState(config.mapGeneration.SEGMENT_COUNT_LIMIT);

    function _onSegmentCountChange(event: any) {
        config.mapGeneration.SEGMENT_COUNT_LIMIT = event.target.value;
        setSegmentCountLimit(event.target.value);
    }

    function _regenerateMap() {
        const seed = new Date().getTime();
        MapActions.generate(seed);
    }

    return <div id="main-viewport-container">
        <GameCanvas />
        <div id="control-bar">
            <ToggleButton
                onText="Hide Debug Drawing"
                offText="Show Debug Drawing"
                action={() => { config.mapGeneration.DEBUG = !config.mapGeneration.DEBUG }}
            />
            <ToggleButton
                onText="Hide Population Heatmap"
                offText="Show Population Heatmap"
                action={() => { config.mapGeneration.DRAW_HEATMAP = !config.mapGeneration.DRAW_HEATMAP }}
            />
            <button onClick={() => MapActions.factorTargetZoom(3 / 2)}>Zoom in</button>
            <button onClick={() => MapActions.factorTargetZoom(2 / 3)}>Zoom out</button>
            <label htmlFor="segment-limit">Segment limit:</label>
            <input id="segment-limit"
                onChange={_onSegmentCountChange}
                type="number"
                min="1"
                max="5000"
                value={segmentCountLimit} />
            <button onClick={_regenerateMap}>Regenerate</button>
        </div >
    </div >
}
