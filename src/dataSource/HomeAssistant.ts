import {
    Connection,
    createConnection,
    subscribeEntities,
    createLongLivedTokenAuth,
    HassServiceTarget
} from "home-assistant-js-websocket";
import { ConnectionState, DataSource } from "./DataSource";
import { StateStream } from "src/stateStream/StateStream";

const wnd = globalThis;
wnd.WebSocket = require("ws");

export interface HomeAssistantState<T, U> {
    entity_id: string;
    state: T;
    attributes: { [key in keyof U]: U[key] };
    context: { id: string, parent_id: string | null, user_id: string | null };
    last_changed: string;
    last_updated: string;
}

export class HomeAssistant extends DataSource {
    private _connection: Connection;

    public constructor() {
        super();
    }

    public async connect(options: {url: string, longLivedToken: string}) {
        const auth = createLongLivedTokenAuth(
            options.url,
            options.longLivedToken
        );
        
        this._connection = await createConnection({ auth });
        this.updateState(ConnectionState.Connected);

        subscribeEntities(this._connection, entities => {
            Object.keys(entities).forEach(id => {
                if (!this.subscriptions.hasOwnProperty(id)) return;

                this.subscriptions[id].updateState(entities[id]);
            });
        });
    }

    publish(key: string, publisher: StateStream<any>) {
        throw new Error("Method not implemented.");
    }

    public callService(
        domain: string,
        service: string,
        data?: { [key: string]: any },
        target?: HassServiceTarget
    ) {
        const serviceCall = {
            type: 'call_service',
            domain,
            service,
            service_data: { ...data, ...target },
        };
    
        return this._connection.sendMessagePromise(serviceCall);
    }
}