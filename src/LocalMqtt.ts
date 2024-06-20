import { createBroker } from 'aedes';
import { Server, createServer } from 'net';
import { Connector } from './connector/Connector';
import Aedes from 'aedes/types/instance';
import { Publisher } from './publisher/Publisher';

export class LocalMqtt extends Connector {
    private readonly _mqttHandler: Aedes;
    private readonly _server: Server;

    public constructor() {
        super();
        this._mqttHandler = createBroker();
        this._server = createServer(this._mqttHandler.handle);

        /*
            aedes.on("publish", (a, b) => {
                //console.log(a, b);
            })
        */
    }

    public connect(options: {port?: number}) {
        this._server.listen(options.port || 1883);
        Object.keys(this.subscriptions).forEach(key => {
            this._mqttHandler.subscribe(key, packet => {
                this.subscriptions[key].publish(JSON.parse(packet.payload.toString()))
            }, () => {});
        });
    }

    public publish(key: string, publisher: Publisher<any>) {
        publisher.subscribe(data => {
            this._mqttHandler.publish({
                cmd: 'publish',
                qos: 0,
                dup: false,
                retain: false,
                topic: key,
                payload: JSON.stringify(data)
            }, err => {});
        });

        publisher.onEmpty(() => {
            this._mqttHandler.publish({
                cmd: 'publish',
                qos: 0,
                dup: false,
                retain: false,
                topic: key,
                payload: JSON.stringify(null)
            }, err => {});
        })
        //todo fix publishing while disconnected
    }
    
}