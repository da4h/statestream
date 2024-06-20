import { connect, IConnackPacket, MqttClient } from "mqtt";
import { EventEmitter } from "stream";

export class MqttConnector extends EventEmitter {
    private client : MqttClient;

    public constructor() {
        super();
    }

    connect() {
        this.client = connect("mqtt://localhost");
        this.client.on("message", (topic, message) => { this.onMessage(topic, message); })
        this.client.on("connect", (packet: IConnackPacket) => {
            console.log("connected");
            this.client.subscribe(this.eventNames() as string[], {qos: 0, nl: false});
        });
    }

    publish (key: string, state: any) {
        console.log("publish");
        this.client.publish(key, JSON.stringify(state));
    }

    private onMessage(topic: string, message: Buffer) {
        console.log("onMessage", topic);
        let data = JSON.parse(message.toString());
        this.emit(topic, topic, data);
    }

    public on(key: string, callback: (...args: any[]) => void): this {
        if (this.client) {
            this.client.subscribe(key);
        }

        return super.on(key, (topic, data) => {        console.log("recv", key);            callback(topic, data);});
    }

    public close(): Promise<boolean> {
        return new Promise((resolve, reject) => {
            this.client.end(error => {
                if (error) reject(error);
                else resolve(true);
            });
        })
    }
}