import React, { useState } from 'react';

interface ToggleButtonProps {
    onText: string;
    offText: string;
    action: () => void;
}

export const ToggleButton: React.FunctionComponent<ToggleButtonProps> = (props) => {
    const [toggleState, setToggleState] = useState(false);
    const [textValue, setTextValue] = useState(props.offText);

    function _onButtonClick() {
        const newToggleState = !toggleState;
        setToggleState(newToggleState);
        setTextValue(newToggleState ? props.onText : props.offText);
        props.action();
    }

    return <button onClick={_onButtonClick}>{textValue}</button>;
}
