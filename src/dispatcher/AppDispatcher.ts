import { Dispatcher } from 'flux';
import { PayloadSources, ActionTypes } from './Constants';

export type Action = {
    source: PayloadSources;
    action: {
        actionType: ActionTypes;
        [index: string]: any;
    }
}

class DerivedAppDispatcher extends Dispatcher<Action> {

    /**
     * A bridge function between the views and the dispatcher, marking the action
     * as a view action.  Another variant here could be handleServerAction.
     * @param  {object} action The data coming from the view.
     */
    public handleViewAction(action: any) {
        this.dispatch({
            source: PayloadSources.VIEW_ACTION,
            action: action
        });
    }

    public handleLogicAction(action: any) {
        this.dispatch({
            source: PayloadSources.LOGIC_ACTION,
            action: action
        });
    }
}

export const AppDispatcher = new DerivedAppDispatcher();
