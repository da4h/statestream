import { connect, IConnackPacket, MqttClient } from 'mqtt';
import { ConnectionState, DataSource } from './DataSource';
import { StateStream } from 'src/stateStream/StateStream';

export class RemoteMqttServer extends DataSource {
  private client: MqttClient;

  public constructor() {
    super();
  }

  public connect(options: { host: string }) {
    this.client = connect(`mqtt://${options.host}`);
    this.client.on('message', (topic, message) => {
      this.subscriptions[topic].updateState(JSON.parse(message.toString()));
    });
    this.client.on('connect', (_: IConnackPacket) => {
      this.updateState(ConnectionState.Connected);
      this.client.subscribe(Object.keys(this.subscriptions) as string[], {
        qos: 0,
        nl: false,
      });
    });
  }

  publish(key: string, publisher: StateStream<any>) {
    publisher.then((stateChange) => {
      this.client.publish(key, JSON.stringify(stateChange.to.value), {
        qos: 0,
        dup: false,
        retain: true,
      });
    });

    publisher.onEmpty(() => {
      this.client.publish(key, JSON.stringify(null), {
        qos: 0,
        dup: false,
        retain: true,
      });
    });
    //todo fix publishing while disconnected
  }

  public close(): Promise<boolean> {
    return new Promise((resolve, reject) => {
      this.client.end((error) => {
        if (error) reject(error);
        else resolve(true);
      });
    });
  }
}