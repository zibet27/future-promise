import assert from 'assert';
import { Future } from './index.js';

const testFutures = () => {
    const f1 = new Future((resolve) => setTimeout(() => resolve(1), 150));
    const f2 = new Future((resolve) => setTimeout(() => resolve(2), 100));
    return [f1, f2];
}

const testRace = async () => {
    const val = await Future.race(testFutures());
    assert(val === 2);
}

const testAll = async () => {
    const values = await Future.all(testFutures());
    assert(values.length === 2);
    assert(values[0] === 1);
    assert(values[1] === 2);
}

const testAllSettled = async () => {
    const values = await Future.allSettled(testFutures());
    assert(values.length === 2);
    assert(values[0] === 2);
    assert(values[1] === 1);
}

const mainTest = () => {
    const logs = [];
    const expectedLogs = [
        "I am first", "some data", "hello 1",
        "hey", "error", "final 1", "final 2"
    ];
    const log = (message) => {
        logs.push(message);
    }
    new Future((resolve) => {
        setTimeout(() => {
            resolve("some data");
        }, 100);
        log("I am first");
    })
        .then((val) => {
            log(val);
            return new Future((res) => res())
                .then(() => log("hello 1"))
                .finally(() => log("final 1"));
        })
        .then(() => {
            log("hey");
            throw new Error("error");
        })
        .catch((err) => log(err.message))
        .finally(() => log("final 2"))
        .finally(() => {
            assert(logs.length === 7);
            for (let i = 0; i < logs.length; i++) {
                const message = `Expected to log "${expectedLogs[i]}", but have "${log}"`;
                assert(logs[i] === expectedLogs[i], message);
            }
        });
}

mainTest();
testAll();
testAllSettled();
testRace();

console.log('All tests are completed!!!')