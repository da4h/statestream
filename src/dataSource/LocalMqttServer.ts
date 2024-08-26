import { createBroker } from 'aedes';
import { Server, createServer } from 'net';
import { DataSource } from './DataSource';
import Aedes from 'aedes/types/instance';
import { StateStream } from '../stateStream/StateStream';

export class LocalMqttServer extends DataSource {
  private readonly _mqttHandler: Aedes;
  private readonly _server: Server;

  public constructor() {
    super();
    this._mqttHandler = createBroker();
    this._server = createServer(this._mqttHandler.handle);
  }

  public connect(options: { port?: number }) {
    this._server.listen(options.port || 1883);
    Object.keys(this.subscriptions).forEach((key) => {
      this._mqttHandler.subscribe(
        key,
        (packet) => {
          this.subscriptions[key].updateState(
            JSON.parse(packet.payload.toString()),
          );
        },
        () => {},
      );
    });
  }
  
  public publish(key: string, publisher: StateStream<any>) {
    publisher.then((stateChange) => {
      this._mqttHandler.publish(
        {
          cmd: 'publish',
          qos: 0,
          dup: false,
          retain: false,
          topic: key,
          payload: JSON.stringify(stateChange.to.value),
        },
        (_) => {},
      );
    });

    publisher.onEmpty(() => {
      this._mqttHandler.publish(
        {
          cmd: 'publish',
          qos: 0,
          dup: false,
          retain: false,
          topic: key,
          payload: JSON.stringify(null),
        },
        (_) => {},
      );
    });
    //todo fix publishing while disconnected
  }
}
