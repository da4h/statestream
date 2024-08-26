/*
import { MqttConnector } from "./MqttConnector";
import { createBroker } from 'aedes';
import { createServer } from 'net';

const port = 1883

const aedes = createBroker();

aedes.on("publish", (a, b) => {
    //console.log(a, b);
})

const server = createServer(aedes.handle);
server.listen(port, function () {
    console.log('server started and listening on port ', port);
  })

describe('MqttConnector', () => {
    let connector: MqttConnector;
    let received = jest.fn();
  
    beforeEach(async () => {
        connector = new MqttConnector();
        connector.connect();
    });
  
    describe('test1', () => {
      it('it1', async () => {
        await new Promise(resolve => setTimeout(resolve, 1000));

        let success = new Promise((resolve) => {
            connector.on("key", (topic, data) => resolve(data));
        });

        connector.publish("key", "data");
        let result = Promise.any([
            success,
            new Promise(resolve => setTimeout(resolve, 4000)),
        ]);

        await expect(result).resolves.toBe("data");
      }, 10000);
    });

    afterAll(async () => {
        server.close();
        aedes.close();
        await connector.close();
    });
  });
*/
