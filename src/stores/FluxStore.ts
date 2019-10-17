import { EventEmitter } from 'events';
import { Action } from '../dispatcher/AppDispatcher';
import { Dispatcher } from 'flux';

const CHANGE_EVENT = 'change';

export class FluxStore<TState> {
    _changed: boolean;
    _emitter: EventEmitter;
    dispatchToken: string;
    _dispatcher: Dispatcher<Action>;
    _cleanStateFn: () => TState;
    _state: TState;

    constructor(dispatcher: Dispatcher<Action>, protected _onDispatch: (action: Action) => void, cleanStateFn: () => TState) {
        this._emitter = new EventEmitter();
        this._changed = false;
        this._dispatcher = dispatcher;
        this.dispatchToken = dispatcher.register((payload: Action) => {
            this._invokeOnDispatch(payload);
        });

        this._cleanStateFn = cleanStateFn;
        this._state = this._cleanStateFn();
    }

    /**
     * Is idempotent per dispatched event
     */
    emitChange() {
        this._changed = true;
    }

    hasChanged() { return this._changed; }

    addChangeListener(callback: () => void) {
        this._emitter.on(CHANGE_EVENT, callback);
    }

    removeChangeListener(callback: () => void) {
        this._emitter.removeListener(CHANGE_EVENT, callback);
    }

    _cleanState() {
        this._changed = false;
        this._state = this._cleanStateFn();
    }

    _invokeOnDispatch(payload: Action) {
        this._changed = false;
        this._onDispatch(payload);
        if (this._changed) {
            this._emitter.emit(CHANGE_EVENT);
        }
    }
}
