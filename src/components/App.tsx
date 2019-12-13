import React, { useState } from 'react';

import MapActions from '../actions/MapActions';
import config from '../game_modules/config';
import { GameCanvas } from './GameCanvas';
import { ToggleButton } from './ToggleButton';

export const App: React.FunctionComponent = (props) => {
    const [segmentCountLimit, setSegmentCountLimit] = useState(config.mapGeneration.SEGMENT_COUNT_LIMIT);
    const [seed, setSeed] = useState(42);

    function _onSegmentCountChange(event: any) {
        config.mapGeneration.SEGMENT_COUNT_LIMIT = event.target.value;
        setSegmentCountLimit(event.target.value);
    }

    function _regenerateMap(internalSeed: number) {
        MapActions.generate(internalSeed);
    }

    function _onSeedChange(event: any) {
        _regenerateMap(event.target.value);
        setSeed(event.target.value);
    }

    return <div id="main-viewport-container">
        <GameCanvas seed={seed} />
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
            <label htmlFor="segment-limit" style={{ marginLeft: '0.75em' }}>Segment limit:</label>
            <input id="segment-limit"
                onChange={_onSegmentCountChange}
                type="number"
                min="1"
                max="5000"
                value={segmentCountLimit} />
            <label htmlFor="seed-for-random" style={{ marginLeft: '0.75em' }}>Seed:</label>
            <input id="seed-for-random"
                onChange={_onSeedChange}
                type="number"
                min="1"
                max="5000"
                value={seed} />
            <button onClick={() => _regenerateMap(seed)}>Regenerate</button>
        </div >
    </div >
}
